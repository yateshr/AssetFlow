import * as XLSX from 'xlsx';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDb, resetStore, rows, seed } from './helpers';

vi.mock('@/lib/db', () => mockDb());

import { applyEmployeeImport, duplicateRows, EMPLOYEE_TEMPLATE_HEADERS, importLog, notImported, planEmployeeImport } from '@/lib/employeeImport';

const file = (data: unknown[][], sheet = 'Employees', origin?: string) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data, (origin ? { origin } : undefined) as any), sheet);
  return new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer], 'employees.xlsx');
};
const H = [...EMPLOYEE_TEMPLATE_HEADERS];

beforeEach(() => {
  resetStore();
  seed('locations', [{ id: 'LOC-001', name: 'Somnath', address: '', type: 'office', capacity: 0, manager: '' }]);
  seed('departments', [{ id: 'D1', name: 'DISPATCH', siteId: 'LOC-001' }]);
  seed('users', []);
});

describe('template headers', () => {
  it('are fixed', () => expect(H).toEqual(['Sr.No.', 'Employee Code', 'Employee Name', 'Site', 'Department']));
  it('reports missing headers and imports nothing', async () => {
    const plan = await planEmployeeImport(file([['Code', 'Name', 'Site'], ['1', 'A', 'S']]));
    expect(plan.missingHeaders).toEqual(['Employee Name', 'Department']);
    expect(plan.rows).toHaveLength(0);
  });
  it('accepts headers in any order, any case, extra columns, and the Sr.No. column missing', async () => {
    const plan = await planEmployeeImport(file([['department', 'EXTRA', 'site', 'employee name', 'CODE'], ['DISPATCH', 'x', 'Somnath', 'Asha Rao', '1001']]));
    expect(plan.missingHeaders).toEqual([]);
    expect(plan.rows[0]).toMatchObject({ code: '1001', name: 'Asha Rao', site: 'Somnath', department: 'DISPATCH', action: 'new' });
  });
  it('reads a sheet whose used range starts in column B', async () => {
    const plan = await planEmployeeImport(file([H, [1, '1001', 'Asha Rao', 'Somnath', 'DISPATCH']], 'Employees', 'B1'));
    expect(plan.missingHeaders).toEqual([]);
    expect(plan.rows[0].code).toBe('1001');
  });
  it('falls back to the first sheet when there is no Employees sheet', async () => {
    const plan = await planEmployeeImport(file([H, [1, '1001', 'Asha Rao', 'Somnath', 'DISPATCH']], 'Sheet1'));
    expect(plan.rows).toHaveLength(1);
  });
});

