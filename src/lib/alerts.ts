/**
 * Expiry and due-date alerts, computed from live data.
 * One set of rules shared by the notification bell, the Expiry Center page and
 * the dashboard, so they can never disagree.
 */
import type { Asset, Invoice, SoftwareLicense, Vendor } from '@/data/models';
import type { SystemPolicy } from '@/data/masterData';
import type { Holder } from './holders';
import { minimumId, stockLines, type StockMinimum } from './stock';

export type ExpiryKind = 'warranty' | 'amc' | 'insurance' | 'license' | 'seats' | 'contract' | 'invoice' | 'stock';
export type Severity = 'critical' | 'warning' | 'info';
export type ExpiryTarget = 'assets' | 'licenses' | 'vendors' | 'invoices';

export interface ExpiryAlert {
  id: string;
  kind: ExpiryKind;
  title: string;
  subject: string;
  detail: string;
  /** ISO date the item expires / falls due (empty for capacity alerts). */
  date: string;
  /** Days until `date`; negative = already past. */
  days: number;
  severity: Severity;
  target: ExpiryTarget;
}

export const KIND_LABEL: Record<ExpiryKind, string> = {
  warranty: 'Warranty',
  amc: 'AMC / Support',
  insurance: 'Insurance',
  license: 'Software license',
  seats: 'License seats',
  contract: 'Vendor contract',
  invoice: 'Invoice payment',
  stock: 'Low stock',
};

/** Alerts that have no due date (capacity or stock level): they need action now rather than by a day. */
export const isUndated = (alert: Pick<ExpiryAlert, 'date'>) => !alert.date;

const DAY = 86_400_000;
const INACTIVE_ASSET = new Set(['retired', 'disposed', 'lost']);

/** Whole days from today (local midnight) to the given date. NaN if unparseable. */
export function daysUntil(date: string | undefined, now = new Date()): number {
  if (!date) return NaN;
  const target = new Date(date.length <= 10 ? `${date}T00:00:00` : date);
  if (Number.isNaN(target.getTime())) return NaN;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((day.getTime() - today.getTime()) / DAY);
}

export function severityFor(days: number): Severity {
  if (days < 0 || days <= 7) return 'critical';
  if (days <= 30) return 'warning';
  return 'info';
}

export function describeDays(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days < 0 ? `${Math.abs(days)} days ago` : `in ${days} days`;
}

export interface AlertInput {
  assets: Asset[];
  licenses: SoftwareLicense[];
  vendors: Vendor[];
  invoices: Invoice[];
  policy: Pick<SystemPolicy, 'warrantyAlertDays' | 'licenseAlertDays'>;
  /** Optional: site holders and minimum levels, to warn when a site is running low on an asset type. */
  stock?: { holders: Holder[]; minimums: StockMinimum[]; siteName: (id: string) => string; typeName: (id: string) => string };
  now?: Date;
}

export function buildExpiryAlerts({ assets, licenses, vendors, invoices, policy, stock, now = new Date() }: AlertInput): ExpiryAlert[] {
  const out: ExpiryAlert[] = [];

  if (stock) {
    for (const line of stockLines(assets, stock.holders, stock.minimums).filter(l => l.low)) {
      out.push({
        id: `stock-${minimumId(line.siteId, line.type)}`,
        kind: 'stock',
        title: line.count === 0 ? 'Out of stock' : 'Low stock',
        subject: `${stock.typeName(line.type)} • ${stock.siteName(line.siteId)}`,
        detail: `${line.count} in stock, minimum ${line.min}`,
        date: '',
        days: 0,
        severity: line.count === 0 ? 'critical' : 'warning',
        target: 'assets',
      });
    }
  }

  const assetAlert = (asset: Asset, kind: 'warranty' | 'amc' | 'insurance', date: string | undefined, extra: string) => {
    const days = daysUntil(date, now);
    if (!Number.isFinite(days) || days > policy.warrantyAlertDays) return;
    out.push({
      id: `${kind}-${asset.id}`,
      kind,
      title: `${KIND_LABEL[kind]} ${days < 0 ? 'expired' : 'expiring'}`,
      subject: `${asset.assetTag || asset.id} • ${asset.name}`,
      detail: extra,
      date: date!,
      days,
      severity: severityFor(days),
      target: 'assets',
    });
  };

  for (const asset of assets) {
    if (INACTIVE_ASSET.has(asset.status)) continue;
    assetAlert(asset, 'warranty', asset.warrantyExpiry, asset.manufacturer ? `${asset.manufacturer} ${asset.model || ''}`.trim() : 'Warranty');
    if (asset.amcExpiry) assetAlert(asset, 'amc', asset.amcExpiry, asset.amcProvider ? `Provider: ${asset.amcProvider}` : 'AMC contract');
    if (asset.insuranceExpiry) assetAlert(asset, 'insurance', asset.insuranceExpiry, asset.insuranceProvider ? `Insurer: ${asset.insuranceProvider}` : 'Insurance policy');
  }

  for (const license of licenses) {
    const days = daysUntil(license.expiryDate, now);
    if (Number.isFinite(days) && days <= policy.licenseAlertDays) {
      out.push({
        id: `license-${license.id}`,
        kind: 'license',
        title: `License ${days < 0 ? 'expired' : 'expiring'}`,
        subject: license.name,
        detail: `${license.vendor || 'Vendor'} • ${license.usedSeats}/${license.totalSeats} seats used`,
        date: license.expiryDate,
        days,
        severity: severityFor(days),
        target: 'licenses',
      });
    }
    if (license.totalSeats > 0 && license.usedSeats > license.totalSeats) {
      out.push({
        id: `seats-${license.id}`,
        kind: 'seats',
        title: 'License over capacity',
        subject: license.name,
        detail: `${license.usedSeats} seats in use but only ${license.totalSeats} purchased`,
        date: '',
        days: 0,
        severity: 'critical',
        target: 'licenses',
      });
    }
  }

  for (const vendor of vendors) {
    const days = daysUntil(vendor.contractExpiry, now);
    if (!Number.isFinite(days) || days > 60) continue;
    out.push({
      id: `contract-${vendor.id}`,
      kind: 'contract',
      title: `Vendor contract ${days < 0 ? 'expired' : 'expiring'}`,
      subject: vendor.name,
      detail: vendor.contactPerson ? `Contact: ${vendor.contactPerson}` : 'Review or renew the contract',
      date: vendor.contractExpiry!,
      days,
      severity: severityFor(days),
      target: 'vendors',
    });
  }

  for (const invoice of invoices) {
    if (['paid', 'cancelled', 'draft'].includes(invoice.status)) continue;
    const outstanding = invoice.total - invoice.amountPaid;
    if (outstanding <= 0) continue;
    const days = daysUntil(invoice.dueDate, now);
    if (!Number.isFinite(days) || days > 7) continue;
    out.push({
      id: `invoice-${invoice.id}`,
      kind: 'invoice',
      title: days < 0 ? 'Invoice overdue' : 'Invoice due soon',
      subject: invoice.invoiceNumber,
      detail: `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(outstanding)} ${(invoice.currency || '').split(' ')[0]} outstanding`,
      date: invoice.dueDate!,
      days,
      severity: days < 0 ? 'critical' : 'warning',
      target: 'invoices',
    });
  }

  // Most urgent first: already past, then soonest.
  return out.sort((a, b) => a.days - b.days);
}
