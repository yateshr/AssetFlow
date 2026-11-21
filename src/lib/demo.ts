/**
 * Optional demo content. Nothing is loaded automatically; an administrator can
 * import it from "Demo & Data" to explore AssetFlow, and erase it afterwards.
 * The demo module is loaded on demand so it is not part of the normal app.
 */
import type { User } from '@/data/models';
import { eraseAll, getCollection, kv, pendingWrites, replaceCollection } from './db';
import { DEFAULT_ASSET_CATEGORIES } from '@/data/assetCategories';

export async function loadDemoData() {
  const demo = await import('@/data/demoData');

  // Start clean (the signed-in administrator's account is always kept).
  await eraseAll(['users']);

  const existing = getCollection<User>('users');
  const known = new Set(existing.map(u => u.email.toLowerCase()));
  const demoUsers = demo.users.filter(u => !known.has(u.email.toLowerCase()));

  await replaceCollection('users', [...existing, ...demoUsers]);
  await replaceCollection('locations', demo.locations);
  await replaceCollection('departments', demo.departments.map(name => ({ id: name, name })));
  await replaceCollection('asset-categories', DEFAULT_ASSET_CATEGORIES);
  await replaceCollection('assets', demo.assets);
  await replaceCollection('assignments', demo.assignments);
  await replaceCollection('vendors', demo.vendors);
  await replaceCollection('invoices', demo.invoices);
  await replaceCollection('licenses', demo.softwareLicenses);
  await replaceCollection('audit-logs', demo.auditLogs);
  await replaceCollection('history', demo.assetHistory);
  await replaceCollection('call-logs', demo.itCallLogs);

  kv.setItem('assetflow-maintenance', JSON.stringify(demo.maintenanceRecords));
  kv.setItem('assetflow-stock', JSON.stringify([
    { id: 'STK-001', name: 'USB-C Dock', sku: 'DOCK-001', category: 'Accessories', quantity: 12, minQuantity: 5, unitCost: 85, location: 'IT Store' },
    { id: 'STK-002', name: 'Wireless Mouse', sku: 'MOU-001', category: 'Accessories', quantity: 24, minQuantity: 10, unitCost: 25, location: 'IT Store' },
  ]));
  const { flushKv } = await import('./db');
  flushKv();
  await pendingWrites();
}

/** Deletes every business record. User accounts are kept so nobody is locked out. */
export async function eraseAllData() {
  await eraseAll(['users']);
}
