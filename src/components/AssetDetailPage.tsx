import { useMemo, useState, type ReactNode } from 'react';
import { Archive, ArrowLeft, CalendarClock, Edit, History as HistoryIcon, Package, Printer, ShieldCheck, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DEFAULT_SYSTEM_POLICY, type SystemPolicy } from '@/data/masterData';
import type { Asset, AssetHistoryEvent, Assignment, Invoice, ItCallLog, Location, MaintenanceRecord, User, Vendor } from '@/data/models';
import { formatCurrency, formatDateTime } from '@/data/models';
import { daysUntil } from '@/lib/alerts';
import { dmy } from '@/lib/dates';
import { useCollection } from '@/lib/db';
import { depreciationFor, describeAge } from '@/lib/depreciation';
import { getDeviceSpec } from '@/lib/deviceSpecs';
import { renderLabel } from '@/lib/labels';
import { masterLabel } from '@/lib/masterLabel';

type Tab = 'summary' | 'details' | 'assignments' | 'maintenance' | 'invoice' | 'history';
const TABS: Array<[Tab, string]> = [
  ['summary', 'Summary'], ['details', 'Details'], ['assignments', 'Assignments'], ['maintenance', 'Maintenance'], ['invoice', 'Invoice & warranty'], ['history', 'History'],
];

interface Props {
  asset: Asset;
  users: User[];
  sites: Location[];
  invoices: Invoice[];
  history: AssetHistoryEvent[];
  onBack: () => void;
  onEdit: () => void;
  onLabel: () => void;
  /** The "more actions" menu (move, transfer, archive…), supplied by the Assets page. */
  menu: ReactNode;
}

const STATUS_LABEL: Record<string, string> = { maintenance: 'Under repair' };
const STATUS_TONE: Record<string, string> = {
  available: 'bg-chart-2/10 text-chart-2 border-chart-2/25',
  assigned: 'bg-primary/10 text-primary border-primary/25',
  maintenance: 'bg-chart-3/15 text-chart-3 border-chart-3/30',
  retired: 'bg-muted text-muted-foreground border-border',
  disposed: 'bg-muted text-muted-foreground border-border',
  lost: 'bg-destructive/10 text-destructive border-destructive/25',
};

/** History actions grouped the way people look for them. */
const HISTORY_GROUPS: Array<{ key: string; label: string; actions: string[] }> = [
  { key: 'purchase', label: 'Purchase & receipt', actions: ['Purchased', 'Received'] },
  { key: 'assignment', label: 'Assignment & handover', actions: ['Assigned', 'Returned', 'Transferred'] },
  { key: 'maintenance', label: 'Maintenance', actions: ['Under Repair', 'Repair Completed'] },
  { key: 'location', label: 'Location & status', actions: ['Moved', 'Status Changed'] },
  { key: 'lifecycle', label: 'Lifecycle', actions: ['Retired', 'Disposed', 'Lost', 'Found', 'Archived', 'Restored'] },
  { key: 'edits', label: 'Edits', actions: ['Updated'] },
];
const groupOf = (action: string) => HISTORY_GROUPS.find(g => g.actions.includes(action)) ?? { key: 'edits', label: 'Other', actions: [] };

/* ───────────────────────── page ───────────────────────── */

