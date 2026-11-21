export interface MasterDataOption {
  id: string;
  name: string;
  code?: string;
  active: boolean;
  targetHours?: number;
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
    { ...option('low','Low'), targetHours: 72 }, { ...option('medium','Medium'), targetHours: 24 },
    { ...option('high','High'), targetHours: 8 }, { ...option('critical','Critical'), targetHours: 2 },
  ],
  'location-types': [option('office','Office'), option('warehouse','Warehouse'), option('remote','Remote')],
  'vendor-categories': ['Hardware','Software','Services','Cloud','Telecom','Consulting','Other'].map(value => option(value.toLowerCase(), value)),
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
