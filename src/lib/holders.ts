/**
 * Asset holders: who is responsible for an asset that is not assigned to an employee.
 * Each site has exactly one holder, the IT Assets Manager (for example "IT Assets Manager – Somnath"):
 * a named account, not a person, that cannot sign in and is not an employee. Everything at the site that
 * is not given to an employee is held by it. Whether an item is in the store or installed somewhere is
 * its status (available or deployed), and where it is installed is its "Where" (Asset.deployedAt).
 */
export type HolderKind = 'stock';

export interface Holder {
  id: string;
  siteId: string;
  kind: HolderKind;
  name: string;
  /** The real person who answers for this holder. */
  responsibleUserId?: string;
  active: boolean;
}

export const stockHolderName = (siteName: string) => `IT Assets Manager – ${siteName}`;

/**
 * When a site is renamed, its holder follows if it still has the automatic name.
 * A name someone typed themselves is left alone. Returns the same array when nothing changes.
 */
export function renameStockHolders(holders: Holder[], siteId: string, oldSiteName: string, newSiteName: string): Holder[] {
  const oldName = stockHolderName(oldSiteName);
  if (oldSiteName === newSiteName || !holders.some(h => h.siteId === siteId && h.name === oldName)) return holders;
  return holders.map(h => (h.siteId === siteId && h.name === oldName ? { ...h, name: stockHolderName(newSiteName) } : h));
}

/** The site's IT Assets Manager: where new and returned assets go. */
export function defaultHolder(holders: Holder[], siteId: string): Holder | undefined {
  return holders.find(h => h.siteId === siteId && h.active !== false);
}

/** Who holds an asset right now: its employee, else its holder, else the site's IT Assets Manager. */
export function currentHolder(
  asset: { assignedTo?: string; heldBy?: string; siteId: string },
  holders: Holder[],
): Holder | undefined {
  if (asset.assignedTo) return undefined;
  return holders.find(h => h.id === asset.heldBy) ?? defaultHolder(holders, asset.siteId);
}