export function AssetDetailPage({ asset, users, sites, invoices, history, onBack, onEdit, onLabel, menu }: Props) {
  const [tab, setTab] = useState<Tab>('summary');
  const [assignments] = useCollection<Assignment>('assignments');
  const [maintenance] = useCollection<MaintenanceRecord>('maintenance');
  const [calls] = useCollection<ItCallLog>('call-logs');
  const [vendors] = useCollection<Vendor>('vendors');
  const [policies] = useCollection<SystemPolicy>('system-policies');
  const policy = policies[0] || DEFAULT_SYSTEM_POLICY;

  const site = sites.find(s => s.id === asset.siteId);
  const holder = asset.assignedTo ? users.find(u => u.id === asset.assignedTo) : undefined;
  const myAssignments = useMemo(() => assignments.filter(a => a.assetId === asset.id).sort((a, b) => (b.assignedDate || '').localeCompare(a.assignedDate || '')), [assignments, asset.id]);
  const myMaintenance = useMemo(() => maintenance.filter(m => m.assetId === asset.id).sort((a, b) => (b.date || '').localeCompare(a.date || '')), [maintenance, asset.id]);
  const myCalls = useMemo(() => calls.filter(c => c.assetTag && c.assetTag === asset.assetTag).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)), [calls, asset.assetTag]);
  const myHistory = useMemo(() => history.filter(h => h.assetId === asset.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp)), [history, asset.id]);
  const invoice = asset.invoiceId ? invoices.find(i => i.id === asset.invoiceId) : undefined;
  const vendor = vendors.find(v => v.id === (asset.vendorId || invoice?.vendorId));
  const nextService = myMaintenance.filter(m => m.status !== 'completed' && m.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date))[0];
  const dep = depreciationFor(asset, policy);
  const warrantyDays = daysUntil(asset.warrantyExpiry);
  const userName = (id?: string) => (id ? users.find(u => u.id === id)?.name || id : '');
  const statusText = STATUS_LABEL[asset.status] || asset.status;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to assets"><ArrowLeft className="h-5 w-5" /></Button>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm text-muted-foreground">{asset.assetTag}</p>
          <h1 className="truncate text-2xl font-bold tracking-tight">{asset.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {asset.archivedAt
            ? <Badge variant="outline" className="bg-muted text-muted-foreground"><Archive className="mr-1 h-3 w-3" /> Archived</Badge>
            : <Badge variant="outline" className={`capitalize ${STATUS_TONE[asset.status] || ''}`}>{statusText}</Badge>}
          {asset.condition && <Badge variant="outline" className="capitalize">{masterLabel('asset-conditions', asset.condition)}</Badge>}
          <Button variant="outline" onClick={onLabel}><Printer className="h-4 w-4" /> Print label</Button>
          {!asset.archivedAt && <Button onClick={onEdit}><Edit className="h-4 w-4" /> Edit</Button>}
          {menu}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {label}
            {key === 'maintenance' && myMaintenance.length > 0 && <span className="ml-1.5 text-xs opacity-70">{myMaintenance.length}</span>}
            {key === 'assignments' && myAssignments.length > 0 && <span className="ml-1.5 text-xs opacity-70">{myAssignments.length}</span>}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column */}
        <div className="min-w-0 space-y-5">
          {tab === 'summary' && <SummaryTab history={myHistory} maintenance={myMaintenance} calls={myCalls} userName={userName} />}
          {tab === 'details' && <DetailsTab asset={asset} site={site} holder={holder} />}
          {tab === 'assignments' && <AssignmentsTab rows={myAssignments} />}
          {tab === 'maintenance' && <MaintenanceTab rows={myMaintenance} calls={myCalls} />}
          {tab === 'invoice' && <InvoiceTab asset={asset} invoice={invoice} vendorName={vendor?.name} warrantyDays={warrantyDays} />}
          {tab === 'history' && <HistoryTab events={myHistory} userName={userName} />}
        </div>

        {/* Side column */}
        <aside className="space-y-5">
          <IdentityCard asset={asset} site={site} ageYears={dep.ageYears} onLabel={onLabel} />
          <WarrantyCard asset={asset} days={warrantyDays} />
          <CustodyCard asset={asset} holder={holder} assignment={myAssignments.find(a => a.status === 'active')} />
          <DepreciationCard dep={dep} />
          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4" /> Upcoming maintenance</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {nextService ? (
                <>
                  <p className="font-medium">{dmy(nextService.date)} <span className="text-muted-foreground">({describeDays(daysUntil(nextService.date))})</span></p>
                  <p className="text-muted-foreground">{nextService.description || nextService.type}</p>
                </>
              ) : <p className="text-muted-foreground">Nothing scheduled.</p>}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function describeDays(days: number) {
  if (Number.isNaN(days)) return '';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return days < 0 ? `${Math.abs(days)} days ago` : `${days} days to go`;
}

