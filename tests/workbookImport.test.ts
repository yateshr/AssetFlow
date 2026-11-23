import * as XLSX from 'xlsx';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDb, resetStore, seed } from './helpers';

vi.mock('@/lib/db', () => mockDb());

import { holderKindFor, parseAssetWorkbooks } from '@/lib/workbookImport';

/** A small register in the same layout as the real one: the Employee sheet starts in column B. */
function workbook(extraEmployeeRows: unknown[][] = []): File {
  const wb = XLSX.utils.book_new();
  const employee = XLSX.utils.aoa_to_sheet(
    [
      ['Sr No', 'Emp. Code', 'Name', 'Location', 'Depertment', 'Desk No', 'Form Index'],
      [1, 3695, 'ASHA RAO', 'SOMNATH', 'ACCOUNT', '', 1],
      [2, '90103-1', 'IT Assets Manager Nahuli', 'NAHULI', 'IT', '', ''],
      [3, 'IT-CAM-001', 'RPP 1 CAMERA', 'SOMNATH', 'IT', '', ''],
      [4, 'Ex-Employee 1', 'Unassigned PC', 'SOMNATH', 'VACANT-DESIGN', '', ''],
      ...extraEmployeeRows,
    ],
    { origin: 'B1' },
  );
  const assets = XLSX.utils.aoa_to_sheet([
    ['Date', '', '', '', ''],
    ['Form No', 'Assets ID', 'Assets Type', 'Description', 'Emp. Code', 'Location', 'Emp Name', 'Depertment'],
    ['', 'NP-IT-CPU-B0001', 'CPU', 'Office PC', 3695, 'SOMNATH', 'ASHA RAO', 'ACCOUNT'],
    ['', 'NP-IT-MOU-B0002', 'Mouse', 'Spare mouse', '90103-1', 'NAHULI', '', ''],
    ['', 'NP-IT-CAM-B0003', 'Camera', 'Gate camera', 'IT-CAM-001', 'SOMNATH', '', ''],
    ['', 'NP-IT-CPU-B0004', 'CPU', 'Old PC', 'Ex-Employee 1', 'SOMNATH', '', ''],
  ]);
  const allocation = XLSX.utils.aoa_to_sheet([
    ['', '', '', '', "Today's"],
    ['SrNo', 'Form No', 'Emp. Code', 'Assets Id', 'Description', 'Emp. Name', 'Allocation Date', 'Exp. Ret. Date', 'Issue Date', 'Actual Return Date'],
    [1, 1, 3695, 'NP-IT-CPU-B0001', 'Office PC', 'ASHA RAO', '2025-03-31', '', '2025-03-31', ''],
    [2, 2, '90103-1', 'NP-IT-MOU-B0002', 'Spare mouse', 'IT Assets Manager Nahuli', '2025-04-01', '', '2025-04-01', ''],
    [3, 3, 'IT-CAM-001', 'NP-IT-CAM-B0003', 'Gate camera', 'RPP 1 CAMERA', '2025-04-02', '', '2025-04-02', ''],
    [4, 4, 'Ex-Employee 1', 'NP-IT-CPU-B0004', 'Old PC', 'Unassigned PC', '2025-04-03', '', '2025-04-03', ''],
  ]);
  XLSX.utils.book_append_sheet(wb, employee, 'Employee');
  XLSX.utils.book_append_sheet(wb, assets, 'Asset_List');
  XLSX.utils.book_append_sheet(wb, allocation, 'Allocation');
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([bytes], 'register.xlsx');
}

beforeEach(() => { resetStore(); seed('system-policies', [{ id: 'system', defaultCurrency: 'INR', locale: 'en-IN' }]); });

