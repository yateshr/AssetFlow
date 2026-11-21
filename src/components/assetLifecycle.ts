import type {
  Asset,
  AssetHistoryAction,
  AssetHistoryEvent,
  User,
  Assignment,
  AssetStatus,
} from '@/data/models';
import { getCollection } from '@/lib/db';
import { DEFAULT_SYSTEM_POLICY, type SystemPolicy } from '@/data/masterData';

export const custodianName = () => (getCollection<SystemPolicy>('system-policies')[0]||DEFAULT_SYSTEM_POLICY).defaultCustodian;

export function assetStatusLabel(status: AssetStatus): string {
  switch (status) {
    case 'maintenance': return 'Under Repair';
    case 'disposed': return 'Disposed';
    case 'lost': return 'Lost';
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

export function holderName(asset: Asset, users: User[]): string {
  return asset.assignedTo
    ? users.find((user) => user.id === asset.assignedTo)?.name ?? 'Unknown User'
    : custodianName();
}

export function makeHistoryEvent(
  assetId: string,
  action: AssetHistoryAction,
  options: Partial<Omit<AssetHistoryEvent, 'id' | 'assetId' | 'action'>> = {}
): AssetHistoryEvent {
  return {
    id: `H-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    assetId,
    timestamp: new Date().toISOString(),
    action,
    ...options,
  };
}

export function returnAssetsForDepartedUser(
  userId: string,
  assets: Asset[],
  assignments: Assignment[],
  actorName: string,
) {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const returnedAssetIds = new Set(
    assignments
      .filter((a) => a.userId === userId && a.status === 'active')
      .map((a) => a.assetId)
  );

  const nextAssignments = assignments.map((assignment) =>
    assignment.userId === userId && assignment.status === 'active'
      ? { ...assignment, status: 'returned' as const, returnDate: today }
      : assignment
  );

  const nextAssets = assets.map((asset) =>
    returnedAssetIds.has(asset.id)
      ? { ...asset, status: 'available' as const, assignedTo: undefined }
      : asset
  );

  const user = assignments.find((a) => a.userId === userId)?.userName ?? 'Employee';
  const events = [...returnedAssetIds].map((assetId) =>
    makeHistoryEvent(assetId, 'Returned', {
      performedBy: actorName,
      from: user,
      to: custodianName(),
      userId,
      reason: 'Employee left company',
      notes: `Automatically returned to ${custodianName()} after employee departure.`,
    })
  );

  return { nextAssignments, nextAssets, events };
}
