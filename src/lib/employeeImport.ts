/**
 * Employee import from a fixed Excel template.
 *
 * The template's column headers never change, so every client fills in the same file. What goes in the
 * cells (names, codes, departments, sites) is up to the client; only the headers are checked.
 */
import * as XLSX from 'xlsx';
import type { Location, User } from '@/data/models';
import { getCollection, upsertIntoCollection } from '@/lib/db';
import { stockHolderName, type Holder } from '@/lib/holders';

/** The template header row. Do not rename or reorder: clients' files depend on it. */
export const EMPLOYEE_TEMPLATE_HEADERS = ['Sr.No.', 'Code', 'Employee Name', 'Site', 'Department'] as const;
const REQUIRED = ['Code', 'Employee Name', 'Site', 'Department'] as const;
const SAMPLE_PREFIX = 'SAMPLE-';
const MAX_ROWS = 5000;

const SAMPLE_ROWS: Array<[number, string, string, string, string]> = [
  [1, 'SAMPLE-001', 'AARAV SHAH', 'MAIN PLANT', 'DISPATCH'],
  [2, 'SAMPLE-002', 'MEERA IYER', 'MAIN PLANT', 'ACCOUNTS'],
  [3, 'SAMPLE-003', 'RAJESH KUMAR', 'MAIN PLANT', 'QUALITY'],
  [4, 'SAMPLE-004', 'SNEHA PATEL', 'HEAD OFFICE', 'HR'],
  [5, 'SAMPLE-005', 'IMRAN KHAN', 'HEAD OFFICE', 'SALES'],
  [6, 'SAMPLE-006', 'LATA DESAI', 'HEAD OFFICE', 'PURCHASE'],
];

export function downloadEmployeeTemplate() {
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([[...EMPLOYEE_TEMPLATE_HEADERS], ...SAMPLE_ROWS]);
  sheet['!cols'] = [{ wch: 8 }, { wch: 16 }, { wch: 32 }, { wch: 20 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, sheet, 'Employees');

  const guide = XLSX.utils.aoa_to_sheet([
    ['How to fill in this file'],
    [''],
    ['Keep the first row (the column headers) exactly as it is. Replace the sample rows with your employees, one per row.'],
    [''],
    ['Column', 'What to enter', 'Required'],
    ['Sr.No.', 'Row number. Optional; not used.', 'No'],
    ['Code', 'The employee ID or code. Must be different for every employee. An existing code is updated, not duplicated.', 'Yes'],
    ['Employee Name', 'Full name.', 'Yes'],
    ['Site', 'Work location. Use the same name as the site in AssetFlow. A site that does not exist yet can be created during import.', 'Yes'],
    ['Department', 'Department at that site. A new department is created during import.', 'Yes'],
    [''],
    [`Rows whose Code starts with "${SAMPLE_PREFIX}" are samples and are skipped: delete or replace them.`],
    ['Only the Super Admin can import. You can review everything before it is saved.'],
  ]);
  guide['!cols'] = [{ wch: 16 }, { wch: 95 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, guide, 'Read me');
  XLSX.writeFile(wb, 'AssetFlow-employee-import-template.xlsx');
}

/* ───────────────────────── reading ───────────────────────── */

export type RowAction = 'new' | 'update' | 'unchanged' | 'error';
export interface ImportRow {
  line: number;
  code: string;
  name: string;
  site: string;
  department: string;
  action: RowAction;
  problems: string[];
}
export interface EmployeePlan {
  fileName: string;
  /** Column headers that are missing. When not empty nothing can be imported. */
  missingHeaders: string[];
  rows: ImportRow[];
  /** Sites in the file that do not exist yet (names as written in the file). */
  newSites: string[];
  newDepartments: Array<{ site: string; name: string }>;
  tooManyRows: boolean;
}

const norm = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
const key = (v: unknown) => norm(v).toUpperCase();
const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function findSite(sites: Location[], name: string): Location | undefined {
  const k = key(name);
  return sites.find(s => key(s.name) === k || (s.siteCode && key(s.siteCode) === k));
}

export async function planEmployeeImport(file: File): Promise<EmployeePlan> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames.find(n => key(n) === 'EMPLOYEES') ?? wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  // Column A is index 0 even when the used range starts further right.
  const range = sheet?.['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : undefined;
  if (range) { range.s.c = 0; range.s.r = 0; }
  const grid = sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true, range }) : [];

  const plan: EmployeePlan = { fileName: file.name, missingHeaders: [], rows: [], newSites: [], newDepartments: [], tooManyRows: false };
  const headerRow = (grid[0] ?? []).map(norm);
  const col = (name: string) => headerRow.findIndex(h => h.toUpperCase() === name.toUpperCase());
  plan.missingHeaders = REQUIRED.filter(h => col(h) < 0);
  if (plan.missingHeaders.length) return plan;
  const [cCode, cName, cSite, cDept] = [col('Code'), col('Employee Name'), col('Site'), col('Department')];

  const users = getCollection<User>('users');
  const sites = getCollection<Location>('locations');
  const departments = getCollection<{ id: string; name: string; siteId?: string }>('departments');
  const byEmployeeId = new Map(users.map(u => [key(u.employeeId || ''), u]));
  const seen = new Map<string, number>();
  const newSites = new Map<string, string>();
  const newDepartments = new Map<string, { site: string; name: string }>();

  const body = grid.slice(1).filter(r => r.some(c => norm(c) !== ''));
  if (body.length > MAX_ROWS) { plan.tooManyRows = true; return plan; }

  body.forEach((r, i) => {
    const line = i + 2;
    const row: ImportRow = { line, code: norm(r[cCode]), name: norm(r[cName]), site: norm(r[cSite]), department: norm(r[cDept]), action: 'new', problems: [] };
    if (!row.code) row.problems.push('Code is empty');
    if (!row.name) row.problems.push('Employee Name is empty');
    if (!row.site) row.problems.push('Site is empty');
    if (!row.department) row.problems.push('Department is empty');
    if (row.code.toUpperCase().startsWith(SAMPLE_PREFIX)) row.problems.push('Sample row from the template: delete or replace it');
    if (row.code) {
      const first = seen.get(key(row.code));
      if (first) row.problems.push(`Same code as row ${first}`); else seen.set(key(row.code), line);
    }

    if (row.problems.length) { row.action = 'error'; plan.rows.push(row); return; }

    const site = findSite(sites, row.site);
    if (!site && !newSites.has(key(row.site))) newSites.set(key(row.site), row.site);
    const hasDept = site && departments.some(d => d.siteId === site.id && key(d.name) === key(row.department));
    const deptKey = `${key(row.site)}|${key(row.department)}`;
    if (!hasDept && !newDepartments.has(deptKey)) newDepartments.set(deptKey, { site: row.site, name: row.department });

    const existing = byEmployeeId.get(key(row.code));
    if (!existing) row.action = 'new';
    else if (existing.name === row.name && existing.department === row.department && site && existing.siteId === site.id) row.action = 'unchanged';
    else row.action = 'update';
    plan.rows.push(row);
  });

  plan.newSites = [...newSites.values()];
  plan.newDepartments = [...newDepartments.values()];
  return plan;
}

