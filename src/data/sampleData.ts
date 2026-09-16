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

export const departments = [
  'Engineering',
  'Marketing',
  'Design',
  'Sales',
  'Finance',
  'HR',
  'IT Operations',
  'Administration',
  'Procurement'
];

// Sample Data
export const assets: Asset[] = [
  {
    id: 'AST-001',
    name: 'MacBook Pro 16"',
    type: 'laptop',
    manufacturer: 'Apple',
    model: 'MacBook Pro 16-inch 2023',
    serialNumber: 'C02ZK1ABC123',
    assetTag: 'LP-001',
    status: 'assigned',
    purchaseDate: '2023-03-15',
    purchasePrice: 2499,
    warrantyExpiry: '2026-03-15',
    location: 'LOC-001',
    assignedTo: 'USR-001',
    notes: 'M2 Pro chip, 32GB RAM'
  },
  {
    id: 'AST-002',
    name: 'Dell XPS 15',
    type: 'laptop',
    manufacturer: 'Dell',
    model: 'XPS 15 9530',
    serialNumber: 'DLX15XYZ789',
    assetTag: 'LP-002',
    status: 'assigned',
    purchaseDate: '2023-05-20',
    purchasePrice: 1899,
    warrantyExpiry: '2026-05-20',
    location: 'LOC-001',
    assignedTo: 'USR-002',
    notes: 'Intel i7, 16GB RAM'
  },
  {
    id: 'AST-003',
    name: 'Dell UltraSharp 27"',
    type: 'monitor',
    manufacturer: 'Dell',
    model: 'U2723QE',
    serialNumber: 'DU27MON456',
    assetTag: 'MN-001',
    status: 'assigned',
    purchaseDate: '2023-02-10',
    purchasePrice: 619,
    warrantyExpiry: '2026-02-10',
    location: 'LOC-001',
    assignedTo: 'USR-001'
  },
  {
    id: 'AST-004',
    name: 'iPhone 14 Pro',
    type: 'phone',
    manufacturer: 'Apple',
    model: 'iPhone 14 Pro 256GB',
    serialNumber: 'IPH14PRO321',
    assetTag: 'PH-001',
    status: 'assigned',
    purchaseDate: '2022-11-05',
    purchasePrice: 1099,
    warrantyExpiry: '2024-11-05',
    location: 'LOC-001',
    assignedTo: 'USR-003'
  },
  {
    id: 'AST-005',
    name: 'ThinkPad X1 Carbon',
    type: 'laptop',
    manufacturer: 'Lenovo',
    model: 'X1 Carbon Gen 11',
    serialNumber: 'TPX1C789',
    assetTag: 'LP-003',
    status: 'available',
    purchaseDate: '2023-07-01',
    purchasePrice: 1699,
    warrantyExpiry: '2026-07-01',
    location: 'LOC-002',
    notes: 'Intel i7, 32GB RAM'
  },
  {
    id: 'AST-006',
    name: 'HP EliteDesk 800',
    type: 'desktop',
    manufacturer: 'HP',
    model: 'EliteDesk 800 G9',
    serialNumber: 'HPE800G9123',
    assetTag: 'DT-001',
    status: 'maintenance',
    purchaseDate: '2022-08-15',
    purchasePrice: 1299,
    warrantyExpiry: '2025-08-15',
    location: 'LOC-001',
    notes: 'Undergoing RAM upgrade'
  },
  {
    id: 'AST-007',
    name: 'iPad Pro 12.9"',
    type: 'tablet',
    manufacturer: 'Apple',
    model: 'iPad Pro 12.9 M2',
    serialNumber: 'IPDPRO129456',
    assetTag: 'TB-001',
    status: 'assigned',
    purchaseDate: '2023-01-20',
    purchasePrice: 1099,
    warrantyExpiry: '2025-01-20',
    location: 'LOC-001',
    assignedTo: 'USR-004'
  },
  {
    id: 'AST-008',
    name: 'HP LaserJet Pro',
    type: 'printer',
    manufacturer: 'HP',
    model: 'LaserJet Pro M404dn',
    serialNumber: 'HPLJ404789',
    assetTag: 'PR-001',
    status: 'available',
    purchaseDate: '2022-06-10',
    purchasePrice: 399,
    warrantyExpiry: '2025-06-10',
    location: 'LOC-002'
  },
  {
    id: 'AST-009',
    name: 'Dell PowerEdge R740',
    type: 'server',
    manufacturer: 'Dell',
    model: 'PowerEdge R740',
    serialNumber: 'DPER740321',
    assetTag: 'SV-001',
    status: 'available',
    purchaseDate: '2021-09-25',
    purchasePrice: 8999,
    warrantyExpiry: '2026-09-25',
    location: 'LOC-003',
    notes: 'Production database server'
  },
  {
    id: 'AST-010',
    name: 'LG 32" 4K Monitor',
    type: 'monitor',
    manufacturer: 'LG',
    model: '32UN880-B',
    serialNumber: 'LG32UN456',
    assetTag: 'MN-002',
    status: 'retired',
    purchaseDate: '2020-04-15',
    purchasePrice: 699,
    warrantyExpiry: '2023-04-15',
    location: 'LOC-001',
    notes: 'Screen damage, disposed'
  },
  {
    id: 'AST-011',
    name: 'Logitech MX Master 3',
    type: 'accessory',
    manufacturer: 'Logitech',
    model: 'MX Master 3S',
    serialNumber: 'LGMXM3S789',
    assetTag: 'AC-001',
    status: 'available',
    purchaseDate: '2023-04-01',
    purchasePrice: 99,
    warrantyExpiry: '2025-04-01',
    location: 'LOC-002'
  },
  {
    id: 'AST-012',
    name: 'Surface Pro 9',
    type: 'tablet',
    manufacturer: 'Microsoft',
    model: 'Surface Pro 9 i7',
    serialNumber: 'MSSP9I7123',
    assetTag: 'TB-002',
    status: 'assigned',
    purchaseDate: '2023-06-15',
    purchasePrice: 1599,
    warrantyExpiry: '2026-06-15',
    location: 'LOC-001',
    assignedTo: 'USR-005'
  }
];

