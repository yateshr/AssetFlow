import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { mockDb, resetStore, rows, seed } from './helpers';

vi.mock('@/lib/db', () => ({ ...mockDb(), useCollection: (name: string) => [rows(name), () => {}] }));

import { AssetDetailPage } from '@/components/AssetDetailPage';

const asset: any = {
  id: 'A1', assetTag: 'NP-IT-LAP-A0001', name: 'Dell Latitude', type: 'laptop', manufacturer: 'Dell', model: 'Latitude 5440',
  serialNumber: 'SN123', status: 'assigned', purchaseDate: '2025-01-10', purchasePrice: 80000, warrantyExpiry: '2027-12-31',
  siteId: 'S1', assignedTo: 'U1', condition: 'good',
};
const render = (over: any = {}) =>
  renderToString(
    createElement(AssetDetailPage, {
      asset: { ...asset, ...over },
      users: [{ id: 'U1', name: 'Asha Rao', department: 'Accounts' } as any],
      sites: [{ id: 'S1', name: 'Mumbai' } as any],
      invoices: [],
      history: [{ id: 'H1', assetId: 'A1', timestamp: '2026-11-01T10:00:00Z', action: 'Assigned', to: 'Asha Rao', performedBy: 'U1' } as any],
      onBack: () => {}, onEdit: () => {}, onLabel: () => {}, menu: null,
    }),
  ).replace(/<!-- -->/g, ''); // the server renderer separates text pieces with comment markers

beforeEach(() => {
  resetStore();
  seed('system-policies', [{ id: 'system', defaultCurrency: 'INR', locale: 'en-IN', usefulLifeYears: 4, depreciationMethod: 'straight-line' }]);
  seed('asset-categories', [{ id: 'laptop', name: 'Laptop', code: 'LAP', active: true }]);
  seed('assignments', [{ id: 'AS1', assetId: 'A1', userId: 'U1', userName: 'Asha Rao', assignedDate: '2025-02-01', status: 'active' }]);
  seed('maintenance', [{ id: 'M1', assetId: 'A1', date: '2099-01-01', type: 'preventive', description: 'Service', status: 'scheduled', cost: 0, technician: '' }]);
});

describe('AssetDetailPage', () => {
  it('shows the identity, custody, warranty, depreciation and upcoming maintenance', () => {
    const html = render();
    expect(html).toContain('NP-IT-LAP-A0001');
    expect(html).toContain('Dell Latitude');
    expect(html).toContain('Asha Rao');
    expect(html).toContain('10-Jan-2025 to 31-Dec-2027'); // warranty period, label style
    expect(html).toContain('Depreciation');
    expect(html).toContain('Service');
    expect(html).toContain('Recent activity');
  });

  it('shows the type name, not its id', () => expect(render()).toContain('Laptop'));

  it('marks archived assets and hides the edit button', () => {
    const html = render({ archivedAt: '2026-11-01T00:00:00Z' });
    expect(html).toContain('Archived');
    expect(html).not.toContain('>Edit<');
  });

  it('copes with an asset that has no warranty date or purchase date', () => {
    expect(() => render({ warrantyExpiry: '', purchaseDate: '' })).not.toThrow();
    expect(render({ warrantyExpiry: '' })).toContain('No warranty date recorded');
  });
});
