/**
 * Asset holders: who is responsible for an asset that is not assigned to an employee.
 * A holder is a named account per site (not a person, cannot sign in, not an employee).
 */
export type HolderKind = 'stock' | 'shared' | 'vacant';

export interface Holder {
  id: string;
  siteId: string;
  kind: HolderKind;
  name: string;
  /** The real person who answers for this holder. */
  responsibleUserId?: string;
  active: boolean;
}

export const HOLDER_KIND_LABEL: Record<HolderKind, string> = {
  stock: 'Stock (spares and new assets)',
  shared: 'Shared device or place',
  vacant: 'Vacant desk',
};

export const stockHolderName = (siteName: string) => `IT Assets Manager – ${siteName}`;

/** The site's stock holder: where new and returned assets go. */
export function defaultHolder(holders: Holder[], siteId: string): Holder | undefined {
  return holders.find(h => h.siteId === siteId && h.kind === 'stock' && h.active !== false);
}

/** Who holds an asset right now: its employee, else its holder, else the site's stock holder. */
export function currentHolder(
  asset: { assignedTo?: string; heldBy?: string; siteId: string },
  holders: Holder[],
): Holder | undefined {
  if (asset.assignedTo) return undefined;
  return holders.find(h => h.id === asset.heldBy) ?? defaultHolder(holders, asset.siteId);
}

/** heldBy for an asset after the change: cleared while assigned, otherwise the chosen or default holder. */
export function heldByAfter(
  asset: { assignedTo?: string; siteId: string },
  holders: Holder[],
  chosen?: string,
): string | undefined {
  if (asset.assignedTo) return undefined;
  return chosen ?? defaultHolder(holders, asset.siteId)?.id;
}
