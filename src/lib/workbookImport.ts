import * as XLSX from 'xlsx';
import { DEFAULT_ASSET_CATEGORIES } from '@/data/assetCategories';
import type { Asset, AssetCategory, AssetHistoryEvent, AssetType, Assignment, Invoice, ItCallLog, Location, SoftwareLicense, User, Vendor } from '@/data/models';
import { getCollection, kv, pendingWrites, replaceCollection } from '@/lib/db';
import { DEFAULT_SYSTEM_POLICY, type SystemPolicy } from '@/data/masterData';

export type ImportWarning = { code: string; message: string; count: number };
export type WorkbookImport = {
  files: string[];
  users: User[];
  locations: Location[];
  departments: { id: string; name: string }[];
  assets: Asset[];
  assignments: Assignment[];
  history: AssetHistoryEvent[];
  licenses: SoftwareLicense[];
  vendors: Vendor[];
  invoices: Invoice[];
  callLogs: ItCallLog[];
  stock: Array<{ id: string; name: string; sku: string; category: string; quantity: number; minQuantity: number; unitCost: number; location: string }>;
  warnings: ImportWarning[];
};

const emptyImport = (): WorkbookImport => ({ files: [], users: [], locations: [], departments: [], assets: [], assignments: [], history: [], licenses: [], vendors: [], invoices: [], callLogs: [], stock: [], warnings: [] });
const text = (value: unknown) => value == null ? '' : String(value).trim();
const upper = (value: unknown) => text(value).toUpperCase();
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || crypto.randomUUID();
const isoDate = (value: unknown) => {
  if (!value) return '';
  const date = value instanceof Date ? value : typeof value === 'number'
    ? new Date(Date.UTC(1899, 11, 30 + value))
    : new Date(String(value));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};
const rows = (workbook: XLSX.WorkBook, name: string): unknown[][] => {
  const sheet = workbook.Sheets[name];
  return sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true }) : [];
};
const uniqueBy = <T>(items: T[], key: (item: T) => string) => Array.from(new Map(items.filter(Boolean).map(item => [key(item), item])).values());

const typeMap: Record<string, AssetType> = {
  CPU: 'desktop', DESKTOP: 'desktop', LAPTOP: 'laptop', MONITOR: 'monitor', MONITER: 'monitor',
  MOUSE: 'accessory', KEYBOARD: 'accessory', PENDRIVE: 'accessory', HDD: 'accessory', 'HARD DISK INCLOSER': 'accessory',
  PRINTER: 'printer', SCANNER: 'printer', TAB: 'tablet', TABLET: 'tablet', CAMERA: 'accessory',
  SERVER: 'server', NASS: 'server', NVR: 'server', ROUTER: 'accessory', SWITCH: 'accessory', WIFI: 'accessory',
  FIREWALL: 'accessory', UPS: 'accessory', BIOMATRIC: 'accessory', BIOMETRIC: 'accessory', RACK: 'accessory',
};
const digitalTypes = new Set(['AD LOGIN', 'EMAIL-M365', 'SAP', 'VPN', 'SPYNE']);
const normalizeDepartment = (value: unknown) => upper(value).replace(/DEPERTMENT/g, 'DEPARTMENT').replace(/^VACANT-/, '').replace(/\s+/g, ' ').trim();
const normalizeLocation = (value: unknown) => upper(value).replace(/^X$/, '').replace(/\s+/g, ' ').trim();
const isPlaceholderEmployee = (value: unknown) => /^(IT SPARE|INACTIVE USER|VACANT|EX-EMPLOYEE|LEFT|-)\b/i.test(text(value));

/**
 * Asset types the imported assets use that this company has not set up (for example a type that
 * was deleted). They are created on import so no imported asset ends up with an unknown type.
 */
