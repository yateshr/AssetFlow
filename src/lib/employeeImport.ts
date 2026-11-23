/**
 * Employee import from a fixed Excel template.
 *
 * The template's column headers never change, so every client fills in the same file. What goes in the
 * cells (names, codes, departments, sites) is up to the client; only the headers are checked.
 * The employee Code is unique: names and departments may repeat, a Code may not.
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
const CHUNK = 100;

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
    ['Code', 'The employee ID or code. It must be UNIQUE: no two employees can share a code (names and departments can repeat). An existing code is updated, not duplicated.', 'Yes'],
    ['Employee Name', 'Full name.', 'Yes'],
    ['Site', 'Work location. Use the same name as the site in AssetFlow. A site that does not exist yet can be created during import.', 'Yes'],
    ['Department', 'Department at that site. A new department is created during import.', 'Yes'],
    [''],
    [`Rows whose Code starts with "${SAMPLE_PREFIX}" are samples and are skipped: delete or replace them.`],
    ['Rows with a missing value or a repeated Code are not imported. You get a list of them to fix and import again.'],
    ['Only the Super Admin can import. You can review everything before it is saved.'],
  ]);
  guide['!cols'] = [{ wch: 16 }, { wch: 105 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, guide, 'Read me');
  XLSX.writeFile(wb, 'AssetFlow-employee-import-template.xlsx');
}

/* ───────────────────────── reading ───────────────────────── */

export type RowAction = 'new' | 'update' | 'unchanged' | 'error';
export interface ImportRow {
  /** Row number in the file (the header is row 1). */
  line: number;
  srNo: string;
  code: string;
  name: string;
  site: string;
  department: string;
  action: RowAction;
  problems: string[];
  /** For updates: what changes, so a wrong ID is easy to spot. */
  note?: string;
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

export const isDuplicateProblem = (p: string) => p.startsWith('Duplicate ID');

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
  const [cSr, cCode, cName, cSite, cDept] = [col('Sr.No.'), col('Code'), col('Employee Name'), col('Site'), col('Department')];

  const users = getCollection<User>('users');
  const sites = getCollection<Location>('locations');
  const departments = getCollection<{ id: string; name: string; siteId?: string }>('departments');
  const byEmployeeId = new Map(users.map(u => [key(u.employeeId || ''), u]));
  const newSites = new Map<string, string>();
  const newDepartments = new Map<string, { site: string; name: string }>();

  const body: Array<{ line: number; r: unknown[] }> = [];
  grid.slice(1).forEach((r, i) => { if (r.some(c => norm(c) !== '')) body.push({ line: i + 2, r }); });
  if (body.length > MAX_ROWS) { plan.tooManyRows = true; return plan; }

  // A Code that appears more than once cannot be trusted: every row that uses it is held back.
  const linesByCode = new Map<string, number[]>();
  body.forEach(({ line, r }) => { const c = key(r[cCode]); if (c) linesByCode.set(c, [...(linesByCode.get(c) ?? []), line]); });

  body.forEach(({ line, r }) => {
    const row: ImportRow = {
      line, srNo: cSr >= 0 ? norm(r[cSr]) : '', code: norm(r[cCode]), name: norm(r[cName]), site: norm(r[cSite]), department: norm(r[cDept]),
      action: 'new', problems: [],
    };
    if (!row.code) row.problems.push('Code is empty');
    if (!row.name) row.problems.push('Employee Name is empty');
    if (!row.site) row.problems.push('Site is empty');
    if (!row.department) row.problems.push('Department is empty');
    if (row.code.toUpperCase().startsWith(SAMPLE_PREFIX)) row.problems.push('Sample row from the template: delete or replace it');
    const same = row.code ? linesByCode.get(key(row.code)) ?? [] : [];
    if (same.length > 1) row.problems.push(`Duplicate ID ${row.code}: also on row ${same.filter(l => l !== line).join(', ')}`);

    if (row.problems.length) { row.action = 'error'; plan.rows.push(row); return; }

    const site = findSite(sites, row.site);
    if (!site && !newSites.has(key(row.site))) newSites.set(key(row.site), row.site);
    const hasDept = site && departments.some(d => d.siteId === site.id && key(d.name) === key(row.department));
    const deptKey = `${key(row.site)}|${key(row.department)}`;
    if (!hasDept && !newDepartments.has(deptKey)) newDepartments.set(deptKey, { site: row.site, name: row.department });

    const existing = byEmployeeId.get(key(row.code));
    if (!existing) row.action = 'new';
    else if (existing.name === row.name && existing.department === row.department && site && existing.siteId === site.id) row.action = 'unchanged';
    else {
      row.action = 'update';
      const changes: string[] = [];
      if (existing.name !== row.name) changes.push(`name was “${existing.name}”`);
      if (existing.department !== row.department) changes.push(`department was “${existing.department}”`);
      if (!site || existing.siteId !== site.id) changes.push('site changes');
      row.note = changes.join(', ');
    }
    plan.rows.push(row);
  });