/* ───────────────────────── side cards ───────────────────────── */

function KV({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-baseline justify-between gap-3 py-1"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words text-right font-medium">{children || '—'}</dd></div>;
}

function IdentityCard({ asset, site, ageYears, onLabel }: { asset: Asset; site?: Location; ageYears: number; onLabel: () => void }) {
  const svg = useMemo(() => {
    try {
      return renderLabel(
        { tag: asset.assetTag, lines: [{ key: 'model', text: `${asset.manufacturer} ${asset.model}`.trim() }, { key: 'site', text: site?.name || '' }], code: asset.assetTag },
        { widthMm: 34, heightMm: 22, layout: 'qr', border: true },
      ).svg;
    } catch { return ''; }
  }, [asset.assetTag, asset.manufacturer, asset.model, site?.name]);
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        {svg && (
          <button type="button" onClick={onLabel} className="mx-auto block rounded-lg bg-muted/50 p-3 transition-colors hover:bg-muted" aria-label="Print label" title="Print label">
            <div className="mx-auto w-44 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          </button>
        )}
        <dl className="text-sm">
          <KV label="Serial number"><span className="font-mono">{asset.serialNumber}</span></KV>
          <KV label="Make">{asset.manufacturer}</KV>
          <KV label="Model">{asset.model}</KV>
          <KV label="Type">{masterLabel('asset-categories', asset.type)}</KV>
          <KV label="Site">{site?.name}</KV>
          <KV label="Used for">{asset.purchaseDate ? describeAge(ageYears) : ''}</KV>
        </dl>
      </CardContent>
    </Card>
  );
}

function WarrantyCard({ asset, days }: { asset: Asset; days: number }) {
  const start = asset.purchaseDate ? new Date(`${asset.purchaseDate.slice(0, 10)}T00:00:00`).getTime() : NaN;
  const end = asset.warrantyExpiry ? new Date(`${asset.warrantyExpiry.slice(0, 10)}T00:00:00`).getTime() : NaN;
  const progress = Number.isFinite(start) && Number.isFinite(end) && end > start ? Math.min(1, Math.max(0, (Date.now() - start) / (end - start))) : null;
  const tone = Number.isNaN(days) ? '' : days < 0 ? 'text-destructive' : days <= 30 ? 'text-destructive' : days <= 90 ? 'text-chart-3' : 'text-chart-2';
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Warranty</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {asset.warrantyExpiry ? (
          <>
            <p className="tabular-nums">{dmy(asset.purchaseDate) || '—'} to {dmy(asset.warrantyExpiry)}</p>
            <p className={`font-semibold ${tone}`}>{days < 0 ? `Expired ${Math.abs(days)} day${days === -1 ? '' : 's'} ago` : days === 0 ? 'Expires today' : `${days} day${days === 1 ? '' : 's'} left`}</p>
            {progress !== null && <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden><div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
          </>
        ) : <p className="text-muted-foreground">No warranty date recorded.</p>}
        {asset.amcExpiry && <p className="text-muted-foreground">AMC until {dmy(asset.amcExpiry)}{asset.amcProvider ? ` · ${asset.amcProvider}` : ''}</p>}
        {asset.insuranceExpiry && <p className="text-muted-foreground">Insurance until {dmy(asset.insuranceExpiry)}{asset.insuranceProvider ? ` · ${asset.insuranceProvider}` : ''}</p>}
      </CardContent>
    </Card>
  );
}

function CustodyCard({ asset, holder, assignment }: { asset: Asset; holder?: User; assignment?: Assignment }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Current user</CardTitle></CardHeader>
      <CardContent className="text-sm">
        {holder ? (
          <>
            <p className="font-medium">{holder.name}</p>
            <p className="text-muted-foreground">{holder.department}{assignment?.assignedDate ? ` · since ${dmy(assignment.assignedDate)}` : ''}</p>
          </>
        ) : <p className="text-muted-foreground">{asset.status === 'assigned' ? 'Assigned (user not found)' : 'Not assigned. In stock.'}</p>}
      </CardContent>
    </Card>
  );
}