export const users: User[] = [
  {
    id: 'USR-001',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@company.com',
    department: 'Engineering',
    locationId: 'LOC-001',
    role: 'admin',
    phone: '+1 (555) 123-4567',
    joinDate: '2020-03-15',
    status: 'active'
  },
  {
    id: 'USR-002',
    name: 'Michael Chen',
    email: 'michael.chen@company.com',
    department: 'Engineering',
    locationId: 'LOC-001',
    role: 'user',
    phone: '+1 (555) 234-5678',
    joinDate: '2021-06-01',
    status: 'active'
  },
  {
    id: 'USR-003',
    name: 'Emily Rodriguez',
    email: 'emily.rodriguez@company.com',
    department: 'Marketing',
    locationId: 'LOC-002',
    role: 'manager',
    phone: '+1 (555) 345-6789',
    joinDate: '2019-11-20',
    status: 'active'
  },
  {
    id: 'USR-004',
    name: 'David Kim',
    email: 'david.kim@company.com',
    department: 'Design',
    locationId: 'LOC-001',
    role: 'user',
    phone: '+1 (555) 456-7890',
    joinDate: '2022-01-10',
    status: 'active'
  },
  {
    id: 'USR-005',
    name: 'Jessica Martinez',
    email: 'jessica.martinez@company.com',
    department: 'Sales',
    locationId: 'LOC-004',
    role: 'user',
    phone: '+1 (555) 567-8901',
    joinDate: '2022-08-15',
    status: 'active'
  },
  {
    id: 'USR-006',
    name: 'Robert Taylor',
    email: 'robert.taylor@company.com',
    department: 'Finance',
    locationId: 'LOC-002',
    role: 'manager',
    phone: '+1 (555) 678-9012',
    joinDate: '2018-05-01',
    status: 'active'
  },
  {
    id: 'USR-007',
    name: 'Amanda White',
    email: 'amanda.white@company.com',
    department: 'HR',
    locationId: 'LOC-001',
    role: 'user',
    phone: '+1 (555) 789-0123',
    joinDate: '2021-09-20',
    status: 'active'
  },
  {
    id: 'USR-008',
    name: 'James Wilson',
    email: 'james.wilson@company.com',
    department: 'Engineering',
    locationId: 'LOC-004',
    role: 'user',
    phone: '+1 (555) 890-1234',
    joinDate: '2023-02-01',
    status: 'active'
  }
];

