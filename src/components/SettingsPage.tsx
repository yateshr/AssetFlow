import { useMemo, useState, type ReactNode } from 'react';
import {
  Archive, ArrowUpRight, BellRing, Boxes, Hash, Coins, Globe2, Headset, MapPin, Plus, RotateCcw, ShieldCheck, Trash2, Undo2,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { ExportMenu } from '@/components/ExportMenu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AssetSetupPanel } from '@/components/AssetSetupPanel';
import { TimeZoneSelect } from '@/components/ui/timezone-select';
import { getCollection, kv, useCollection } from '@/lib/db';
import { DEFAULT_SYSTEM_POLICY, MASTER_DATA_DEFAULTS, type MasterDataOption, type SystemPolicy } from '@/data/masterData';

/* ───────────────────────── list definitions ───────────────────────── */

type Extra = 'rate' | 'days' | 'sla' | 'tone';

interface ListDef {
  title: string;
  help: string;
  /** What records store: the item's id, or its visible name. Renaming a name-keyed item that is in use would orphan records. */
  keyedBy: 'id' | 'name';
  extra?: Extra;
  /** How many existing records use the item. */
  usage: (item: MasterDataOption) => number;
  /** Where the item is used, shown as help. */
  usedIn: string;
}

type Row = Record<string, unknown>;
const rows = (collection: string) => getCollection<Row>(collection);
const countWhere = (collection: string, test: (r: Row) => boolean) => rows(collection).filter(test).length;
const lower = (v: unknown) => String(v ?? '').trim().toLowerCase();

const LISTS: Record<string, ListDef> = {
  currencies: {
    title: 'Currencies', keyedBy: 'name', extra: 'rate', usedIn: 'Invoices and vendors',
    help: 'Invoices and vendors can be priced in any active currency. Set the exchange rate so spend reports can add foreign invoices to your default currency.',
    usage: item => countWhere('invoices', r => lower(r.currency).startsWith(lower(item.id))) + countWhere('vendors', r => lower(r.currency).startsWith(lower(item.id))),
  },
  'units-of-measure': {
    title: 'Units of measure', keyedBy: 'name', usedIn: 'Invoice line items',
    help: 'How purchased items are counted on invoices.',
    usage: item => rows('invoices').reduce((n, inv) => n + ((inv.lineItems as Row[] | undefined) || []).filter(l => lower(l.unit) === lower(item.name)).length, 0),
  },
  'payment-methods': {
    title: 'Payment methods', keyedBy: 'name', usedIn: 'Recording invoice payments',
    help: 'Choices offered when you record a payment against an invoice.',
    usage: item => countWhere('invoices', r => lower(r.paymentMethod) === lower(item.name)),
  },
  'payment-terms': {
    title: 'Payment terms', keyedBy: 'name', extra: 'days', usedIn: 'Invoice due dates',
    help: 'Picking a term on an invoice fills in the due date automatically (invoice date + days).',
    usage: item => countWhere('invoices', r => lower(r.paymentTerms) === lower(item.name)),
  },
  'asset-conditions': {
    title: 'Asset conditions', keyedBy: 'id', usedIn: 'Asset form and check-in/out',
    help: 'Physical condition recorded on assets and when they are returned. “New”, “Damaged” and “Missing” trigger built-in behaviour, so keep them.',
    usage: item => countWhere('assets', r => r.condition === item.id),
  },
  'license-types': {
    title: 'License types', keyedBy: 'id', usedIn: 'Software licenses',
    help: 'How a software license is bought, for example subscription or perpetual.',
    usage: item => countWhere('licenses', r => r.type === item.id),
  },
  'call-categories': {
    title: 'IT call categories', keyedBy: 'id', usedIn: 'IT Call Logbook',
    help: 'What a support call is about.',
    usage: item => countWhere('call-logs', r => r.category === item.id),
  },
  'call-priorities': {
    title: 'Priorities & SLA', keyedBy: 'id', extra: 'sla', usedIn: 'IT Call Logbook, notifications',
    help: 'Target hours drive each call’s due time. Open calls past it show “Overdue” and raise a notification.',
    usage: item => countWhere('call-logs', r => r.priority === item.id),
  },
  'support-teams': {
    title: 'Support teams', keyedBy: 'name', usedIn: 'Call assignment',
    help: 'Teams or people a call can be assigned to.',
    usage: item => countWhere('call-logs', r => lower(r.assignedTo) === lower(item.name)),
  },
  'location-types': {
    title: 'Site types', keyedBy: 'id', usedIn: 'Sites',
    help: 'Kinds of site: office, plant, warehouse and so on.',
    usage: item => countWhere('locations', r => r.type === item.id),
  },
  'infrastructure-types': {
    title: 'Infrastructure types', keyedBy: 'id', usedIn: 'Operations → Infrastructure',
    help: 'Kinds of network and server equipment.',
    usage: item => {
      return countWhere('infrastructure', r => r.type === item.id);
    },
  },
};

interface Section { id: string; label: string; icon: LucideIcon; blurb: string; lists?: string[] }
const SECTIONS: Section[] = [
  { id: 'regional', label: 'Regional & formats', icon: Globe2, blurb: 'Currency, language and time zone used to display money, dates and numbers everywhere.' },
  { id: 'asset-setup', label: 'Asset setup', icon: Hash, blurb: 'Asset types and how asset tags are numbered at each site.' },
  { id: 'finance', label: 'Procurement & finance', icon: Coins, blurb: 'Currencies, units, payment methods and payment terms used on invoices.', lists: ['currencies', 'units-of-measure', 'payment-methods', 'payment-terms'] },
  { id: 'assets', label: 'Assets & licenses', icon: Boxes, blurb: 'Reference values used when recording assets and software licenses.', lists: ['asset-conditions', 'license-types'] },
  { id: 'support', label: 'Support desk', icon: Headset, blurb: 'Categories, priorities with response targets, and teams for the IT call logbook.', lists: ['call-categories', 'call-priorities', 'support-teams'] },
  { id: 'sites', label: 'Sites & infrastructure', icon: MapPin, blurb: 'Kinds of site and network equipment.', lists: ['location-types', 'infrastructure-types'] },
  { id: 'alerts', label: 'Alerts & depreciation', icon: BellRing, blurb: 'When warnings start and how asset value is written down.' },
  { id: 'workflows', label: 'Protected workflows', icon: ShieldCheck, blurb: 'Fixed values the app relies on for permissions, accounting and lifecycle.' },
];

const toneOf = (item: MasterDataOption) => item.tone || ({ low: 'green', medium: 'blue', high: 'orange', critical: 'red' } as Record<string, MasterDataOption['tone']>)[item.id] || 'gray';
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
const TONES: Array<NonNullable<MasterDataOption['tone']>> = ['gray', 'green', 'blue', 'amber', 'orange', 'red'];
const TONE_DOT: Record<string, string> = {
  gray: 'bg-muted-foreground', green: 'bg-chart-2', blue: 'bg-primary', amber: 'bg-amber-500', orange: 'bg-chart-5', red: 'bg-destructive',
};
const LOCALES: Array<[string, string]> = [
  ['en-IN', 'English (India) — 1,23,456.00'], ['en-US', 'English (United States) — 123,456.00'], ['en-GB', 'English (United Kingdom)'],
  ['en-AE', 'English (UAE)'], ['en-SG', 'English (Singapore)'], ['en-AU', 'English (Australia)'], ['de-DE', 'German — 123.456,00'],
  ['fr-FR', 'French'], ['es-ES', 'Spanish'], ['ja-JP', 'Japanese'],
];

/* ───────────────────────── page ───────────────────────── */

export function SettingsPage({ onOpenOrganization }: { onOpenOrganization?: () => void }) {
  const [active, setActive] = useState('regional');
  const section = SECTIONS.find(s => s.id === active)!;
  const [policies, setPolicies] = useCollection<SystemPolicy>('system-policies');
  const policy = policies.find(item => item.id === 'system') || DEFAULT_SYSTEM_POLICY;
  const update = (patch: Partial<SystemPolicy>) => setPolicies([{ ...policy, ...patch, id: 'system' }]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">System setup</h2>
        <p className="mt-1 text-sm text-muted-foreground">Everything the rest of AssetFlow reads from: formats, dropdown choices, targets and defaults. Changes apply to this company only.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Setup sections" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0 lg:[&>button]:w-full">
          {SECTIONS.map(s => (
            <button key={s.id} type="button" onClick={() => setActive(s.id)} aria-current={active === s.id ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${active === s.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <s.icon className="h-4 w-4 shrink-0" /> <span className="whitespace-nowrap">{s.label}</span>
            </button>
          ))}
          {onOpenOrganization && (
            <button type="button" onClick={onOpenOrganization} className="flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:mt-3">
              <ArrowUpRight className="h-4 w-4 shrink-0" /> <span className="whitespace-nowrap">Companies</span>
            </button>
          )}
        </nav>

        <div className="min-w-0 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{section.label}</h3>
            <p className="text-sm text-muted-foreground">{section.blurb}</p>
          </div>
          {section.id === 'regional' && <RegionalPanel policy={policy} update={update} />}
          {section.id === 'alerts' && <AlertsPanel policy={policy} update={update} />}
          {section.id === 'workflows' && <WorkflowsPanel />}
          {section.id === 'asset-setup' && <AssetSetupPanel />}
          {section.id === 'support' && <DefaultsCard policy={policy} update={update} />}
          {section.lists?.map(collection => <ListEditor key={collection} collection={collection} defaultCurrency={policy.defaultCurrency} />)}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── policy panels ───────────────────────── */

type PolicyProps = { policy: SystemPolicy; update: (patch: Partial<SystemPolicy>) => void };

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="block space-y-1.5 text-sm font-medium">{label}{children}{hint && <span className="block text-xs font-normal text-muted-foreground">{hint}</span>}</label>;
}
const selectClass = 'h-10 w-full rounded-md border bg-background px-3 text-sm font-normal';

function RegionalPanel({ policy, update }: PolicyProps) {
  const [currencies] = useCollection<MasterDataOption>('currencies');
  const active = currencies.filter(c => c.active);
  const locales = LOCALES.some(([id]) => id === policy.locale) ? LOCALES : [[policy.locale, policy.locale] as [string, string], ...LOCALES];
  const preview = useMemo(() => {
    try {
      const now = new Date();
      return {
        money: new Intl.NumberFormat(policy.locale, { style: 'currency', currency: policy.defaultCurrency, maximumFractionDigits: 2 }).format(1234567.5),
        date: now.toLocaleDateString(policy.locale, { day: '2-digit', month: 'short', year: 'numeric' }),
        time: now.toLocaleString(policy.locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: policy.timezone || undefined }),
      };
    } catch { return null; }
  }, [policy.locale, policy.defaultCurrency, policy.timezone]);

  return (
    <Card>
      <CardContent className="grid gap-5 pt-6 sm:grid-cols-2">
        <Field label="Default currency" hint="Asset values, reports and dashboards are shown in this currency.">
          <select className={selectClass} value={policy.defaultCurrency} onChange={e => update({ defaultCurrency: e.target.value })}>
            {active.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            {!active.some(c => c.id === policy.defaultCurrency) && <option value={policy.defaultCurrency}>{policy.defaultCurrency}</option>}
          </select>
        </Field>
        <Field label="Number & date style" hint="Controls digit grouping and the order of day, month and year.">
          <select className={selectClass} value={policy.locale} onChange={e => update({ locale: e.target.value })}>
            {locales.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </Field>
        <Field label="Time zone" hint="Used for timestamps in lists and audit logs.">
          <TimeZoneSelect value={policy.timezone} onChange={timezone => update({ timezone })} />
        </Field>
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>
          {preview ? (
            <dl className="space-y-1">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Amount</dt><dd className="font-medium tabular-nums">{preview.money}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Date</dt><dd className="font-medium">{preview.date}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Now</dt><dd className="font-medium">{preview.time}</dd></div>
            </dl>
          ) : <p className="text-destructive">This combination is not valid.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function Num({ label, hint, value, min = 0, max, onChange }: { label: string; hint?: string; value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <Field label={label} hint={hint}>
      <Input type="number" min={min} max={max} value={value} onChange={e => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(Math.min(max ?? Infinity, Math.max(min, Math.round(n))));
      }} />
    </Field>
  );
}

function AlertsPanel({ policy, update }: PolicyProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Expiry warnings</CardTitle><CardDescription>How early the Expiry &amp; Alerts page and the notification bell start warning you.</CardDescription></CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Num label="Warranty, AMC & insurance (days)" hint="Warn this many days before an asset’s cover ends." value={policy.warrantyAlertDays} max={730} onChange={v => update({ warrantyAlertDays: v })} />
          <Num label="Software licenses (days)" hint="Warn this many days before a license expires." value={policy.licenseAlertDays} max={730} onChange={v => update({ licenseAlertDays: v })} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Depreciation</CardTitle><CardDescription>Starting values for the book-value calculation in Operations.</CardDescription></CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Num label="Useful life (years)" min={1} max={50} value={policy.usefulLifeYears} onChange={v => update({ usefulLifeYears: v })} />
          <Field label="Method">
            <select className={selectClass} value={policy.depreciationMethod} onChange={e => update({ depreciationMethod: e.target.value as SystemPolicy['depreciationMethod'] })}>
              <option value="straight-line">Straight line</option><option value="none">No depreciation</option>
            </select>
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Defaults</CardTitle><CardDescription>Pre-filled when new records are created.</CardDescription></CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Default custodian" hint="Who holds an asset while it is not assigned to anyone."><Input value={policy.defaultCustodian} onChange={e => update({ defaultCustodian: e.target.value })} /></Field>
          <Field label="Default stock location" hint="Where newly added stock items are kept."><Input value={policy.defaultStockLocation} onChange={e => update({ defaultStockLocation: e.target.value })} /></Field>
        </CardContent>
      </Card>
    </div>
  );
}

function DefaultsCard({ policy, update }: PolicyProps) {
  const [teams] = useCollection<MasterDataOption>('support-teams');
  const names = teams.filter(t => t.active && t.name.trim()).map(t => t.name);
  return (
    <Card>
      <CardContent className="pt-6">
        <Field label="Default support team" hint="New calls are assigned to this team unless changed.">
          <select className={`${selectClass} max-w-sm`} value={policy.defaultSupportTeam} onChange={e => update({ defaultSupportTeam: e.target.value })}>
            {names.map(n => <option key={n} value={n}>{n}</option>)}
            {policy.defaultSupportTeam && !names.includes(policy.defaultSupportTeam) && <option value={policy.defaultSupportTeam}>{policy.defaultSupportTeam}</option>}
          </select>
        </Field>
      </CardContent>
    </Card>
  );
}

function WorkflowsPanel() {
  const items = [
    ['User roles', 'Super admin, Admin, Manager, User'],
    ['Invoice workflow', 'Draft, Open, Received, Paid, Overdue, Cancelled'],
    ['Asset lifecycle', 'Available, Assigned, Maintenance, Retired, Disposed, Lost'],
    ['Assignment workflow', 'Pending, Active, Returned'],
  ];
  return (
    <Card>
      <CardHeader><CardDescription>These stay fixed because permissions, accounting and the asset lifecycle depend on them. They cannot be edited here.</CardDescription></CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
        {items.map(([k, v]) => <div key={k} className="rounded-lg border p-3"><p className="font-medium">{k}</p><p className="text-muted-foreground">{v}</p></div>)}
      </CardContent>
    </Card>
  );
}

/* ───────────────────────── list editor ───────────────────────── */

function ListEditor({ collection, defaultCurrency }: { collection: string; defaultCurrency: string }) {
  const def = LISTS[collection];
  const [items, setItems] = useCollection<MasterDataOption>(collection);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const defaults = MASTER_DATA_DEFAULTS[collection] || [];
  const missing = defaults.filter(d => !items.some(i => i.id === d.id));
  const usage = useMemo(() => new Map(items.map(i => [i.id, def.usage(i)])), [items, def]);
  const activeCount = items.filter(i => i.active).length;

  const nameTaken = (name: string, exceptId?: string) => items.some(i => i.id !== exceptId && lower(i.name) === lower(name));
  const patch = (id: string, change: Partial<MasterDataOption>) => setItems(items.map(i => (i.id === id ? { ...i, ...change } : i)));

  const add = () => {
    const name = draft.trim();
    if (!name) { setError('Enter a name.'); return; }
    if (nameTaken(name)) { setError(`“${name}” already exists.`); return; }
    let id = slug(name);
    for (let n = 2; items.some(i => i.id === id); n++) id = `${slug(name)}-${n}`;
    const extra: Partial<MasterDataOption> =
      def.extra === 'sla' ? { targetHours: 24, tone: 'blue' } : def.extra === 'days' ? { days: 30 } : {};
    setItems([...items, { id: collection === 'currencies' ? name.split(/\s|-/)[0].toUpperCase() || id : id, name, active: true, ...extra }]);
    setDraft(''); setError('');
  };

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<MasterDataOption[] | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const askDelete = (list: MasterDataOption[]) => { setPendingDelete(list); setDeleteOpen(true); };
  const chosen = items.filter(i => selected.has(i.id));
  const allChosen = items.length > 0 && chosen.length === items.length;
  const toggle = (id: string, on: boolean) => setSelected(prev => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next; });
  const toggleAll = (on: boolean) => setSelected(on ? new Set(items.map(i => i.id)) : new Set());
  const deletable = (list: MasterDataOption[]) => list.filter(i => !(usage.get(i.id) ?? 0));
  const bulkActive = (active: boolean) => { setItems(items.map(i => (selected.has(i.id) ? { ...i, active } : i))); toast.success(`${active ? 'Restored' : 'Archived'} ${chosen.length} item${chosen.length === 1 ? '' : 's'}`); setSelected(new Set()); };
  const confirmDelete = () => {
    const doomed = new Set(deletable(pendingDelete || []).map(i => i.id));
    setItems(items.filter(i => !doomed.has(i.id)));
    const skipped = (pendingDelete?.length || 0) - doomed.size;
    toast.success(`Deleted ${doomed.size} item${doomed.size === 1 ? '' : 's'}${skipped ? `; ${skipped} in use were kept` : ''}`);
    setSelected(new Set()); setDeleteOpen(false);
  };

  const blanks = items.filter(i => !i.name.trim() && !(usage.get(i.id) ?? 0));
  const cleanBlanks = () => { setItems(items.filter(i => i.name.trim() || (usage.get(i.id) ?? 0))); toast.success(`Removed ${blanks.length} blank entr${blanks.length === 1 ? 'y' : 'ies'}`); };

  const restore = () => { setItems([...items, ...missing]); toast.success(`Restored ${missing.length} default${missing.length === 1 ? '' : 's'}`); };

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">{def.title}</CardTitle>
            <CardDescription>{def.help}</CardDescription>
            <p className="mt-1 text-xs text-muted-foreground">Used in: {def.usedIn} · {activeCount} active{items.length > activeCount ? `, ${items.length - activeCount} archived` : ''}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {blanks.length > 0 && <Button size="sm" variant="outline" onClick={cleanBlanks} title="Entries with no name were left by the old editor"><Trash2 className="h-4 w-4" /> Remove {blanks.length} blank</Button>}
            {missing.length > 0 && <Button size="sm" variant="outline" onClick={restore} title={missing.map(m => m.name).join(', ')}><RotateCcw className="h-4 w-4" /> Restore defaults ({missing.length})</Button>}
            <ExportMenu label="Export" disabled={!items.length} build={() => ({
              name: collection, sheet: def.title,
              headers: ['Name', 'Active', 'In use', ...(def.extra === 'rate' ? ['Exchange rate'] : def.extra === 'days' ? ['Days'] : def.extra === 'sla' ? ['Target hours'] : [])],
              rows: items.map(i => [i.name, i.active, usage.get(i.id) ?? 0, ...(def.extra === 'rate' ? [i.rate ?? ''] : def.extra === 'days' ? [i.days ?? ''] : def.extra === 'sla' ? [i.targetHours ?? ''] : [])]),
            })} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); add(); }}>
          <Input value={draft} onChange={e => { setDraft(e.target.value); setError(''); }} placeholder={`Add to ${def.title.toLowerCase()}…`} aria-label={`New ${def.title} name`} aria-invalid={!!error} />
          <Button type="submit"><Plus className="h-4 w-4" /> Add</Button>
        </form>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <label className="flex cursor-pointer items-center gap-2 font-medium">
              <Checkbox checked={allChosen ? true : chosen.length ? 'indeterminate' : false} onCheckedChange={v => toggleAll(v === true)} aria-label="Select all" />
              {chosen.length ? `${chosen.length} selected` : 'Select all'}
            </label>
            {chosen.length > 0 && (
              <span className="ml-auto flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => bulkActive(false)}><Archive className="h-4 w-4" /> Archive</Button>
                <Button size="sm" variant="outline" onClick={() => bulkActive(true)}><Undo2 className="h-4 w-4" /> Restore</Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => askDelete(chosen)}><Trash2 className="h-4 w-4" /> Delete</Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
              </span>
            )}
          </div>
        )}

        <ul className="divide-y rounded-lg border">
          {items.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Nothing here yet.</li>}
          {items.map(item => {
            const used = usage.get(item.id) ?? 0;
            const locked = def.keyedBy === 'name' && used > 0;
            const noRate = def.extra === 'rate' && item.active && item.id.toUpperCase() !== defaultCurrency.toUpperCase() && !(item.rate && item.rate > 0) && used > 0;
            return (
              <li key={item.id} className={`flex flex-wrap items-center gap-2 p-2.5 ${item.active ? '' : 'bg-muted/40'}`}>
                <Checkbox checked={selected.has(item.id)} onCheckedChange={v => toggle(item.id, v === true)} aria-label={`Select ${item.name || 'blank entry'}`} />
                {def.extra === 'tone' || def.extra === 'sla' ? <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[toneOf(item)]}`} aria-hidden /> : null}
                <NameInput item={item} locked={locked} taken={name => nameTaken(name, item.id)} onCommit={name => patch(item.id, { name })} dim={!item.active} />
                {def.extra === 'rate' && (
                  item.id.toUpperCase() === defaultCurrency.toUpperCase()
                    ? <Badge variant="secondary">Default currency</Badge>
                    : <label className="flex items-center gap-1.5 text-xs text-muted-foreground">1 {item.id} =
                        <Input type="number" min="0" step="any" className="h-8 w-24" value={item.rate ?? ''} placeholder="rate" onChange={e => patch(item.id, { rate: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })} aria-label={`Exchange rate for ${item.id}`} />{defaultCurrency}</label>
                )}
                {def.extra === 'days' && <label className="flex items-center gap-1.5 text-xs text-muted-foreground">Due after<Input type="number" min="0" max="365" className="h-8 w-20" value={item.days ?? 0} onChange={e => patch(item.id, { days: Math.min(365, Math.max(0, Math.round(Number(e.target.value) || 0))) })} />days</label>}
                {def.extra === 'sla' && (
                  <>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">Resolve within<Input type="number" min="1" max="720" className="h-8 w-20" value={item.targetHours ?? ''} onChange={e => patch(item.id, { targetHours: Math.min(720, Math.max(1, Math.round(Number(e.target.value) || 1))) })} />h</label>
                    <select aria-label="Badge colour" className="h-8 rounded-md border bg-background px-2 text-xs" value={toneOf(item)} onChange={e => patch(item.id, { tone: e.target.value as MasterDataOption['tone'] })}>
                      {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </>
                )}
                {noRate && <span className="text-xs text-amber-600 dark:text-amber-400" title="Invoices in this currency are left out of spend totals until a rate is set.">No rate set</span>}
                <span className="ml-auto flex items-center gap-1.5">
                  <Badge variant={used ? 'secondary' : 'outline'} className="text-[11px]" title={used ? `${used} record${used === 1 ? '' : 's'} use this` : 'Not used yet'}>{used ? `${used} in use` : 'unused'}</Badge>
                  {item.active
                    ? <Button size="sm" variant="ghost" onClick={() => patch(item.id, { active: false })} title="Hide from new records; existing records keep it"><Archive className="h-4 w-4" /> Archive</Button>
                    : <Button size="sm" variant="ghost" onClick={() => patch(item.id, { active: true })}><Undo2 className="h-4 w-4" /> Restore</Button>}
                  <Button size="icon-sm" variant="ghost" disabled={used > 0} onClick={() => askDelete([item])} aria-label={`Delete ${item.name}`} title={used > 0 ? 'In use — archive it instead' : 'Delete'}><Trash2 className={`h-4 w-4 ${used > 0 ? '' : 'text-destructive'}`} /></Button>
                </span>
                {locked && <p className="basis-full pl-1 text-[11px] text-muted-foreground">Renaming is locked while {used} record{used === 1 ? '' : 's'} use this name. Archive it and add a new one instead.</p>}
              </li>
            );
          })}
        </ul>
      </CardContent>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete ? deletable(pendingDelete).length : 0} item{pendingDelete && deletable(pendingDelete).length === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && deletable(pendingDelete).length > 0
                ? `${deletable(pendingDelete).map(i => i.name || 'Blank entry').join(', ')} will be removed for good. No existing records use them.`
                : 'Everything selected is in use by existing records, so nothing can be deleted. Archive them instead.'}
              {pendingDelete && deletable(pendingDelete).length < pendingDelete.length && deletable(pendingDelete).length > 0 ? ` ${pendingDelete.length - deletable(pendingDelete).length} selected item(s) are in use and will be kept.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={!pendingDelete || deletable(pendingDelete).length === 0} onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/** Name field that only saves on blur/Enter and rejects blank or duplicate names. */
function NameInput({ item, locked, taken, onCommit, dim }: { item: MasterDataOption; locked: boolean; taken: (name: string) => boolean; onCommit: (name: string) => void; dim: boolean }) {
  const [value, setValue] = useState(item.name);
  const [bad, setBad] = useState('');
  const commit = () => {
    const next = value.trim();
    if (next === item.name) { setBad(''); return; }
    if (!next) { setBad('Name cannot be blank.'); setValue(item.name); return; }
    if (taken(next)) { setBad(`“${next}” already exists.`); setValue(item.name); return; }
    setBad(''); onCommit(next);
  };
  return (
    <div className="min-w-[10rem] flex-1">
      <Input className={`h-8 ${dim ? 'text-muted-foreground' : ''}`} value={value} disabled={locked} aria-label="Name" aria-invalid={!!bad}
        onChange={e => setValue(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      {bad && <p role="alert" className="mt-0.5 text-xs text-destructive">{bad}</p>}
    </div>
  );
}
