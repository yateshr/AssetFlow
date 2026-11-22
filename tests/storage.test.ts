import { beforeEach, describe, expect, it, vi } from 'vitest';
import { kvStore, mockDb, resetStore, rows, seed, setFailures } from './helpers';

vi.mock('@/lib/db', () => mockDb());

import { migrateKvStores } from '@/lib/migrateKv';
import { invoiceBaseTotal } from '@/data/models';
import { masterLabel } from '@/lib/masterLabel';
import { missingAssetCategories } from '@/lib/workbookImport';

beforeEach(() => resetStore());

describe('migrateKvStores', () => {
  it('moves each text value into one record per item and removes the old value', async () => {
    kvStore.set('assetflow-maintenance', JSON.stringify([{ id: 'M1', assetId: 'A1' }, { id: 'M2', assetId: 'A2' }]));
    kvStore.set('assetflow-stock', JSON.stringify([{ id: 'S1', name: 'Dock' }]));
    await migrateKvStores();
    expect(rows('maintenance').map(r => r.id).sort()).toEqual(['M1', 'M2']);
    expect(rows('stock-items')).toHaveLength(1);
    expect(kvStore.has('assetflow-maintenance')).toBe(false);
    expect(kvStore.has('assetflow-stock')).toBe(false);
  });

  it('turns the device-spec map into one record per asset', async () => {
    kvStore.set('assetflow-device-specs', JSON.stringify({ A1: { os: 'Windows 11', ram: '16' }, A2: { os: 'Ubuntu' } }));
    await migrateKvStores();
    const specs = rows('device-specs');
    expect(specs.map(s => s.id).sort()).toEqual(['A1', 'A2']);
    expect(specs.find(s => s.id === 'A1')).toMatchObject({ assetId: 'A1', os: 'Windows 11' });
  });

  it('turns archived assets into archived rows of the assets table, keeping the date', async () => {
    seed('assets', [{ id: 'LIVE', assetTag: 'T1' }]);
    kvStore.set('assetflow-archived-assets', JSON.stringify([{ id: 'OLD', assetTag: 'T2', deletedAt: '2026-01-05T00:00:00Z', deletedBy: 'u1' }]));
    await migrateKvStores();
    const old = rows('assets').find(a => a.id === 'OLD');
    expect(old).toMatchObject({ archivedAt: '2026-01-05T00:00:00Z', archivedBy: 'u1' });
    expect(old.deletedAt).toBeUndefined();
    expect(rows('assets').find(a => a.id === 'LIVE').archivedAt).toBeUndefined();
  });

  it('keeps the old value when saving failed, so nothing is lost', async () => {
    kvStore.set('assetflow-maintenance', JSON.stringify([{ id: 'M1' }]));
    const original = mockDb().pendingWrites;
    setFailures(0);
    // Simulate a failed write: the failure counter increases while the records are being saved.
    const db = await import('@/lib/db');
    const spy = vi.spyOn(db, 'upsertIntoCollection').mockImplementation(async () => { setFailures(1); });
    await migrateKvStores();
    spy.mockRestore();
    expect(kvStore.has('assetflow-maintenance')).toBe(true);
    void original;
  });

  it('is safe to run again and ignores missing or corrupt values', async () => {
    kvStore.set('assetflow-maintenance', 'not json');
    await expect(migrateKvStores()).resolves.toBeUndefined();
    await expect(migrateKvStores()).resolves.toBeUndefined();
    expect(rows('maintenance')).toHaveLength(0);
  });
});

describe('invoiceBaseTotal', () => {
  beforeEach(() => {
    seed('system-policies', [{ id: 'system', defaultCurrency: 'INR', locale: 'en-IN' }]);
    seed('currencies', [{ id: 'USD', name: 'USD - US Dollar', active: true, rate: 83 }, { id: 'EUR', name: 'EUR - Euro', active: true }]);
  });
  it('keeps default-currency invoices as they are', () => expect(invoiceBaseTotal({ total: 1000, currency: 'INR - Indian Rupee' })).toBe(1000));
  it('converts foreign invoices with the configured rate', () => expect(invoiceBaseTotal({ total: 10, currency: 'USD - US Dollar' })).toBe(830));
  it('returns null (not a wrong number) when there is no rate', () => expect(invoiceBaseTotal({ total: 10, currency: 'EUR - Euro' })).toBeNull());
  it('treats an invoice without a currency as the default currency', () => expect(invoiceBaseTotal({ total: 5 })).toBe(5));
});

describe('masterLabel', () => {
  beforeEach(() => seed('location-types', [{ id: 'office', name: 'Office' }, { id: 'e526e1b9-3651-4fe1-9d31-548cfead51c9', name: 'Factory' }]));
  it('shows the name, never the generated id', () => expect(masterLabel('location-types', 'e526e1b9-3651-4fe1-9d31-548cfead51c9')).toBe('Factory'));
  it('falls back to a tidy label for readable ids', () => expect(masterLabel('location-types', 'cold-store')).toBe('Cold store'));
  it('says Unknown for a deleted entry with a generated id', () => expect(masterLabel('location-types', '11111111-2222-3333-4444-555555555555')).toBe('Unknown'));
  it('returns empty for empty input', () => expect(masterLabel('location-types', undefined)).toBe(''));
});

describe('missingAssetCategories (import)', () => {
  it('lists only the types the company does not have, with unique codes', () => {
    seed('asset-categories', [{ id: 'laptop', name: 'Laptop', code: 'LAP', active: true }]);
    const missing = missingAssetCategories({ assets: [{ type: 'laptop' }, { type: 'desktop' }, { type: 'access-point' }, { type: 'access-point' }] as any });
    expect(missing.map(m => m.id)).toEqual(['desktop', 'access-point']);
    expect(missing.find(m => m.id === 'desktop')).toMatchObject({ name: 'Desktop', code: 'DSK' });
    expect(missing.find(m => m.id === 'access-point')).toMatchObject({ name: 'Access Point' });
    expect(new Set(missing.map(m => m.code)).size).toBe(missing.length);
  });
  it('returns nothing when every type exists, even archived ones', () => {
    seed('asset-categories', [{ id: 'laptop', name: 'Laptop', code: 'LAP', active: false }]);
    expect(missingAssetCategories({ assets: [{ type: 'laptop' }] as any })).toEqual([]);
  });
});