  plan.newSites = [...newSites.values()];
  plan.newDepartments = [...newDepartments.values()];
  return plan;
}

/* ───────────────────────── not imported + log ───────────────────────── */

export const notImported = (plan: EmployeePlan) => plan.rows.filter(r => r.action === 'error');
export const duplicateRows = (plan: EmployeePlan) => plan.rows.filter(r => r.problems.some(isDuplicateProblem));

/** The rows that were not imported, in the template's format plus a Problem column, as an Excel file. */
export function downloadNotImported(plan: EmployeePlan) {
  const wb = XLSX.utils.book_new();
  const header = [...EMPLOYEE_TEMPLATE_HEADERS, 'Problem'];
  const sheet = XLSX.utils.aoa_to_sheet([header, ...notImported(plan).map(r => [r.srNo || r.line, r.code, r.name, r.site, r.department, r.problems.join('; ')])]);
  sheet['!cols'] = [{ wch: 8 }, { wch: 16 }, { wch: 32 }, { wch: 20 }, { wch: 26 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, sheet, 'Employees');
  XLSX.writeFile(wb, 'AssetFlow-employees-not-imported.xlsx');
}

export interface ImportResult { created: number; updated: number; skipped: number; sitesCreated: number; departmentsCreated: number }

/** Lines for the console-style log. Prefixes: ok, warn, fail, info, wait, done. */
export function importLog(plan: EmployeePlan, result?: ImportResult): string[] {
  const lines = [`$ assetflow import "${plan.fileName}"`];
  if (plan.missingHeaders.length) {
    lines.push(`[fail] template headers do not match. Missing: ${plan.missingHeaders.join(', ')}`);
    return lines;
  }
  lines.push('[ ok ] template headers match', `[ ok ] read ${plan.rows.length} employee row${plan.rows.length === 1 ? '' : 's'}`);
  for (const r of notImported(plan)) {
    const dup = r.problems.some(isDuplicateProblem);
    lines.push(`[${dup ? 'warn' : 'fail'}] row ${r.line}: ${r.problems.join('; ')}${r.code && !dup ? ` (code ${r.code})` : ''}  -> not imported`);
  }
  if (plan.newSites.length) lines.push(`[info] new site${plan.newSites.length === 1 ? '' : 's'}: ${plan.newSites.join(', ')}`);
  if (result) {
    lines.push(`[done] ${result.created} added, ${result.updated} updated, ${result.skipped} not imported`);
  } else {
    const bad = notImported(plan).length;
    lines.push(bad ? `[wait] ${bad} row${bad === 1 ? '' : 's'} will be skipped. Waiting for your confirmation...` : '[wait] no problems found. Ready to import.');
  }
  return lines;
}

/* ───────────────────────── saving ───────────────────────── */

export type Progress = (done: number, total: number, label: string) => void;

/**
 * Saves the valid rows. Sites that do not exist are created only when `createMissingSites` is true
 * (each gets a stock holder); rows for a missing site are skipped otherwise.
 */
export async function applyEmployeeImport(plan: EmployeePlan, options: { createMissingSites: boolean }, onProgress?: Progress): Promise<ImportResult> {
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
    if (row.action === 'error') { result.skipped++; continue; }
    if (row.action === 'unchanged') continue;
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

  const total = newSites.length + newDepartments.length + out.length || 1;
  let done = 0;
  const step = (n: number, label: string) => { done += n; onProgress?.(Math.min(done, total), total, label); };
  onProgress?.(0, total, 'Starting…');

  // Sites first, so the employees' sites exist when they are saved.
  if (newSites.length) {
    await upsertIntoCollection('locations', newSites);
    await upsertIntoCollection('holders', newHolders);
    step(newSites.length, `Created ${newSites.length} site${newSites.length === 1 ? '' : 's'}`);
  }
  if (newDepartments.length) {
    await upsertIntoCollection('departments', newDepartments);
    step(newDepartments.length, `Created ${newDepartments.length} department${newDepartments.length === 1 ? '' : 's'}`);
  }
  for (let i = 0; i < out.length; i += CHUNK) {
    const part = out.slice(i, i + CHUNK);
    await upsertIntoCollection('users', part);
    step(part.length, `Saving employees ${Math.min(i + CHUNK, out.length)} of ${out.length}`);
  }
  onProgress?.(total, total, 'Done');
  return result;
}
