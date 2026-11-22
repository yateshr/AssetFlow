/** Call-log SLA: due time comes from the priority's target hours in Settings. */
import type { ItCallLog } from '@/data/models';
import type { MasterDataOption } from '@/data/masterData';

export type SlaState = 'none' | 'on-track' | 'due-soon' | 'breached' | 'met' | 'missed';
export interface SlaInfo { state: SlaState; dueAt?: Date; label: string }

const HOUR = 3_600_000;

function startOf(call: ItCallLog): Date | null {
  const d = new Date(`${call.date}T${/^\d{1,2}:\d{2}/.test(call.time || '') ? call.time : '00:00'}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolvedAt(call: ItCallLog): Date | null {
  const raw = call.closedAt || call.resolutionDate;
  if (!raw) return null;
  const d = new Date(raw.length <= 10 ? `${raw}T23:59:59` : raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function span(ms: number) {
  const h = Math.round(Math.abs(ms) / HOUR);
  return h >= 48 ? `${Math.round(h / 24)}d` : `${h}h`;
}

export function slaFor(call: ItCallLog, priorities: MasterDataOption[], now = new Date()): SlaInfo {
  const hours = priorities.find(p => p.id === call.priority)?.targetHours;
  const start = startOf(call);
  if (!hours || !start) return { state: 'none', label: '—' };
  const dueAt = new Date(start.getTime() + hours * HOUR);
  if (call.status === 'resolved' || call.status === 'closed') {
    const done = resolvedAt(call);
    if (!done) return { state: 'met', dueAt, label: 'Resolved' };
    return done <= dueAt ? { state: 'met', dueAt, label: 'Met SLA' } : { state: 'missed', dueAt, label: `Missed by ${span(done.getTime() - dueAt.getTime())}` };
  }
  const left = dueAt.getTime() - now.getTime();
  if (left < 0) return { state: 'breached', dueAt, label: `Overdue ${span(left)}` };
  if (left <= Math.max(HOUR, hours * HOUR * 0.25)) return { state: 'due-soon', dueAt, label: `Due in ${span(left)}` };
  return { state: 'on-track', dueAt, label: `Due in ${span(left)}` };
}