function DepreciationCard({ dep }: { dep: ReturnType<typeof depreciationFor> }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Depreciation</CardTitle></CardHeader>
      <CardContent className="text-sm">
        <dl>
          <KV label="Purchased cost">{formatCurrency(dep.cost)}</KV>
          <KV label="Current value"><span className="tabular-nums">{formatCurrency(dep.current)}</span></KV>
          <KV label="Depreciated"><span className="tabular-nums">{formatCurrency(dep.depreciated)}{dep.method === 'straight-line' ? ` (${dep.percent}%)` : ''}</span></KV>
          <KV label="Useful life">{dep.method === 'straight-line' ? `${dep.usefulLifeYears} years` : 'Not depreciated'}</KV>
          {dep.endOfLife && <KV label="End of life">{dmy(dep.endOfLife)}</KV>}
        </dl>
      </CardContent>
    </Card>
  );
}

/* ───────────────────────── tabs ───────────────────────── */

function Empty({ icon: Icon, children }: { icon: typeof Package; children: ReactNode }) {
  return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"><Icon className="mx-auto mb-2 h-6 w-6 opacity-60" />{children}</div>;
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-base">{title}</CardTitle>{action}</CardHeader><CardContent>{children}</CardContent></Card>;
}

function EventCard({ e, userName }: { e: AssetHistoryEvent; userName: (id?: string) => string }) {
  const lines: Array<[string, string]> = [];
  if (e.from || e.to) lines.push(['From → To', `${e.from || '—'} → ${e.to || '—'}`]);
  if (e.performedBy) lines.push(['By', userName(e.performedBy)]);
  if (e.reason) lines.push(['Reason', e.reason]);
  if (e.notes) lines.push(['Notes', e.notes]);
  if (e.cost) lines.push(['Cost', formatCurrency(e.cost)]);
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{e.action}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{formatDateTime(e.timestamp)}</p>
      </div>
      {lines.length > 0 && <dl className="mt-1.5 space-y-0.5 text-sm">{lines.map(([k, v]) => <div key={k} className="flex gap-2"><dt className="w-20 shrink-0 text-muted-foreground">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>)}</dl>}
    </div>
  );
}