export function missingAssetCategories(data: Pick<WorkbookImport, 'assets'>): AssetCategory[] {
  const existing = getCollection<AssetCategory>('asset-categories');
  const known = new Set(existing.map(category => category.id));
  const takenCodes = new Set(existing.map(category => (category.code || '').toUpperCase()));
  const out: AssetCategory[] = [];
  for (const id of Array.from(new Set(data.assets.map(asset => asset.type)))) {
    if (!id || known.has(id)) continue;
    const preset = DEFAULT_ASSET_CATEGORIES.find(category => category.id === id);
    const name = preset?.name || id.replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
    let code = (preset?.code || name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'TYP').toUpperCase();
    for (let n = 2; takenCodes.has(code) && n < 100; n++) code = `${code.slice(0, 2)}${n}`;
    takenCodes.add(code);
    out.push({ id, name, code, active: true });
  }
  return out;
}

export async function parseAssetWorkbooks(files: File[]): Promise<WorkbookImport> {
  const result = emptyImport();
  for (const file of files) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    result.files.push(file.name);
    if (workbook.SheetNames.includes('Asset_List') && workbook.SheetNames.includes('Allocation')) parseAssetRegister(workbook, result);
    if (workbook.SheetNames.includes('Log Book')) parsePcLogBook(workbook, result);
  }
  result.users = uniqueBy(result.users, item => item.id);
  result.locations = uniqueBy(result.locations, item => item.name);
  result.departments = uniqueBy(result.departments, item => item.name);
  result.assets = uniqueBy(result.assets, item => item.assetTag.toUpperCase());
  result.assignments = uniqueBy(result.assignments, item => item.assetId);
  result.history = uniqueBy(result.history, item => item.id);
  result.licenses = uniqueBy(result.licenses, item => item.id);
  result.vendors = uniqueBy(result.vendors, item => item.name.toUpperCase());
  result.invoices = uniqueBy(result.invoices, item => item.id);
  result.callLogs = uniqueBy(result.callLogs, item => item.id);
  result.stock = uniqueBy(result.stock, item => item.id);
  const missing = missingAssetCategories(result);
  if (missing.length) {
    result.warnings.push({ code: 'missing-types', message: `These asset types are not set up in this company yet and will be created on import: ${missing.map(category => `${category.name} (${category.code})`).join(', ')}. You can rename them later in Settings → Asset setup.`, count: missing.length });
  }
  return result;
}

export async function applyWorkbookImport(data: WorkbookImport) {
  const merge = <T>(existing: T[], incoming: T[], key: (item: T) => string) =>
    Array.from(new Map([...existing, ...incoming].map(item => [key(item), item])).values());
  await replaceCollection('users', merge(getCollection<User>('users'), data.users, item => item.id));
  await replaceCollection('locations', merge(getCollection<Location>('locations'), data.locations, item => item.id));
  await replaceCollection('departments', merge(getCollection<{ id: string; name: string }>('departments'), data.departments, item => item.id));
  const missingTypes = missingAssetCategories(data);
  if (missingTypes.length) await replaceCollection('asset-categories', [...getCollection<AssetCategory>('asset-categories'), ...missingTypes]);
  await replaceCollection('assets', merge(getCollection<Asset>('assets'), data.assets, item => item.assetTag.toUpperCase()));
  await replaceCollection('assignments', merge(getCollection<Assignment>('assignments'), data.assignments, item => item.assetId));
  await replaceCollection('history', merge(getCollection<AssetHistoryEvent>('history'), data.history, item => item.id));
  await replaceCollection('licenses', merge(getCollection<SoftwareLicense>('licenses'), data.licenses, item => item.id));
  await replaceCollection('vendors', merge(getCollection<Vendor>('vendors'), data.vendors, item => item.name.toUpperCase()));
  await replaceCollection('invoices', merge(getCollection<Invoice>('invoices'), data.invoices, item => item.id));
  await replaceCollection('call-logs', merge(getCollection<ItCallLog>('call-logs'), data.callLogs, item => item.id));
  if (data.stock.length) {
    const current = JSON.parse(kv.getItem('assetflow-stock') || '[]') as typeof data.stock;
    kv.setItem('assetflow-stock', JSON.stringify(merge(current, data.stock, item => item.id)));
    const { flushKv } = await import('@/lib/db');
    flushKv();
  }
  await pendingWrites();
}