/* ───────────────────────── saving ───────────────────────── */

export interface ImportResult { created: number; updated: number; skipped: number; sitesCreated: number; departmentsCreated: number }

/**
 * Saves the valid rows. Sites that do not exist are created only when `createMissingSites` is true
 * (each gets a stock holder); rows for a missing site are skipped otherwise.
 */
export async function applyEmployeeImport(plan: EmployeePlan, options: { createMissingSites: boolean }): Promise<ImportResult> {
  const users = getCollection<User>('users');
  const sites = [...getCollection<Location>('locations')];
  const departments = [...getCollection<{ id: string; name: string; siteId?: string }>('departments')];
  const byEmployeeId = new Map(users.map(u => [key(u.employeeId || ''), u]));
  const taken = new Set(sites.map(s => s.id));
  const usedIds = new Set(users.map(u => u.id));
  const newSites: Location[] = [];
  const newHolders: Holder[] = [];
  const newDepartments: Array<{ id: string; name: string; siteId: string }> = [];
  const out: User[] = [];
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, sitesCreated: 0, departmentsCreated: 0 };
  const today = new Date().toISOString().slice(0, 10);

  const nextSiteId = () => { let n = taken.size + 1; while (taken.has(`LOC-${String(n).padStart(3, '0')}`)) n++; const id = `LOC-${String(n).padStart(3, '0')}`; taken.add(id); return id; };

  for (const row of plan.rows) {
    if (row.action === 'error' || row.action === 'unchanged') { if (row.action === 'error') result.skipped++; continue; }
    let site = findSite(sites, row.site);
    if (!site) {
      if (!options.createMissingSites) { result.skipped++; continue; }
      site = { id: nextSiteId(), name: row.site, address: '', type: 'office', capacity: 0, manager: '' } as Location;
      sites.push(site); newSites.push(site); result.sitesCreated++;
      newHolders.push({ id: `HLD-${crypto.randomUUID().slice(0, 8)}`, siteId: site.id, kind: 'stock', name: stockHolderName(site.name), active: true });
    }
    if (!departments.some(d => d.siteId === site!.id && key(d.name) === key(row.department))) {
      const dept = { id: crypto.randomUUID(), name: row.department, siteId: site.id };
      departments.push(dept); newDepartments.push(dept); result.departmentsCreated++;
    }
    const existing = byEmployeeId.get(key(row.code));
    if (existing) {
      out.push({ ...existing, employeeId: row.code, name: row.name, department: row.department, siteId: site.id });
      result.updated++;
    } else {
      let id = `EMP-${slug(row.code) || crypto.randomUUID().slice(0, 8)}`;
      for (let n = 2; usedIds.has(id); n++) id = `EMP-${slug(row.code)}-${n}`;
      usedIds.add(id);
      out.push({
        id, employeeId: row.code, name: row.name,
        email: `${slug(row.code) || 'employee'}@import.local`, department: row.department, siteId: site.id,
        role: 'user', phone: '', joinDate: today, status: 'active',
      });
      result.created++;
    }
  }

  // Sites first, so the employees' sites exist when they are saved.
  await upsertIntoCollection('locations', newSites);
  await upsertIntoCollection('holders', newHolders);
  await upsertIntoCollection('departments', newDepartments);
  await upsertIntoCollection('users', out);
  return result;
}
