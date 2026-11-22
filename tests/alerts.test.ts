import { describe, expect, it } from 'vitest';
import { buildExpiryAlerts, daysUntil, severityFor } from '@/lib/alerts';

const now = new Date('2026-11-22T12:00:00');
const policy = { warrantyAlertDays: 90, licenseAlertDays: 60 };
const asset = (over: any = {}) => ({ id: 'A1', assetTag: 'NP-IT-CPU-A0001', name: 'PC', status: 'assigned', warrantyExpiry: '2027-01-01', ...over });
const run = (over: any = {}) =>
  buildExpiryAlerts({ assets: [asset(over.asset)] as any, licenses: over.licenses || [], vendors: over.vendors || [], invoices: over.invoices || [], policy, now });

describe('daysUntil and severity', () => {
  it('counts whole days from today', () => {
    expect(daysUntil('2026-11-22', now)).toBe(0);
    expect(daysUntil('2026-11-23', now)).toBe(1);
    expect(daysUntil('2026-11-21', now)).toBe(-1);
  });

  it('is NaN for missing or bad dates', () => {
    expect(daysUntil('', now)).toBeNaN();
    expect(daysUntil('nope', now)).toBeNaN();
  });

  it('bands by urgency', () => {
    expect(severityFor(-3)).toBe('critical');
    expect(severityFor(7)).toBe('critical');
    expect(severityFor(8)).toBe('warning');
    expect(severityFor(30)).toBe('warning');
    expect(severityFor(31)).toBe('info');
  });
});

describe('buildExpiryAlerts', () => {
  it('alerts inside the warranty window', () => expect(run().map(a => a.kind)).toEqual(['warranty']));
  it('stays quiet outside the window', () => expect(run({ asset: { warrantyExpiry: '2027-06-01' } })).toHaveLength(0));

  it('reports an expired warranty as critical', () => {
    const [a] = run({ asset: { warrantyExpiry: '2026-11-01' } });
    expect(a.severity).toBe('critical');
    expect(a.days).toBeLessThan(0);
  });

  it('ignores retired, disposed and lost assets', () => {
    for (const status of ['retired', 'disposed', 'lost']) expect(run({ asset: { status } })).toHaveLength(0);
  });

  it('flags licenses over capacity even without an expiry', () => {
    const alerts = run({ asset: { warrantyExpiry: '' }, licenses: [{ id: 'L1', name: 'Office', vendor: 'MS', totalSeats: 5, usedSeats: 7, expiryDate: '' }] });
    expect(alerts.map(a => a.kind)).toEqual(['seats']);
  });

  it('skips paid invoices and orders the most urgent first', () => {
    const alerts = run({
      asset: { warrantyExpiry: '2026-12-20' },
      invoices: [
        { id: 'I1', invoiceNumber: 'INV-1', status: 'open', total: 100, amountPaid: 0, currency: 'INR', dueDate: '2026-11-10' },
        { id: 'I2', invoiceNumber: 'INV-2', status: 'paid', total: 100, amountPaid: 100, currency: 'INR', dueDate: '2026-11-10' },
      ],
    });
    expect(alerts.map(a => a.id)).toEqual(['invoice-I1', 'warranty-A1']);
  });
});
