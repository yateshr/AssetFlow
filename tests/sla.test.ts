import { describe, expect, it } from 'vitest';
import { slaFor } from '@/lib/sla';
import type { ItCallLog } from '@/data/models';

const priorities = [
  { id: 'high', name: 'High', active: true, targetHours: 8 },
  { id: 'none', name: 'None', active: true },
];
const call = (over: Partial<ItCallLog>): ItCallLog =>
  ({ id: 'C1', date: '2026-11-20', time: '10:00', callerName: 'A', department: 'IT', contactNumber: '1', category: 'hardware', priority: 'high', issue: 'x', assignedTo: 'IT Team', status: 'open', ...over }) as ItCallLog;

describe('slaFor', () => {
  const start = new Date('2026-11-20T10:00:00');
  const later = (hours: number) => new Date(start.getTime() + hours * 3_600_000);

  it('is on track well before the due time', () => expect(slaFor(call({}), priorities, later(1)).state).toBe('on-track'));
  it('warns in the last quarter of the time', () => expect(slaFor(call({}), priorities, later(7)).state).toBe('due-soon'));

  it('is breached after the target hours', () => {
    const sla = slaFor(call({}), priorities, later(10));
    expect(sla.state).toBe('breached');
    expect(sla.label).toMatch(/Overdue/);
  });

  it('has no SLA when the priority has no target', () => expect(slaFor(call({ priority: 'none' }), priorities).state).toBe('none'));
  it('has no SLA for an unknown priority', () => expect(slaFor(call({ priority: 'gone' }), priorities).state).toBe('none'));

  it('marks resolved calls met or missed', () => {
    expect(slaFor(call({ status: 'resolved', closedAt: '2026-11-20T15:00:00' }), priorities).state).toBe('met');
    expect(slaFor(call({ status: 'resolved', closedAt: '2026-11-21T15:00:00' }), priorities).state).toBe('missed');
  });
});