export const locations: Location[] = [
  {
    id: 'LOC-001',
    name: 'San Francisco HQ',
    address: '123 Market St, San Francisco, CA 94105',
    type: 'office',
    capacity: 150,
    manager: 'Sarah Johnson'
  },
  {
    id: 'LOC-002',
    name: 'Austin Office',
    address: '456 Congress Ave, Austin, TX 78701',
    type: 'office',
    capacity: 75,
    manager: 'Robert Taylor'
  },
  {
    id: 'LOC-003',
    name: 'Data Center East',
    address: '789 Server Farm Rd, Ashburn, VA 20147',
    type: 'warehouse',
    capacity: 500,
    manager: 'IT Operations'
  },
  {
    id: 'LOC-004',
    name: 'Remote Workers',
    address: 'Various Locations',
    type: 'remote',
    capacity: 200,
    manager: 'HR Department'
  }
];

export const vendors: Vendor[] = [
  {
    id: 'VND-001',
    name: 'Apple Inc.',
    contactPerson: 'John Smith',
    email: 'enterprise@apple.com',
    phone: '+1 (800) 275-2273',
    website: 'https://www.apple.com',
    category: 'Hardware',
    currency: 'USD - US Dollar',
    contractExpiry: '2025-12-31'
  },
  {
    id: 'VND-002',
    name: 'Dell Technologies',
    contactPerson: 'Lisa Brown',
    email: 'sales@dell.com',
    phone: '+1 (800) 999-3355',
    website: 'https://www.dell.com',
    category: 'Hardware',
    currency: 'USD - US Dollar',
    contractExpiry: '2026-06-30'
  },
  {
    id: 'VND-003',
    name: 'Microsoft Corporation',
    contactPerson: 'Mark Davis',
    email: 'licensing@microsoft.com',
    phone: '+1 (800) 307-8469',
    website: 'https://www.microsoft.com',
    category: 'Software',
    currency: 'USD - US Dollar',
    contractExpiry: '2025-09-30'
  },
  {
    id: 'VND-004',
    name: 'HP Inc.',
    contactPerson: 'Jennifer Lee',
    email: 'enterprise@hp.com',
    phone: '+1 (800) 474-6836',
    website: 'https://www.hp.com',
    category: 'Hardware',
    currency: 'USD - US Dollar',
    contractExpiry: '2026-03-31'
  },
  {
    id: 'VND-005',
    name: 'Lenovo',
    contactPerson: 'Kevin Zhang',
    email: 'sales@lenovo.com',
    phone: '+1 (855) 253-6686',
    website: 'https://www.lenovo.com',
    category: 'Hardware',
    currency: 'USD - US Dollar',
    contractExpiry: '2025-11-30'
  }
];