function SummaryTab({ history, maintenance, calls, userName }: { history: AssetHistoryEvent[]; maintenance: MaintenanceRecord[]; calls: ItCallLog[]; userName: (id?: string) => string }) {
  return (
    <>
      <Section title="Recent activity">
        {history.length === 0 ? <Empty icon={HistoryIcon}>No activity recorded yet.</Empty> : (
          <ol className="relative space-y-3 border-l pl-5">
            {history.slice(0, 5).map(e => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
                <EventCard e={e} userName={userName} />
              </li>
            ))}
          </ol>
        )}
      </Section>
      <Section title="Recent maintenance">
        {maintenance.length === 0 ? <Empty icon={Wrench}>No maintenance recorded.</Empty> : <MaintenanceList rows={maintenance.slice(0, 3)} />}
      </Section>
      {calls.length > 0 && (
        <Section title="IT calls for this asset">
          <ul className="divide-y text-sm">
            {calls.slice(0, 3).map(c => <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2"><span className="min-w-0 truncate">{c.issue}</span><span className="text-xs text-muted-foreground">{dmy(c.date)} · {c.status}</span></li>)}
          </ul>
        </Section>
      )}
    </>
  );
}

function DetailsTab({ asset, site, holder }: { asset: Asset; site?: Location; holder?: User }) {
  const spec = getDeviceSpec(asset.id) as Record<string, unknown> | undefined;
  const techRows = Object.entries(spec || {}).filter(([k, v]) => !['id', 'assetId', 'enabled'].includes(k) && v !== '' && v != null && v !== false)
    .map(([k, v]) => [k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()), v === true ? 'Yes' : String(v)] as [string, string]);
  return (
    <>
      <Section title="Identification"><dl className="text-sm">
        <KV label="Asset tag"><span className="font-mono">{asset.assetTag}</span></KV><KV label="Name">{asset.name}</KV><KV label="Type">{masterLabel('asset-categories', asset.type)}</KV>
        <KV label="Make">{asset.manufacturer}</KV><KV label="Model">{asset.model}</KV><KV label="Serial number"><span className="font-mono">{asset.serialNumber}</span></KV>
        <KV label="Condition">{asset.condition ? masterLabel('asset-conditions', asset.condition) : ''}</KV><KV label="Accessories">{asset.accessories}</KV>
      </dl></Section>
      <Section title="Location & custody"><dl className="text-sm">
        <KV label="Site">{site?.name}</KV><KV label="Status"><span className="capitalize">{STATUS_LABEL[asset.status] || asset.status}</span></KV><KV label="Assigned to">{holder?.name}</KV>
      </dl></Section>
      <Section title="Purchase"><dl className="text-sm">
        <KV label="Purchase date">{dmy(asset.purchaseDate)}</KV><KV label="Purchase price">{formatCurrency(asset.purchasePrice)}</KV>
      </dl></Section>
      {techRows.length > 0 && <Section title="Technical profile"><dl className="grid gap-x-8 text-sm sm:grid-cols-2">{techRows.map(([k, v]) => <KV key={k} label={k}>{v}</KV>)}</dl></Section>}
      {asset.notes && <Section title="Notes"><p className="whitespace-pre-wrap text-sm">{asset.notes}</p></Section>}
    </>
  );
}

