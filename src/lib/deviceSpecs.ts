import { getCollection, upsertIntoCollection } from '@/lib/db';

/**
 * Device specifications, one database row per asset (id = asset id).
 * They used to live in one shared text value, so two people saving different assets
 * could overwrite each other.
 */
export type DeviceSpecRow = { id: string; assetId: string } & Record<string, unknown>;

export const DEVICE_SPECS = 'device-specs';

export function getDeviceSpec(assetId: string): Record<string, unknown> | undefined {
  return getCollection<DeviceSpecRow>(DEVICE_SPECS).find(row => row.assetId === assetId || row.id === assetId);
}

export function getDeviceSpecMap<T = Record<string, unknown>>(): Record<string, T> {
  return Object.fromEntries(getCollection<DeviceSpecRow>(DEVICE_SPECS).map(row => [row.assetId || row.id, row as unknown as T]));
}

export function saveDeviceSpec(assetId: string, spec: Record<string, unknown>) {
  return upsertIntoCollection<DeviceSpecRow>(DEVICE_SPECS, [{ ...spec, assetId, id: assetId }]);
}
