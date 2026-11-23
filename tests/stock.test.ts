import { describe, expect, it } from 'vitest';
import type { Asset } from '@/data/models';
import { buildExpiryAlerts, isUndated } from '@/lib/alerts';
import { currentHolder, renameStockHolders, type Holder } from '@/lib/holders';
import { deployAsset, deployedPlaces, isInStock, issueFromStock, minimumId, pickForIssue, returnToStock, stockLines, type StockMinimum } from '@/lib/stock';

const holders: Holder[] = [
  { id: 'H-S', siteId: 'S1', kind: 'stock', name: 'IT Assets Manager – Somnath', active: true },
  { id: 'H-M', siteId: 'S2', kind: 'stock', name: 'IT Assets Manager – Mumbai', active: true },
];

const asset = (id: string, over: Partial<Asset> = {}): Asset => ({
  id, name: `Item ${id}`, type: 'mouse', manufacturer: '', model: '', serialNumber: id, assetTag: `T-${id}`, status: 'available',
  purchaseDate: '2025-01-01', purchasePrice: 0, warrantyExpiry: '', siteId: 'S1', heldBy: 'H-S', ...over,
});

describe('renaming a site', () => {
  it('renames the holder when it still has the automatic name', () => {
    const out = renameStockHolders(holders, 'S1', 'Somnath', 'Somnath Plant');
    expect(out.find(h => h.id === 'H-S')?.name).toBe('IT Assets Manager – Somnath Plant');
    expect(out.find(h => h.id === 'H-M')?.name).toBe('IT Assets Manager – Mumbai');
  });
  it('leaves a holder alone when someone gave it their own name', () => {
    const custom: Holder[] = [{ id: 'H-X', siteId: 'S1', kind: 'stock', name: 'Somnath IT Store', active: true }];
    expect(renameStockHolders(custom, 'S1', 'Somnath', 'Somnath Plant')).toBe(custom);
  });
  it('does nothing when the name is unchanged', () => {
    expect(renameStockHolders(holders, 'S1', 'Somnath', 'Somnath')).toBe(holders);
  });
});

describe('who holds an asset', () => {
  it('is the site IT Assets Manager unless the asset is assigned to an employee', () => {
    expect(currentHolder(asset('1'), holders)?.id).toBe('H-S');
    expect(currentHolder(asset('2', { heldBy: undefined }), holders)?.id).toBe('H-S');
    expect(currentHolder(asset('3', { assignedTo: 'u1', heldBy: undefined }), holders)).toBeUndefined();
  });
});

describe('what counts as stock', () => {
  it('is an available asset that is not assigned', () => {
    expect(isInStock(asset('1'))).toBe(true);
  });
  it('excludes assigned, deployed, under repair and archived assets', () => {
    expect(isInStock(asset('1', { assignedTo: 'u1', status: 'assigned', heldBy: undefined }))).toBe(false);
    expect(isInStock(asset('2', { status: 'maintenance' }))).toBe(false);
    expect(isInStock(asset('3', { archivedAt: '2025-02-01' }))).toBe(false);
    expect(isInStock(asset('4', { type: 'camera', status: 'deployed', deployedAt: 'Gate 1' }))).toBe(false);
  });
});

describe('stock lines', () => {
  const assets = [asset('1'), asset('2'), asset('3', { type: 'keyboard' }), asset('4', { siteId: 'S2', heldBy: 'H-M' }), asset('5', { type: 'camera', status: 'deployed', deployedAt: 'Gate 1' })];

  it('counts per site and type', () => {
    const lines = stockLines(assets, []);
    expect(lines.find(l => l.siteId === 'S1' && l.type === 'mouse')?.count).toBe(2);
    expect(lines.find(l => l.siteId === 'S1' && l.type === 'keyboard')?.count).toBe(1);
    expect(lines.find(l => l.siteId === 'S2' && l.type === 'mouse')?.count).toBe(1);
    expect(lines.some(l => l.type === 'camera')).toBe(false);
  });

  it('flags low stock against the minimum and lists it first', () => {
    const minimums: StockMinimum[] = [{ id: minimumId('S1', 'keyboard'), siteId: 'S1', type: 'keyboard', min: 2 }, { id: minimumId('S1', 'mouse'), siteId: 'S1', type: 'mouse', min: 2 }];
    const lines = stockLines(assets, minimums, 'S1');
    expect(lines[0]).toMatchObject({ type: 'keyboard', count: 1, min: 2, low: true });
    expect(lines.find(l => l.type === 'mouse')).toMatchObject({ low: false });
  });

  it('shows a type with a minimum but no stock as low (zero on hand)', () => {
    expect(stockLines([], [{ id: minimumId('S1', 'monitor'), siteId: 'S1', type: 'monitor', min: 1 }])).toEqual([{ siteId: 'S1', type: 'monitor', count: 0, min: 1, low: true }]);
  });

  it('ignores a minimum of zero', () => {
    expect(stockLines([], [{ id: minimumId('S1', 'monitor'), siteId: 'S1', type: 'monitor', min: 0 }])).toEqual([]);
  });
});