function parseAssetRegister(workbook: XLSX.WorkBook, out: WorkbookImport) {
  const employeeRows = rows(workbook, 'Employee').slice(1).filter(row => text(row[2]));
  const employeeByCode = new Map<string, User>();
  for (const row of employeeRows) {
    const code = text(row[2]);
    const name = text(row[3]);
    const location = normalizeLocation(row[4]);
    const department = normalizeDepartment(row[5]);
    if (!name || isPlaceholderEmployee(code) || isPlaceholderEmployee(name)) continue;
    const user: User = { id: `EMP-${code}`, name, email: `${slug(code)}@import.local`, department, siteId: location ? `LOC-${slug(location)}` : '', role: 'user', phone: '', joinDate: new Date().toISOString().slice(0, 10), status: /LEFT|INACTIVE/i.test(`${name} ${department}`) ? 'left' : 'active' };
    employeeByCode.set(code, user); out.users.push(user);
    if (location) out.locations.push({ id: `LOC-${slug(location)}`, name: location, address: '', type: 'office', capacity: 0, manager: '' });
    if (department) out.departments.push({ id: department, name: department });
  }

  const allocationRows = rows(workbook, 'Allocation').slice(2).filter(row => text(row[3]));
  const allocationsByAsset = new Map<string, unknown[][]>();
  for (const row of allocationRows) {
    const tag = upper(row[3]);
    allocationsByAsset.set(tag, [...(allocationsByAsset.get(tag) ?? []), row]);
  }

  const seenTags = new Set<string>(); let duplicateCount = 0; let unknownTypes = 0;
  for (const row of rows(workbook, 'Asset_List').slice(2).filter(row => text(row[1]))) {
    const tag = upper(row[1]);
    if (seenTags.has(tag)) { duplicateCount++; continue; }
    seenTags.add(tag);
    const sourceType = upper(row[2]);
    const description = text(row[3]);
    const historyRows = (allocationsByAsset.get(tag) ?? []).sort((a, b) => isoDate(a[8] || a[6]).localeCompare(isoDate(b[8] || b[6])));
    const latest = historyRows.at(-1);
    const code = latest ? text(latest[2]) : '';
    const assignee = employeeByCode.get(code);

    if (digitalTypes.has(sourceType)) {
      out.licenses.push({ id: tag, name: description || sourceType, vendor: sourceType === 'EMAIL-M365' ? 'Microsoft' : sourceType, licenseKey: '', type: 'subscription', totalSeats: 1, usedSeats: assignee ? 1 : 0, expiryDate: '', cost: 0 });
      continue;
    }
    const type = typeMap[sourceType] ?? 'accessory';
    if (!typeMap[sourceType]) unknownTypes++;
    const siteId = assignee?.siteId || '';
    out.assets.push({ id: `AST-${slug(tag)}`, name: description || `${sourceType} ${tag}`, type, manufacturer: '', model: description, serialNumber: '', assetTag: tag, status: assignee ? 'assigned' : 'available', purchaseDate: '', purchasePrice: 0, warrantyExpiry: '', siteId, assignedTo: assignee?.id, notes: `Imported type: ${sourceType}` });
    historyRows.forEach((allocation, index) => {
      const employeeCode = text(allocation[2]); const user = employeeByCode.get(employeeCode);
      const assignedDate = isoDate(allocation[8] || allocation[6]) || new Date().toISOString().slice(0, 10);
      const next = historyRows[index + 1];
      out.history.push({ id: `IMP-${slug(tag)}-${index + 1}`, assetId: `AST-${slug(tag)}`, timestamp: `${assignedDate}T00:00:00.000Z`, action: 'Assigned', userId: user?.id, to: user?.name || employeeCode, reason: 'Imported from allocation register', source: 'Excel import' });
      if (!next && user) out.assignments.push({ id: `ASN-${slug(tag)}`, assetId: `AST-${slug(tag)}`, assetName: description || tag, userId: user.id, userName: user.name, assignedDate, status: 'active', notes: 'Imported from Allocation sheet' });
    });
  }
  if (duplicateCount) out.warnings.push({ code: 'duplicate-assets', message: 'Duplicate asset IDs were skipped; the first master record was retained.', count: duplicateCount });
  if (unknownTypes) out.warnings.push({ code: 'normalized-types', message: 'Unrecognized physical asset types were imported as accessories and retain their original type in notes.', count: unknownTypes });
  if (allocationRows.some(row => !text(row[9]))) out.warnings.push({ code: 'allocation-history', message: 'The source leaves return dates blank. The latest dated allocation is treated as current; earlier rows are preserved as history.', count: new Set(allocationRows.map(row => upper(row[3]))).size });
}

