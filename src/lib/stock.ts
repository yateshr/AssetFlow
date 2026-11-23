/**
 * Stock = assets that are available and held by a site's IT Assets Manager (its stock holder).
 * Deployed equipment (held by a shared holder), assigned assets and assets under repair are not stock.
 */
import type { Asset, Assignment, AssetHistoryEvent } from '@/data/models';
import { currentHolder, type Holder } from './holders';

/** "Keep at least this many of this asset type in stock at this site." */
export interface StockMinimum {
  /** `${siteId}::${type}` */
  id: string;
  siteId: string;
  type: string;
  min: number;
}

export const minimumId = (siteId: string, type: string) => `${siteId}::${type}`;

export interface StockLine {
  siteId: string;
  type: string;
  count: number;
  min: number;
  low: boolean;
}

/** Is this asset sitting in its site's stock, ready to be given out? */
export function isInStock(asset: Asset, holders: Holder[]): boolean {
  if (asset.archivedAt || asset.assignedTo || asset.status !== 'available') return false;
  return currentHolder(asset, holders)?.kind === 'stock';
}

/**
 * One line per site and asset type that has stock or a minimum, most urgent first
 * (low stock before healthy, then by site and type).
 */
export function stockLines(assets: Asset[], holders: Holder[], minimums: StockMinimum[], siteId?: string): StockLine[] {
  const lines = new Map<string, StockLine>();
  const line = (site: string, type: string) => {
    const key = minimumId(site, type);
    let l = lines.get(key);
    if (!l) { l = { siteId: site, type, count: 0, min: 0, low: false }; lines.set(key, l); }
    return l;
  };
  for (const a of assets) {
    if (siteId && a.siteId !== siteId) continue;
    if (isInStock(a, holders)) line(a.siteId, a.type).count++;
  }
  for (const m of minimums) {
    if (siteId && m.siteId !== siteId) continue;
    if (m.min > 0) line(m.siteId, m.type).min = m.min;
  }
  const out = [...lines.values()].map(l => ({ ...l, low: l.min > 0 && l.count < l.min }));
  return out.sort((a, b) => Number(b.low) - Number(a.low) || a.siteId.localeCompare(b.siteId) || a.type.localeCompare(b.type));
}

/** The asset to hand out for a request: the oldest purchase first, so older stock is used before newer. */
export function pickForIssue(assets: Asset[], holders: Holder[], siteId: string, type: string): Asset | undefined {
  return assets
    .filter(a => a.siteId === siteId && a.type === type && isInStock(a, holders))
    .sort((a, b) => (a.purchaseDate || '').localeCompare(b.purchaseDate || '') || a.assetTag.localeCompare(b.assetTag))[0];
}

export interface IssueResult {
  asset: Asset;
  assignment: Assignment;
  history: AssetHistoryEvent;
}

/** What changes when an asset is issued from stock to an employee. */
export function issueFromStock(
  asset: Asset,
  employee: { id: string; name: string },
  holderName: string,
  performedBy: string,
  nextAssignmentNumber: number,
  notes = '',
  now = new Date(),
): IssueResult {
  const iso = now.toISOString();
  return {
    asset: { ...asset, status: 'assigned', assignedTo: employee.id, heldBy: undefined },
    assignment: {
      id: `ASG-${String(nextAssignmentNumber).padStart(3, '0')}`,
      assetId: asset.id, assetName: asset.name, userId: employee.id, userName: employee.name,
      assignedDate: iso.slice(0, 10), status: 'active', notes,
    },
    history: {
      id: `H-${now.getTime()}-ISSUE-${asset.id}`, assetId: asset.id, timestamp: iso, action: 'Assigned', performedBy,
      from: holderName, to: employee.name, userId: employee.id, siteId: asset.siteId, reason: 'Issued from stock', notes,
    },
  };
}