function AssignmentsTab({ rows }: { rows: Assignment[] }) {
  if (rows.length === 0) return <Empty icon={Package}>This asset has not been assigned to anyone yet.</Empty>;
  return (
    <Section title="Assignment history">
      <ul className="divide-y">
        {rows.map(a => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
            <div><p className="font-medium">{a.userName}</p><p className="text-xs text-muted-foreground">{dmy(a.assignedDate)}{a.returnDate ? ` to ${dmy(a.returnDate)}` : ' to now'}{a.notes ? ` · ${a.notes}` : ''}</p></div>
            <Badge variant="outline" className="capitalize">{a.status}</Badge>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function MaintenanceList({ rows }: { rows: MaintenanceRecord[] }) {
  return (
    <ul className="divide-y">
      {rows.map(m => (
        <li key={m.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
          <div className="min-w-0"><p className="font-medium capitalize">{m.type}</p><p className="text-xs text-muted-foreground">{dmy(m.date)}{m.technician ? ` · ${m.technician}` : ''}</p>{m.description && <p className="mt-0.5 break-words">{m.description}</p>}</div>
          <div className="text-right"><Badge variant="outline" className="capitalize">{m.status}</Badge>{m.cost ? <p className="mt-1 text-xs tabular-nums text-muted-foreground">{formatCurrency(m.cost)}</p> : null}</div>
        </li>
      ))}
    </ul>
  );
}

function MaintenanceTab({ rows, calls }: { rows: MaintenanceRecord[]; calls: ItCallLog[] }) {
  const total = rows.reduce((sum, m) => sum + (Number(m.cost) || 0), 0);
  return (
    <>
      <Section title="Maintenance and repairs" action={total > 0 ? <span className="text-sm text-muted-foreground">Total cost <b className="tabular-nums text-foreground">{formatCurrency(total)}</b></span> : undefined}>
        {rows.length === 0 ? <Empty icon={Wrench}>No maintenance recorded. Log a repair from IT Operations → Repair &amp; Maintenance.</Empty> : <MaintenanceList rows={rows} />}
      </Section>
      {calls.length > 0 && (
        <Section title="IT calls raised for this asset"><ul className="divide-y text-sm">
          {calls.map(c => <li key={c.id} className="py-2.5"><div className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-medium">{c.id}</span><span className="text-xs text-muted-foreground">{dmy(c.date)} · {c.status}</span></div><p className="text-muted-foreground">{c.issue}</p></li>)}
        </ul></Section>
      )}
    </>
  );
}

function InvoiceTab({ asset, invoice, vendorName, warrantyDays }: { asset: Asset; invoice?: Invoice; vendorName?: string; warrantyDays: number }) {
  return (
    <>
      <Section title="Purchase invoice">
        {invoice ? (
          <dl className="text-sm">
            <KV label="Invoice number">{invoice.invoiceNumber}</KV><KV label="Vendor">{vendorName}</KV><KV label="Invoice date">{dmy(invoice.invoiceDate)}</KV>
            <KV label="PO number">{invoice.poNumber}</KV><KV label="Invoice total">{invoice.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} {(invoice.currency || '').split(' ')[0]}</KV>
            <KV label="Status"><span className="capitalize">{invoice.status}</span></KV>
          </dl>
        ) : <p className="text-sm text-muted-foreground">{vendorName ? `Bought from ${vendorName}. ` : ''}Not linked to a vendor invoice.</p>}
      </Section>
      <Section title="Coverage"><dl className="text-sm">
        <KV label="Warranty">{asset.warrantyExpiry ? `${dmy(asset.purchaseDate)} to ${dmy(asset.warrantyExpiry)}` : ''}</KV>
        <KV label="Warranty status">{Number.isNaN(warrantyDays) ? '' : warrantyDays < 0 ? `Expired ${Math.abs(warrantyDays)} days ago` : `${warrantyDays} days left`}</KV>
        <KV label="AMC provider">{asset.amcProvider}</KV><KV label="AMC until">{dmy(asset.amcExpiry)}</KV>
        <KV label="Insurer">{asset.insuranceProvider}</KV><KV label="Insurance until">{dmy(asset.insuranceExpiry)}</KV>
      </dl></Section>
    </>
  );
}

function HistoryTab({ events, userName }: { events: AssetHistoryEvent[]; userName: (id?: string) => string }) {
  const [group, setGroup] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const shown = events.filter(e => {
    const day = e.timestamp.slice(0, 10);
    return (group === 'all' || groupOf(e.action).key === group) && (!from || day >= from) && (!to || day <= to);
  });
  // Group consecutive events of the same kind under one heading, newest first.
  const blocks: Array<{ label: string; items: AssetHistoryEvent[] }> = [];
  for (const e of shown) {
    const label = groupOf(e.action).label;
    const last = blocks[blocks.length - 1];
    if (last && last.label === label) last.items.push(e); else blocks.push({ label, items: [e] });
  }
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
      <Section title="Asset history">
        {blocks.length === 0 ? <Empty icon={HistoryIcon}>{events.length ? 'No events match these filters.' : 'No history recorded yet.'}</Empty> : (
          <div className="space-y-5">
            {blocks.map((b, i) => (
              <div key={`${b.label}-${i}`}>
                <h4 className="mb-2 text-sm font-semibold text-muted-foreground">{b.label}</h4>
                <ol className="relative space-y-3 border-l pl-5">
                  {b.items.map(e => <li key={e.id} className="relative"><span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary/70" aria-hidden /><EventCard e={e} userName={userName} /></li>)}
                </ol>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Card className="h-fit">
        <CardHeader className="pb-2"><CardTitle className="text-base">Filter</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <select aria-label="History type" className="h-10 w-full rounded-md border bg-background px-3" value={group} onChange={e => setGroup(e.target.value)}>
            <option value="all">All history</option>
            {HISTORY_GROUPS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
          <label className="block space-y-1">From<Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="block space-y-1">To<Input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          {(group !== 'all' || from || to) && <Button variant="ghost" size="sm" onClick={() => { setGroup('all'); setFrom(''); setTo(''); }}>Clear filters</Button>}
        </CardContent>
      </Card>
    </div>
  );
}
