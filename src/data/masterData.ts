export interface MasterDataOption {
  id: string;
  name: string;
  code?: string;
  active: boolean;
  targetHours?: number;
  /** Currencies only: how many units of the company's default currency one unit of this currency is worth. */
  rate?: number;
  /** Payment terms only: days from invoice date until payment is due. */
  days?: number;
  /** Call priorities: badge colour. */
  tone?: 'gray' | 'green' | 'blue' | 'amber' | 'orange' | 'red';
  /** Archived items stay on existing records but are hidden from new-record pickers. */
}

export interface SystemPolicy {
  id: 'system';
  defaultCurrency: string;
  locale: string;
  timezone: string;
  dateFormat: string;
  warrantyAlertDays: number;
  licenseAlertDays: number;
  usefulLifeYears: number;
  depreciationMethod: 'straight-line' | 'none';
  defaultCustodian: string;
  defaultStockLocation: string;
  defaultSupportTeam: string;
}

const option = (id: string, name: string, code?: string): MasterDataOption => ({ id, name, code, active: true });

export const MASTER_DATA_DEFAULTS: Record<string, MasterDataOption[]> = {
  currencies: [
    option('INR', 'INR - Indian Rupee', 'INR'), option('USD', 'USD - US Dollar', 'USD'),
    option('EUR', 'EUR - Euro', 'EUR'), option('GBP', 'GBP - British Pound', 'GBP'),
    option('AED', 'AED - UAE Dirham', 'AED'), option('SGD', 'SGD - Singapore Dollar', 'SGD'),
    option('AUD', 'AUD - Australian Dollar', 'AUD'), option('CAD', 'CAD - Canadian Dollar', 'CAD'),
    option('JPY', 'JPY - Japanese Yen', 'JPY'),
  ],
  'units-of-measure': ['Pcs','Nos','Unit','Set','Box','Pack'].map(value => option(value.toLowerCase(), value)),
  'call-categories': [
    option('hardware','Hardware'), option('software','Software'), option('network','Network'),
    option('access','Access'), option('asset-request','Asset Request'), option('other','Other'),
  ],
  'call-priorities': [
    { ...option('low','Low'), targetHours: 72, tone: 'green' as const }, { ...option('medium','Medium'), targetHours: 24, tone: 'blue' as const },
    { ...option('high','High'), targetHours: 8, tone: 'orange' as const }, { ...option('critical','Critical'), targetHours: 2, tone: 'red' as const },
  ],
  'location-types': [option('office','Office'), option('warehouse','Warehouse'), option('remote','Remote')],
  'payment-methods': ['Bank Transfer','UPI','Cheque','Cash','Credit/Debit Card','Other'].map(value => option(value.toLowerCase().replace(/[^a-z0-9]+/g,'-'), value)),
  'payment-terms': [['due-on-receipt','Due on receipt',0],['net-15','Net 15',15],['net-30','Net 30',30],['net-45','Net 45',45],['net-60','Net 60',60]].map(([id,name,days]) => ({ ...option(id as string, name as string), days: days as number })),
  'asset-conditions': [option('new','New'), option('good','Good'), option('fair','Fair'), option('damaged','Damaged'), option('missing','Missing')],
  'license-types': [option('subscription','Subscription'), option('perpetual','Perpetual')],
  'infrastructure-types': [
    option('server','Server'), option('router','Router'), option('switch','Switch'), option('firewall','Firewall'),
    option('access-point','Access Point'), option('ups','UPS'), option('printer','Printer'), option('other','Other'),
  ],
  'support-teams': [option('it-team','IT Team')],
};

export const DEFAULT_SYSTEM_POLICY: SystemPolicy = {
  id: 'system', defaultCurrency: 'INR', locale: 'en-IN', timezone: 'Asia/Kolkata', dateFormat: 'DD/MM/YYYY',
  warrantyAlertDays: 90, licenseAlertDays: 60, usefulLifeYears: 4, depreciationMethod: 'straight-line',
  defaultCustodian: 'IT Asset Manager', defaultStockLocation: 'IT Store', defaultSupportTeam: 'IT Team',
};
