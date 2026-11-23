import { getCollection } from '@/lib/db';
import { DEFAULT_SYSTEM_POLICY, type SystemPolicy } from './masterData';

// Types
/** available = in stock; deployed = installed at a place on site (see Asset.deployedAt); assigned = held by an employee. */
export type AssetStatus = 'available' | 'assigned' | 'deployed' | 'maintenance' | 'retired' | 'disposed' | 'lost';
export type AssetType = string;
export interface AssetCategory { id: string; name: string; code?: string; active: boolean; }
export type AssignmentStatus = 'active' | 'returned' | 'pending';
export type InvoiceStatus = 'draft' | 'open' | 'received' | 'partially-received' | 'paid' | 'partially-paid' | 'overdue' | 'cancelled';
export type UserRole = 'super_admin' | 'admin' | 'manager' | 'user';
export type UserStatus = 'active' | 'inactive' | 'left';

export interface Company {
  id: string;
  name: string;
  legalName?: string;
  code: string;
  defaultCurrency: string;
  timezone: string;
  registeredAddress?: string;
  registeredCountry?: string;
  registeredState?: string;
  registeredCity?: string;
  billingAddress?: string;
  taxId?: string;
  contactEmail?: string;
  contactPhone?: string;
  primarySiteId?: string;
  active: boolean;
  accessRole?: string;
}

export interface CompanyAccessGrant {
  id: string;
  companyId: string;
  email: string;
  role: 'admin' | 'manager' | 'technician' | 'viewer';
  siteId?: string;
  active: boolean;
}

export interface TransferRequest {
  id: string;
  requestType: 'asset' | 'employee';
  sourceCompanyId: string;
  sourceSiteId?: string;
  targetCompanyId: string;
  targetSiteId?: string;
  targetDepartment?: string;
  entityId: string;
  reason: string;
  requestedAssetTag?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedAt: string;
  decisionNote?: string;
}

export interface SiteArea {
  id: string;
  siteId: string;
  parentId?: string;
  name: string;
  type: 'building' | 'floor' | 'room' | 'zone' | 'rack';
  code?: string;
}

export interface CompanySummary {
  companyId: string;
  companyName: string;
  companyCode: string;
  sites: number;
  users: number;
  assets: number;
  assigned: number;
  maintenance: number;
  assetValue: number;
  openCalls: number;
  invoiceTotal: number;
}

export type AssetHistoryAction =
  | 'Purchased'
  | 'Received'
  | 'Assigned'
  | 'Returned'
  | 'Transferred'
  | 'Under Repair'
  | 'Repair Completed'
  | 'Moved'
  | 'Status Changed'
  | 'Retired'
  | 'Disposed'
  | 'Lost'
  | 'Found'
  | 'Archived'
  | 'Restored'
  | 'Updated';
export type ItCallStatus = 'open' | 'in-progress' | 'resolved' | 'closed';
export type ItCallPriority = string;
export type ItCallCategory = string;

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  manufacturer: string;
  model: string;
  serialNumber: string;
  assetTag: string;
  status: AssetStatus;
  purchaseDate: string;
  purchasePrice: number;
  warrantyExpiry: string;
  condition?: 'new' | 'good' | 'fair' | 'damaged';
  accessories?: string;
  amcProvider?: string;
  amcExpiry?: string;
  insuranceProvider?: string;
  insuranceExpiry?: string;
  siteId: string;
  assignedTo?: string;
  vendorId?: string;
  invoiceId?: string;
  invoiceItemId?: string;
  notes?: string;
  /** Set when the asset is archived. Archived assets stay in the assets table (so reports, tag and serial checks still see them) but are hidden from the active list. */
  archivedAt?: string;
  archivedBy?: string;
  /** Holder (see lib/holders) while the asset is not assigned to an employee: always the site's IT Assets Manager. */
  heldBy?: string;
  /** Where a deployed asset is installed, for example "Server room" or "Gate 1". Only set while status is deployed. */
  deployedAt?: string;
}

export interface User {
  id: string;
  employeeId?: string;
  name: string;
  email: string;
  department: string;
  siteId: string;
  role: UserRole;
  phone: string;
  joinDate: string;
  avatar?: string;
  status: UserStatus;
}

