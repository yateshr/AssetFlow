// Types
export type AssetStatus = 'available' | 'assigned' | 'maintenance' | 'retired' | 'disposed' | 'lost';
export type AssetType = 'laptop' | 'desktop' | 'monitor' | 'phone' | 'tablet' | 'printer' | 'server' | 'accessory';
export type AssignmentStatus = 'active' | 'returned' | 'pending';
export type InvoiceStatus = 'draft' | 'received' | 'partially-received' | 'paid' | 'partially-paid' | 'overdue' | 'cancelled';
export type UserRole = 'admin' | 'manager' | 'user';
export type UserStatus = 'active' | 'inactive' | 'left';

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
  | 'Found';
export type ItCallStatus = 'open' | 'in-progress' | 'resolved' | 'closed';
export type ItCallPriority = 'low' | 'medium' | 'high' | 'critical';
export type ItCallCategory = 'hardware' | 'software' | 'network' | 'access' | 'asset-request' | 'other';

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
  location: string;
  assignedTo?: string;
  vendorId?: string;
  invoiceId?: string;
  invoiceItemId?: string;
  notes?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  department: string;
  locationId: string;
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
  locationId?: string;
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
  type: 'office' | 'warehouse' | 'remote';
  capacity: number;
  manager: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  website: string;
  category: string;
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
  assetType?: AssetType;
  manufacturer?: string;
  model?: string;
  receivedQuantity: number;
}

export interface Invoice {
  id: string;
  vendorId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  currency: string;
  paymentTerms?: string;
  poNumber?: string;
  status: InvoiceStatus;
  notes?: string;
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
  type: 'perpetual' | 'subscription';
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
  date: string;
  time: string;
  callerName: string;
  department: string;
  contactNumber: string;
  category: ItCallCategory;
  priority: ItCallPriority;
  issue: string;
  assetTag?: string;
  assignedTo: string;
  status: ItCallStatus;
  resolution?: string;
  closedAt?: string;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatTitle(value: string): string {
  return value
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