export const assignments: Assignment[] = [
  {
    id: 'ASG-001',
    assetId: 'AST-001',
    assetName: 'MacBook Pro 16"',
    userId: 'USR-001',
    userName: 'Sarah Johnson',
    assignedDate: '2023-03-20',
    status: 'active',
    notes: 'Primary work laptop'
  },
  {
    id: 'ASG-002',
    assetId: 'AST-002',
    assetName: 'Dell XPS 15',
    userId: 'USR-002',
    userName: 'Michael Chen',
    assignedDate: '2023-05-25',
    status: 'active'
  },
  {
    id: 'ASG-003',
    assetId: 'AST-003',
    assetName: 'Dell UltraSharp 27"',
    userId: 'USR-001',
    userName: 'Sarah Johnson',
    assignedDate: '2023-02-15',
    status: 'active',
    notes: 'External monitor for development'
  },
  {
    id: 'ASG-004',
    assetId: 'AST-004',
    assetName: 'iPhone 14 Pro',
    userId: 'USR-003',
    userName: 'Emily Rodriguez',
    assignedDate: '2022-11-10',
    status: 'active',
    notes: 'Company phone for client meetings'
  },
  {
    id: 'ASG-005',
    assetId: 'AST-007',
    assetName: 'iPad Pro 12.9"',
    userId: 'USR-004',
    userName: 'David Kim',
    assignedDate: '2023-01-25',
    status: 'active',
    notes: 'Design work and presentations'
  },
  {
    id: 'ASG-006',
    assetId: 'AST-012',
    assetName: 'Surface Pro 9',
    userId: 'USR-005',
    userName: 'Jessica Martinez',
    assignedDate: '2023-06-20',
    status: 'active',
    notes: 'Travel laptop for sales demos'
  },
  {
    id: 'ASG-007',
    assetId: 'AST-005',
    assetName: 'ThinkPad X1 Carbon',
    userId: 'USR-006',
    userName: 'Robert Taylor',
    assignedDate: '2022-09-01',
    returnDate: '2023-07-01',
    status: 'returned',
    notes: 'Returned after role change'
  }
];

export const auditLogs: AuditLog[] = [
  {
    id: 'AUD-001',
    timestamp: '2024-01-15T10:30:00Z',
    action: 'Asset Created',
    entityType: 'Asset',
    entityId: 'AST-012',
    entityName: 'Surface Pro 9',
    userId: 'USR-001',
    userName: 'Sarah Johnson',
    details: 'Created new asset record'
  },
  {
    id: 'AUD-002',
    timestamp: '2024-01-14T14:20:00Z',
    action: 'Asset Assigned',
    entityType: 'Assignment',
    entityId: 'ASG-006',
    entityName: 'Surface Pro 9 → Jessica Martinez',
    userId: 'USR-001',
    userName: 'Sarah Johnson',
    details: 'Assigned asset to user'
  },
  {
    id: 'AUD-003',
    timestamp: '2024-01-13T09:15:00Z',
    action: 'Asset Updated',
    entityType: 'Asset',
    entityId: 'AST-006',
    entityName: 'HP EliteDesk 800',
    userId: 'USR-001',
    userName: 'Sarah Johnson',
    details: 'Changed status to maintenance'
  },
  {
    id: 'AUD-004',
    timestamp: '2024-01-12T16:45:00Z',
    action: 'User Created',
    entityType: 'User',
    entityId: 'USR-008',
    entityName: 'James Wilson',
    userId: 'USR-006',
    userName: 'Robert Taylor',
    details: 'Added new employee to system'
  },
  {
    id: 'AUD-005',
    timestamp: '2024-01-11T11:00:00Z',
    action: 'Asset Returned',
    entityType: 'Assignment',
    entityId: 'ASG-007',
    entityName: 'ThinkPad X1 Carbon ← Robert Taylor',
    userId: 'USR-001',
    userName: 'Sarah Johnson',
    details: 'Asset returned by user'
  },
  {
    id: 'AUD-006',
    timestamp: '2024-01-10T13:30:00Z',
    action: 'License Updated',
    entityType: 'License',
    entityId: 'LIC-003',
    entityName: 'Microsoft 365 Business',
    userId: 'USR-001',
    userName: 'Sarah Johnson',
    details: 'Increased seat count from 50 to 75'
  },
  {
    id: 'AUD-007',
    timestamp: '2024-01-09T10:00:00Z',
    action: 'Asset Retired',
    entityType: 'Asset',
    entityId: 'AST-010',
    entityName: 'LG 32" 4K Monitor',
    userId: 'USR-001',
    userName: 'Sarah Johnson',
    details: 'Asset marked as retired due to damage'
  },
  {
    id: 'AUD-008',
    timestamp: '2024-01-08T15:20:00Z',
    action: 'Vendor Updated',
    entityType: 'Vendor',
    entityId: 'VND-002',
    entityName: 'Dell Technologies',
    userId: 'USR-006',
    userName: 'Robert Taylor',
    details: 'Updated contract expiry date'
  }
];

