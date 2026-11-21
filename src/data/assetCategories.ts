import type { AssetCategory } from './models';

export const DEFAULT_ASSET_CATEGORIES: AssetCategory[] = [
  { id: 'laptop', name: 'Laptop', code: 'LAP', active: true },
  { id: 'desktop', name: 'Desktop', code: 'DSK', active: true },
  { id: 'monitor', name: 'Monitor', code: 'MON', active: true },
  { id: 'phone', name: 'Phone', code: 'PHN', active: true },
  { id: 'tablet', name: 'Tablet', code: 'TAB', active: true },
  { id: 'printer', name: 'Printer', code: 'PRN', active: true },
  { id: 'server', name: 'Server', code: 'SRV', active: true },
  { id: 'accessory', name: 'Accessory', code: 'ACC', active: true },
];