describe('low stock alerts', () => {
  const input = (assets: Asset[], minimums: StockMinimum[]) => ({
    assets, licenses: [], vendors: [], invoices: [], policy: { warrantyAlertDays: 90, licenseAlertDays: 60 },
    stock: { minimums, siteName: (id: string) => (id === 'S1' ? 'Somnath' : id), typeName: (id: string) => id },
  });

  it('raises a warning when stock is under the minimum, with no due date', () => {
    const alerts = buildExpiryAlerts(input([asset('1')], [{ id: minimumId('S1', 'mouse'), siteId: 'S1', type: 'mouse', min: 3 }]));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ kind: 'stock', title: 'Low stock', subject: 'mouse • Somnath', detail: '1 in stock, minimum 3', severity: 'warning', date: '' });
    expect(isUndated(alerts[0])).toBe(true);
  });
  it('is critical when nothing is left', () => {
    expect(buildExpiryAlerts(input([], [{ id: minimumId('S1', 'monitor'), siteId: 'S1', type: 'monitor', min: 1 }]))[0]).toMatchObject({ title: 'Out of stock', severity: 'critical' });
  });
  it('does not count deployed equipment as stock', () => {
    const alerts = buildExpiryAlerts(input([asset('1', { status: 'deployed', deployedAt: 'Gate 1' })], [{ id: minimumId('S1', 'mouse'), siteId: 'S1', type: 'mouse', min: 1 }]));
    expect(alerts[0]).toMatchObject({ title: 'Out of stock' });
  });
  it('stays quiet when stock meets the minimum or no minimum is set', () => {
    expect(buildExpiryAlerts(input([asset('1'), asset('2')], [{ id: minimumId('S1', 'mouse'), siteId: 'S1', type: 'mouse', min: 2 }]))).toEqual([]);
    expect(buildExpiryAlerts(input([asset('1')], []))).toEqual([]);
  });
});

describe('issuing from stock', () => {
  it('picks the oldest purchase first and only from the same site and type', () => {
    const list = [asset('new', { purchaseDate: '2025-06-01' }), asset('old', { purchaseDate: '2024-01-01' }), asset('other', { siteId: 'S2', heldBy: 'H-M', purchaseDate: '2023-01-01' }), asset('cam', { status: 'deployed', deployedAt: 'Gate', purchaseDate: '2020-01-01' })];
    expect(pickForIssue(list, 'S1', 'mouse')?.id).toBe('old');
    expect(pickForIssue(list, 'S1', 'monitor')).toBeUndefined();
  });

  it('assigns the asset, clears its holder and records the hand-over', () => {
    const r = issueFromStock(asset('1'), { id: 'u1', name: 'Asha Rao' }, 'IT Assets Manager – Somnath', 'admin', 7, 'for desk 4', new Date('2025-03-01T10:00:00Z'));
    expect(r.asset).toMatchObject({ status: 'assigned', assignedTo: 'u1', heldBy: undefined });
    expect(r.assignment).toMatchObject({ id: 'ASG-007', assetId: '1', userId: 'u1', status: 'active', assignedDate: '2025-03-01' });
    expect(r.history).toMatchObject({ action: 'Assigned', from: 'IT Assets Manager – Somnath', to: 'Asha Rao', reason: 'Issued from stock' });
  });
});

describe('deploying and returning to stock', () => {
  it('marks an available asset as deployed at a place, and it leaves the stock count', () => {
    const r = deployAsset(asset('1'), '  Server room ', 'admin', 'new rack', new Date('2025-03-01T10:00:00Z'));
    expect(r.asset).toMatchObject({ status: 'deployed', deployedAt: 'Server room', heldBy: 'H-S' });
    expect(r.history).toMatchObject({ action: 'Status Changed', from: 'available', to: 'deployed at Server room', reason: 'Deployed', notes: 'new rack' });
    expect(isInStock(r.asset)).toBe(false);
  });

  it('records a change of place', () => {
    const r = deployAsset(asset('1', { status: 'deployed', deployedAt: 'Gate 1' }), 'Gate 2', 'admin');
    expect(r.asset.deployedAt).toBe('Gate 2');
    expect(r.history).toMatchObject({ from: 'deployed at Gate 1', to: 'deployed at Gate 2', reason: 'Deployed place changed' });
  });

  it('returns a deployed asset to stock and clears its place', () => {
    const r = returnToStock(asset('1', { status: 'deployed', deployedAt: 'Gate 1' }), 'admin');
    expect(r.asset).toMatchObject({ status: 'available', deployedAt: undefined });
    expect(r.history).toMatchObject({ from: 'deployed at Gate 1', to: 'available', reason: 'Returned to stock' });
    expect(isInStock(r.asset)).toBe(true);
  });

  it('lists the places already used at a site', () => {
    const list = [asset('1', { status: 'deployed', deployedAt: 'Server room' }), asset('2', { status: 'deployed', deployedAt: 'Gate 1' }), asset('3', { status: 'deployed', deployedAt: 'Server room' }), asset('4', { siteId: 'S2', status: 'deployed', deployedAt: 'Lobby' }), asset('5')];
    expect(deployedPlaces(list, 'S1')).toEqual(['Gate 1', 'Server room']);
  });
});