export const invoices: Invoice[] = [
  {
    id: 'INV-001',
    vendorId: 'VND-002',
    invoiceNumber: 'DELL-2026-00451',
    invoiceDate: '2026-09-10',
    dueDate: '2026-10-10',
    currency: 'USD - US Dollar',
    paymentTerms: 'Net 30',
    poNumber: 'PO-2026-0098',
    status: 'received',
    subtotal: 9100,
    taxTotal: 1638,
    total: 10738,
    amountPaid: 0,
    lineItems: [
      {
        id: 'INVL-001',
        description: 'Dell Latitude 5440',
        quantity: 5,
        unitPrice: 1200,
        taxRate: 18,
        assetType: 'laptop',
        manufacturer: 'Dell',
        model: 'Latitude 5440',
        receivedQuantity: 5
      },
      {
        id: 'INVL-002',
        description: 'Dell UltraSharp 27"',
        quantity: 5,
        unitPrice: 700,
        taxRate: 18,
        assetType: 'monitor',
        manufacturer: 'Dell',
        model: 'UltraSharp 27"',
        receivedQuantity: 5
      }
    ],
    createdAt: '2026-09-10T10:00:00Z'
  }
];

export const softwareLicenses: SoftwareLicense[] = [
  {
    id: 'LIC-001',
    name: 'Microsoft Office 365',
    vendor: 'Microsoft',
    licenseKey: 'M365-BIZ-2024-001',
    type: 'subscription',
    totalSeats: 100,
    usedSeats: 78,
    expiryDate: '2025-09-30',
    cost: 15000
  },
  {
    id: 'LIC-002',
    name: 'Adobe Creative Cloud',
    vendor: 'Adobe',
    licenseKey: 'ACC-ENT-2024-045',
    type: 'subscription',
    totalSeats: 25,
    usedSeats: 18,
    expiryDate: '2025-06-15',
    cost: 9000
  },
  {
    id: 'LIC-003',
    name: 'Slack Business+',
    vendor: 'Slack',
    licenseKey: 'SLK-BIZ-2024-112',
    type: 'subscription',
    totalSeats: 150,
    usedSeats: 120,
    expiryDate: '2025-12-31',
    cost: 18000
  },
  {
    id: 'LIC-004',
    name: 'Zoom Business',
    vendor: 'Zoom',
    licenseKey: 'ZM-BIZ-2024-089',
    type: 'subscription',
    totalSeats: 100,
    usedSeats: 85,
    expiryDate: '2025-08-20',
    cost: 12000
  },
  {
    id: 'LIC-005',
    name: 'JetBrains All Products Pack',
    vendor: 'JetBrains',
    licenseKey: 'JB-ALL-2024-234',
    type: 'subscription',
    totalSeats: 30,
    usedSeats: 24,
    expiryDate: '2025-11-15',
    cost: 7200
  },
  {
    id: 'LIC-006',
    name: 'AutoCAD LT',
    vendor: 'Autodesk',
    licenseKey: 'ACAD-LT-2023-567',
    type: 'perpetual',
    totalSeats: 10,
    usedSeats: 8,
    expiryDate: '2028-03-01',
    cost: 25000
  }
];

