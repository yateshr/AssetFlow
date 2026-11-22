import { getCollection } from '@/lib/db';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

/**
 * Readable name for a value that is stored as a master-data id (site type, license type,
 * call category, asset type…). Ids are not meant to be shown: custom entries have
 * generated ids, so always look the name up.
 */
export function masterLabel(collection: string, id: string | undefined | null): string {
  if (!id) return '';
  const hit = getCollection<{ id: string; name?: string }>(collection).find(item => item.id === id);
  if (hit?.name?.trim()) return hit.name;
  if (UUID.test(id)) return 'Unknown';
  return id.replace(/[-_]+/g, ' ').replace(/^./, c => c.toUpperCase());
}