describe('planning', () => {
  it('flags empty cells, duplicate codes and sample rows', async () => {
    const plan = await planEmployeeImport(file([H, [1, '', 'No Code', 'Somnath', 'DISPATCH'], [2, '2', 'A', 'Somnath', 'DISPATCH'], [3, '2', 'B', 'Somnath', 'DISPATCH'], [4, 'SAMPLE-001', 'Sample', 'Somnath', 'DISPATCH'], [5, '5', 'No Dept', 'Somnath', '']]));
    const by = (line: number) => plan.rows.find(r => r.line === line)!;
    expect(by(2).problems).toContain('Employee Code is empty');
    // A repeated ID cannot be trusted, so every row that uses it is held back.
    expect(by(3).action).toBe('error');
    expect(by(3).problems.join()).toMatch(/Duplicate ID 2: also on row 4/);
    expect(by(4).problems.join()).toMatch(/Duplicate ID 2: also on row 3/);
    expect(by(5).problems.join()).toMatch(/Sample row/);
    expect(by(6).problems).toContain('Department is empty');
  });
  it('ignores blank rows and trims spaces', async () => {
    const plan = await planEmployeeImport(file([H, [], [1, ' 1001 ', '  Asha   Rao ', ' somnath ', ' DISPATCH ']]));
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]).toMatchObject({ code: '1001', name: 'Asha Rao', action: 'new' });
  });
  it('matches sites ignoring case and lists new sites and departments', async () => {
    const plan = await planEmployeeImport(file([H, [1, '1', 'A', 'SOMNATH', 'DISPATCH'], [2, '2', 'B', 'SOMNATH', 'QUALITY'], [3, '3', 'C', 'Nahuli', 'STORE'], [4, '4', 'D', 'NAHULI', 'STORE']]));
    expect(plan.newSites).toEqual(['Nahuli']);
    expect(plan.newDepartments.map(d => `${d.site}/${d.name}`).sort()).toEqual(['Nahuli/STORE', 'SOMNATH/QUALITY']);
  });
  it('tells new, changed and unchanged employees apart by code', async () => {
    seed('users', [
      { id: 'EMP-1', employeeId: '1', name: 'Same Person', department: 'DISPATCH', siteId: 'LOC-001', email: 'a@x', role: 'user' },
      { id: 'EMP-2', employeeId: '2', name: 'Old Name', department: 'DISPATCH', siteId: 'LOC-001', email: 'b@x', role: 'user' },
    ]);
    const plan = await planEmployeeImport(file([H, [1, '1', 'Same Person', 'Somnath', 'DISPATCH'], [2, '2', 'New Name', 'Somnath', 'DISPATCH'], [3, '3', 'Brand New', 'Somnath', 'DISPATCH']]));
    expect(plan.rows.map(r => r.action)).toEqual(['unchanged', 'update', 'new']);
  });
});

describe('not imported list and log', () => {
  const messy = () => file([H, [1, '1', 'Good', 'Somnath', 'DISPATCH'], [2, '2', 'Twin', 'Somnath', 'DISPATCH'], [3, '2', 'Twin Again', 'Somnath', 'HR'], [4, '4', '', 'Somnath', 'HR']]);
  it('lists exactly the rows that are held back, with their original row numbers and values', async () => {
    const plan = await planEmployeeImport(messy());
    const missed = notImported(plan);
    expect(missed.map(r => r.line)).toEqual([3, 4, 5]);
    expect(missed.map(r => r.srNo)).toEqual(['2', '3', '4']);
    expect(duplicateRows(plan).map(r => r.line)).toEqual([3, 4]);
  });
  it('writes a console-style log with one line per problem', async () => {
    const plan = await planEmployeeImport(messy());
    const log = importLog(plan);
    expect(log[0]).toMatch(/^\$ assetflow import/);
    expect(log.filter(l => l.startsWith('[warn]'))).toHaveLength(2); // duplicates
    expect(log.filter(l => l.startsWith('[fail]'))).toHaveLength(1); // missing name
    expect(log.some(l => /Employee Name is empty/.test(l))).toBe(true);
    expect(log.at(-1)).toMatch(/will be skipped/);
    const done = importLog(plan, { created: 1, updated: 0, skipped: 3, sitesCreated: 0, departmentsCreated: 0 });
    expect(done.at(-1)).toBe('[done] 1 added, 0 updated, 3 not imported');
  });
  it('explains a header mismatch in the log', async () => {
    const plan = await planEmployeeImport(file([['Code', 'Name'], ['1', 'A']]));
    expect(importLog(plan).some(l => l.startsWith('[fail]') && /Missing: Employee Name, Site, Department/.test(l))).toBe(true);
  });
  it('still creates the department when the employee is already there', async () => {
    seed('users', [{ id: 'U9', employeeId: '1001', name: 'Asha Rao', department: 'STORES', siteId: 'LOC-001', role: 'user', status: 'active', email: '', phone: '', joinDate: '' }]);
    const plan = await planEmployeeImport(file([H, [1, '1001', 'Asha Rao', 'Somnath', 'STORES']]));
    expect(plan.rows[0].action).toBe('unchanged');
    await applyEmployeeImport(plan, { createMissingSites: false });
    expect(rows('departments').some(d => d.name === 'STORES' && d.siteId === 'LOC-001')).toBe(true);
  });
  it('reports progress while saving', async () => {
    seed('users', []);
    const many = Array.from({ length: 250 }, (_, i) => [i + 1, String(1000 + i), 'P' + i, 'Somnath', 'DISPATCH']);
    const plan = await planEmployeeImport(file([H, ...many]));
    const steps: Array<[number, number]> = [];
    await applyEmployeeImport(plan, { createMissingSites: false }, (done, total) => steps.push([done, total]));
    expect(steps[0][0]).toBe(0);
    expect(steps.at(-1)).toEqual([steps.at(-1)![1], steps.at(-1)![1]]);
    expect(steps.length).toBeGreaterThanOrEqual(4); // start, 3 chunks (+ department), done
  });
});