export const maintenanceRecords: MaintenanceRecord[] = [
  {
    id: 'MNT-001',
    assetId: 'AST-006',
    assetName: 'HP EliteDesk 800',
    date: '2024-01-13',
    type: 'upgrade',
    description: 'RAM upgrade from 16GB to 32GB',
    cost: 150,
    technician: 'Mike Thompson',
    status: 'in-progress'
  },
  {
    id: 'MNT-002',
    assetId: 'AST-008',
    assetName: 'HP LaserJet Pro',
    date: '2024-01-10',
    type: 'preventive',
    description: 'Routine maintenance and toner replacement',
    cost: 75,
    technician: 'Sarah Johnson',
    status: 'completed'
  },
  {
    id: 'MNT-003',
    assetId: 'AST-009',
    assetName: 'Dell PowerEdge R740',
    date: '2024-01-20',
    type: 'preventive',
    description: 'Scheduled quarterly maintenance',
    cost: 0,
    technician: 'IT Operations Team',
    status: 'scheduled'
  },
  {
    id: 'MNT-004',
    assetId: 'AST-002',
    assetName: 'Dell XPS 15',
    date: '2023-12-15',
    type: 'repair',
    description: 'Battery replacement',
    cost: 120,
    technician: 'Dell Service Center',
    status: 'completed'
  }
];

export const itCallLogs: ItCallLog[] = [
  {
    id: 'CALL-001',
    date: '2026-09-12',
    time: '09:20',
    callerName: 'Michael Chen',
    department: 'Engineering',
    contactNumber: '+1 (555) 234-5678',
    category: 'hardware',
    priority: 'high',
    issue: 'Laptop battery draining within one hour during normal use.',
    assetTag: 'LP-002',
    assignedTo: 'Sarah Johnson',
    status: 'in-progress',
    resolution: 'Battery health check started; replacement quote requested.'
  },
  {
    id: 'CALL-002',
    date: '2026-09-12',
    time: '10:05',
    callerName: 'Emily Rodriguez',
    department: 'Marketing',
    contactNumber: '+1 (555) 345-6789',
    category: 'access',
    priority: 'medium',
    issue: 'Unable to access shared brand asset folder after password reset.',
    assignedTo: 'Amanda White',
    status: 'resolved',
    resolution: 'Group membership refreshed and access confirmed.',
    closedAt: '2026-09-12T10:42:00'
  },
  {
    id: 'CALL-003',
    date: '2026-09-12',
    time: '11:30',
    callerName: 'David Kim',
    department: 'Design',
    contactNumber: '+1 (555) 456-7890',
    category: 'software',
    priority: 'low',
    issue: 'Adobe Creative Cloud license not showing new seat assignment.',
    assignedTo: 'IT Operations Team',
    status: 'open'
  },
  {
    id: 'CALL-004',
    date: '2026-09-11',
    time: '14:10',
    callerName: 'Jessica Martinez',
    department: 'Sales',
    contactNumber: '+1 (555) 567-8901',
    category: 'network',
    priority: 'critical',
    issue: 'VPN repeatedly disconnecting during customer demo preparation.',
    assignedTo: 'Sarah Johnson',
    status: 'closed',
    resolution: 'VPN profile recreated and device certificate renewed.',
    closedAt: '2026-09-11T15:05:00'
  },
  {
    id: 'CALL-005',
    date: '2026-09-11',
    time: '16:45',
    callerName: 'Robert Taylor',
    department: 'Finance',
    contactNumber: '+1 (555) 678-9012',
    category: 'asset-request',
    priority: 'medium',
    issue: 'Request for additional monitor for monthly reconciliation work.',
    assetTag: 'MN-001',
    assignedTo: 'IT Operations Team',
    status: 'resolved',
    resolution: 'Existing monitor reassigned after manager approval.',
    closedAt: '2026-09-11T17:20:00'
  },
  {
    id: 'CALL-006',
    date: '2026-09-10',
    time: '08:55',
    callerName: 'James Wilson',
    department: 'Engineering',
    contactNumber: '+1 (555) 890-1234',
    category: 'hardware',
    priority: 'medium',
    issue: 'Docking station intermittently drops external monitor.',
    assignedTo: 'Sarah Johnson',
    status: 'closed',
    resolution: 'Firmware updated and USB-C cable replaced.',
    closedAt: '2026-09-10T09:35:00'
  }
];