describe('holderKindFor', () => {
  it('recognises the stock account, shared places and vacant desks', () => {
    expect(holderKindFor('90103-1', 'IT Assets Manager Nahuli', 'IT')).toBe('stock');
    expect(holderKindFor('IT SPARE', 'IT STAND BY', 'IT')).toBe('stock');
    expect(holderKindFor('IT HO', 'IT HO', 'IT HO')).toBe('stock');
    expect(holderKindFor('IT-CAM-001', 'RPP 1 CAMERA', 'IT')).toBe('deployed');
    expect(holderKindFor('IT01', 'IIOT MACHINE PC', 'IT')).toBe('deployed');
    expect(holderKindFor('Ex-Employee 3', 'Unassigned PC', 'VACANT-ACCOUNT')).toBe('vacant');
    expect(holderKindFor('INACTIVE USER', 'USER INACTIVE', 'LEFT')).toBe('vacant');
  });
  it('treats real people as people', () => {
    expect(holderKindFor('3695', 'ASHA RAO', 'ACCOUNT')).toBeNull();
    expect(holderKindFor('6201', 'PARMAR TEJAS', 'DESIGN')).toBeNull();
  });
});

describe('workbook import', () => {
  it('reads the Employee sheet correctly even though it starts in column B', async () => {
    const r = await parseAssetWorkbooks([workbook()]);
    expect(r.users.map(u => u.name)).toEqual(['ASHA RAO']);
    expect(r.users[0]).toMatchObject({ department: 'ACCOUNT' });
    expect(r.assignments).toHaveLength(1);
    expect(r.assets.find(a => a.assetTag === 'NP-IT-CPU-B0001')).toMatchObject({ status: 'assigned' });
  });

  it('keeps only the site manager account as a holder; cameras and vacant desks are not holders or employees', async () => {
    const r = await parseAssetWorkbooks([workbook()]);
    expect(r.holders.map(h => h.kind + ':' + h.name)).toContain('stock:IT Assets Manager Nahuli');
    expect(r.holders.every(h => h.kind === 'stock')).toBe(true);
    expect(r.holders.some(h => /CAMERA|Vacant|Unassigned/i.test(h.name))).toBe(false);
    expect(r.users.some(u => /Manager|CAMERA|Unassigned/i.test(u.name))).toBe(false);
  });

  it('imports installed equipment as deployed with its place, and spares and vacant desks as stock', async () => {
    const r = await parseAssetWorkbooks([workbook()]);
    const by = (tag: string) => r.assets.find(a => a.assetTag === tag)!;
    const holderName = (tag: string) => r.holders.find(h => h.id === by(tag).heldBy)?.name;
    // the spare mouse is stock held by the site's IT Assets Manager
    expect(by('NP-IT-MOU-B0002')).toMatchObject({ status: 'available' });
    expect(holderName('NP-IT-MOU-B0002')).toBe('IT Assets Manager Nahuli');
    // the gate camera is deployed at its place and held by the same kind of account
    expect(by('NP-IT-CAM-B0003')).toMatchObject({ status: 'deployed', deployedAt: 'RPP 1 CAMERA' });
    expect(by('NP-IT-CAM-B0003').heldBy).toBeTruthy();
    // an old PC on a vacant desk goes back to stock
    expect(by('NP-IT-CPU-B0004')).toMatchObject({ status: 'available', deployedAt: undefined });
    expect(by('NP-IT-CPU-B0004').heldBy).toBeTruthy();
    expect(by('NP-IT-CPU-B0001').heldBy).toBeUndefined();
  });

  it('gives every site that has unassigned assets a stock holder', async () => {
    const r = await parseAssetWorkbooks([workbook()]);
    const somnath = r.locations.find(l => /SOMNATH/i.test(l.name))!;
    expect(r.holders.some(h => h.siteId === somnath.id && h.kind === 'stock')).toBe(true);
  });

  it('keeps only one stock holder per site and moves a second stock-looking row to the first', async () => {
    const r = await parseAssetWorkbooks([workbook([[5, 'IT SPARE', 'IT STAND BY', 'NAHULI', 'IT', '', '']])]);
    const nahuli = r.locations.find(l => /NAHULI/i.test(l.name))!;
    const here = r.holders.filter(h => h.siteId === nahuli.id);
    expect(here).toHaveLength(1);
    expect(here[0].kind).toBe('stock');
  });
});