export interface AssetHistoryEvent {
  id: string;
  assetId: string;
  timestamp: string;
  action: AssetHistoryAction;
  performedBy?: string;
  from?: string;
  to?: string;
  userId?: string;
  siteId?: string;
  reason?: string;
  notes?: string;
  cost?: number;
  entityType?: string;
  source?: string;
  beforeValue?: string;
  afterValue?: string;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  type: string;
  capacity: number;
  manager: string;
  country?: string;
  state?: string;
  city?: string;
  siteCode?: string;
  building?: string;
  timezone?: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  website: string;
  category?: string; // legacy; vendors can supply both hardware and software, so it is no longer asked for
  address?: string;
  taxId?: string;
  currency?: string;
  contractExpiry?: string;
}

export interface Assignment {
  id: string;
  assetId: string;
  assetName: string;
  userId: string;
  userName: string;
  assignedDate: string;
  returnDate?: string;
  status: AssignmentStatus;
  notes?: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  unit?: string;
  assetType?: AssetType;
  manufacturer?: string;
  model?: string;
  receivedQuantity: number;
}

export interface Invoice {
  id: string;
  vendorId: string;
  siteId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  currency: string;
  paymentTerms?: string;
  poNumber?: string;
  poDate?: string;
  status: InvoiceStatus;
  notes?: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentDataUrl?: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  paymentDate?: string;
  paymentReference?: string;
  paymentMethod?: string;
  lineItems: InvoiceLineItem[];
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  userId: string;
  userName: string;
  details: string;
}

export interface SoftwareLicense {
  id: string;
  name: string;
  vendor: string;
  licenseKey: string;
  type: string;
  totalSeats: number;
  usedSeats: number;
  expiryDate: string;
  cost: number;
}

export interface MaintenanceRecord {
  id: string;
  assetId: string;
  assetName: string;
  date: string;
  type: 'preventive' | 'repair' | 'upgrade';
  description: string;
  cost: number;
  technician: string;
  status: 'completed' | 'in-progress' | 'scheduled';
}

export interface ItCallLog {
  id: string;
  siteId?: string;
  date: string;
  time: string;
  employeeNumber?: string;
  callerName: string;
  department: string;
  contactNumber: string;
  category: ItCallCategory;
  priority: ItCallPriority;
  issue: string;
  troubleshooting?: string;
  assetTag?: string;
  assignedTo: string;
  status: ItCallStatus;
  resolution?: string;
  resolutionDate?: string;
  closedAt?: string;
}

export function formatCurrency(amount: number): string {
  const policy=getCollection<SystemPolicy>('system-policies')[0]||DEFAULT_SYSTEM_POLICY;
  return new Intl.NumberFormat(policy.locale, {
    style: 'currency',
    currency: policy.defaultCurrency,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatDate(dateString: string): string {
  const policy=getCollection<SystemPolicy>('system-policies')[0]||DEFAULT_SYSTEM_POLICY;
  return new Date(dateString).toLocaleDateString(policy.locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatDateTime(dateString: string): string {
  const policy=getCollection<SystemPolicy>('system-policies')[0]||DEFAULT_SYSTEM_POLICY;
  return new Date(dateString).toLocaleString(policy.locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: policy.timezone || undefined
  });
}

export function formatTitle(value: string): string {
  return value
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * An invoice total expressed in the company's default currency, so totals across
 * invoices are never added in mixed currencies. Returns null when the invoice is in a
 * foreign currency that has no exchange rate set in Settings → Currencies.
 */
export function invoiceBaseTotal(invoice: { total: number; currency?: string }): number | null {
  const policy = getCollection<SystemPolicy>('system-policies')[0] || DEFAULT_SYSTEM_POLICY;
  const code = (invoice.currency || policy.defaultCurrency).split(' ')[0].toUpperCase();
  if (code === policy.defaultCurrency.toUpperCase()) return invoice.total;
  const rate = getCollection<{ id: string; rate?: number }>('currencies').find(c => c.id.toUpperCase() === code)?.rate;
  return rate && rate > 0 ? invoice.total * rate : null;
}