function parsePcLogBook(workbook: XLSX.WorkBook, out: WorkbookImport) {
  const logRows = rows(workbook, 'Log Book').slice(1);
  let callIndex = 0;
  for (const row of logRows) {
    if (!text(row[0]) && !text(row[1]) && !text(row[5])) continue;
    callIndex++;
    const statusText = upper(row[8]);
    const status: ItCallLog['status'] = /CLOSE/.test(statusText) ? 'closed' : /RESOLV/.test(statusText) ? 'resolved' : /PROGRESS/.test(statusText) ? 'in-progress' : 'open';
    out.callLogs.push({ id: `IMPCALL-${String(callIndex).padStart(4, '0')}`, date: isoDate(row[0]) || new Date().toISOString().slice(0, 10), time: '09:00', employeeNumber: text(row[1]), assetTag: text(row[2]) || undefined, department: normalizeDepartment(row[3]), callerName: text(row[4]) || 'Unknown user', contactNumber: '', category: 'other', priority: 'medium', issue: text(row[5]) || 'Imported support entry', troubleshooting: text(row[6]) || undefined, resolution: text(row[7]) || undefined, status, resolutionDate: isoDate(row[9]) || undefined, assignedTo: (getCollection<SystemPolicy>('system-policies')[0]||DEFAULT_SYSTEM_POLICY).defaultSupportTeam });
  }

  const vendorByName = new Map<string, Vendor>(); let purchaseIndex = 0;
  for (const row of rows(workbook, 'IT Purchase 26-27').slice(2)) {
    if (!text(row[0]) || !text(row[1])) continue;
    purchaseIndex++;
    const vendorName = text(row[7]) || 'Unknown vendor';
    const vendor: Vendor = { id: `VEN-${slug(vendorName)}`, name: vendorName, contactPerson: '', email: '', phone: '', website: '', address: '' };
    vendorByName.set(vendorName.toUpperCase(), vendor);
    const quantity = Number(row[2]) || 1; const unitPrice = Number(row[3]) || 0; const total = Number(row[4]) || quantity * unitPrice;
    const invoiceNumber = text(row[9]) || `IMPORT-${purchaseIndex}`;
    out.invoices.push({ id: `INV-${slug(invoiceNumber)}-${purchaseIndex}`, vendorId: vendor.id, invoiceNumber, invoiceDate: isoDate(row[6]) || new Date().toISOString().slice(0, 10), currency: (getCollection<SystemPolicy>('system-policies')[0]||DEFAULT_SYSTEM_POLICY).defaultCurrency, poNumber: text(row[8]) || undefined, status: 'received', notes: [text(row[10]) && `Assigned to: ${text(row[10])}`, text(row[11]) && `Warranty: ${text(row[11])}`, text(row[12])].filter(Boolean).join(' | '), subtotal: total, taxTotal: 0, total, amountPaid: 0, lineItems: [{ id: `ITEM-${purchaseIndex}`, description: text(row[1]), quantity, unitPrice, taxRate: 0, model: text(row[5]), receivedQuantity: quantity }], createdAt: new Date().toISOString() });
  }
  out.vendors.push(...vendorByName.values());

  for (const row of rows(workbook, 'SPARE').slice(1)) {
    if (!text(row[0]) || !text(row[1])) continue;
    out.stock.push({ id: `STK-${slug(text(row[1]))}`, name: text(row[1]), sku: '', category: 'IT Spare', quantity: Number(row[2]) || 0, minQuantity: Number(row[3]) || 0, unitCost: 0, location: (getCollection<SystemPolicy>('system-policies')[0]||DEFAULT_SYSTEM_POLICY).defaultStockLocation });
  }
  out.warnings.push({ code: 'credentials-excluded', message: 'Password and credential columns were intentionally excluded from import.', count: 1 });
}