// Helper functions
export function getAssetById(id: string): Asset | undefined {
  return assets.find(a => a.id === id);
}

export function getUserById(id: string): User | undefined {
  return users.find(u => u.id === id);
}

export function getLocationById(id: string): Location | undefined {
  return locations.find(l => l.id === id);
}

export function getVendorById(id: string): Vendor | undefined {
  return vendors.find(v => v.id === id);
}

export function getAssetsByStatus(status: AssetStatus): Asset[] {
  return assets.filter(a => a.status === status);
}

export function getAssetsByType(type: AssetType): Asset[] {
  return assets.filter(a => a.type === type);
}

export function getActiveAssignments(): Assignment[] {
  return assignments.filter(a => a.status === 'active');
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
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

// Initial lifecycle history derived from the existing sample assignments/purchase data.
// New events are created by the UI and kept in shared App state.
export const assetHistory: AssetHistoryEvent[] = assets.flatMap((asset) => {
  const events: AssetHistoryEvent[] = [
    {
      id: `H-${asset.id}-PURCHASE`,
      assetId: asset.id,
      timestamp: `${asset.purchaseDate}T09:00:00`,
      action: 'Purchased',
      from: 'Vendor',
      to: 'IT Asset Manager',
      notes: 'Initial purchase record.'
    },
    {
      id: `H-${asset.id}-RECEIVED`,
      assetId: asset.id,
      timestamp: `${asset.purchaseDate}T14:00:00`,
      action: 'Received',
      to: 'IT Asset Manager',
      locationId: asset.location,
      notes: 'Asset received into inventory.'
    }
  ];

  const relatedAssignments = assignments
    .filter((assignment) => assignment.assetId === asset.id)
    .sort((a, b) => a.assignedDate.localeCompare(b.assignedDate));

  relatedAssignments.forEach((assignment) => {
    events.push({
      id: `H-${assignment.id}-ASSIGN`,
      assetId: asset.id,
      timestamp: `${assignment.assignedDate}T09:00:00`,
      action: 'Assigned',
      from: 'IT Asset Manager',
      to: assignment.userName,
      userId: assignment.userId,
      locationId: asset.location,
      notes: assignment.notes
    });

    if (assignment.returnDate) {
      events.push({
        id: `H-${assignment.id}-RETURN`,
        assetId: asset.id,
        timestamp: `${assignment.returnDate}T17:00:00`,
        action: 'Returned',
        from: assignment.userName,
        to: 'IT Asset Manager',
        userId: assignment.userId,
        locationId: asset.location,
        notes: 'Asset returned to IT inventory.'
      });
    }
  });

  if (asset.status === 'maintenance') {
    events.push({
      id: `H-${asset.id}-MAINTENANCE`,
      assetId: asset.id,
      timestamp: `${new Date().toISOString().slice(0, 10)}T09:00:00`,
      action: 'Under Repair',
      from: 'Available',
      to: 'Under Repair',
      locationId: asset.location,
      notes: asset.notes
    });
  }

  if (asset.status === 'retired') {
    events.push({
      id: `H-${asset.id}-RETIRED`,
      assetId: asset.id,
      timestamp: `${new Date().toISOString().slice(0, 10)}T09:00:00`,
      action: 'Retired',
      from: 'In Service',
      to: 'Retired',
      locationId: asset.location,
      notes: asset.notes
    });
  }

  return events;
});
