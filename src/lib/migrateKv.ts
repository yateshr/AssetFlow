/**
 * One-time move of data that used to be saved as a single text value per kind
 * (maintenance, stock, infrastructure, requests, device specs, archived assets) into
 * one database row per record. Safe to run on every sign-in: a value is removed only after
 * its records were saved, and a missing value is simply skipped.
 */
import { kv, pendingWrites, saveFailureCount, upsertIntoCollection } from '@/lib/db';
import type { Asset } from '@/data/models';

type Doc = { id: string };

const arrayStores: Array<{ key: string; collection: string }> = [
  { key: 'assetflow-maintenance', collection: 'maintenance' },
  { key: 'assetflow-stock', collection: 'stock-items' },
  { key: 'assetflow-stock-movements', collection: 'stock-movements' },
  { key: 'assetflow-infrastructure', collection: 'infrastructure' },
  { key: 'assetflow-asset-requests', collection: 'asset-requests' },
];

function parse<T>(key: string): T | null {
  const raw = kv.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

export async function migrateKvStores(): Promise<void> {
  for (const { key, collection } of arrayStores) {
    const items = parse<Doc[]>(key);
    if (items === null) continue;
    const before = saveFailureCount();
    await upsertIntoCollection(collection, items.filter(item => item && item.id));
    await pendingWrites();
    if (saveFailureCount() === before) kv.removeItem(key);
  }

  const specs = parse<Record<string, Record<string, unknown>>>('assetflow-device-specs');
  if (specs !== null) {
    const before = saveFailureCount();
    await upsertIntoCollection('device-specs', Object.entries(specs).map(([assetId, spec]) => ({ ...spec, assetId, id: assetId })));
    await pendingWrites();
    if (saveFailureCount() === before) kv.removeItem('assetflow-device-specs');
  }

  const archived = parse<Array<Asset & { deletedAt?: string; deletedBy?: string }>>('assetflow-archived-assets');
  if (archived !== null) {
    const before = saveFailureCount();
    await upsertIntoCollection('assets', archived.filter(a => a && a.id).map(({ deletedAt, deletedBy, ...asset }) => ({ ...asset, archivedAt: deletedAt || new Date().toISOString(), archivedBy: deletedBy })));
    await pendingWrites();
    if (saveFailureCount() === before) kv.removeItem('assetflow-archived-assets');
  }
}