describe('applying', () => {
  it('creates employees with the template values and safe defaults', async () => {
    const plan = await planEmployeeImport(file([H, [1, '1001', 'Asha Rao', 'Somnath', 'DISPATCH']]));
    const result = await applyEmployeeImport(plan, { createMissingSites: false });
    expect(result).toMatchObject({ created: 1, updated: 0, skipped: 0 });
    expect(rows('users')[0]).toMatchObject({ id: 'EMP-1001', employeeId: '1001', name: 'Asha Rao', department: 'DISPATCH', siteId: 'LOC-001', role: 'user', status: 'active' });
  });

  it('updates an existing employee without touching role, email or status', async () => {
    seed('users', [{ id: 'U9', employeeId: '1001', name: 'Old', department: 'HR', siteId: 'LOC-001', email: 'keep@x.y', role: 'manager', status: 'active', phone: '99' }]);
    const plan = await planEmployeeImport(file([H, [1, '1001', 'New Name', 'Somnath', 'DISPATCH']]));
    await applyEmployeeImport(plan, { createMissingSites: false });
    expect(rows('users')).toHaveLength(1);
    expect(rows('users')[0]).toMatchObject({ id: 'U9', name: 'New Name', department: 'DISPATCH', email: 'keep@x.y', role: 'manager', phone: '99' });
  });

  it('creates missing sites (with a stock holder) and departments only when allowed', async () => {
    const data = file([H, [1, '1', 'A', 'Nahuli', 'STORE']]);
    const refused = await applyEmployeeImport(await planEmployeeImport(data), { createMissingSites: false });
    expect(refused).toMatchObject({ created: 0, skipped: 1, sitesCreated: 0 });
    expect(rows('locations')).toHaveLength(1);

    const done = await applyEmployeeImport(await planEmployeeImport(data), { createMissingSites: true });
    expect(done).toMatchObject({ created: 1, sitesCreated: 1, departmentsCreated: 1 });
    const site = rows('locations').find(l => l.name === 'Nahuli');
    expect(site).toBeTruthy();
    expect(rows('holders').some(h => h.siteId === site.id && h.kind === 'stock')).toBe(true);
    expect(rows('users')[0].siteId).toBe(site.id);
  });

  it('skips rows with problems and imports the rest', async () => {
    const plan = await planEmployeeImport(file([H, [1, '1', 'Good', 'Somnath', 'DISPATCH'], [2, '', 'Bad', 'Somnath', 'DISPATCH']]));
    const result = await applyEmployeeImport(plan, { createMissingSites: false });
    expect(result).toMatchObject({ created: 1, skipped: 1 });
  });

  it('gives different employees different ids even when their codes look alike', async () => {
    const plan = await planEmployeeImport(file([H, [1, 'A-1', 'One', 'Somnath', 'DISPATCH'], [2, 'A 1', 'Two', 'Somnath', 'DISPATCH']]));
    await applyEmployeeImport(plan, { createMissingSites: false });
    expect(new Set(rows('users').map(u => u.id)).size).toBe(2);
  });
});
