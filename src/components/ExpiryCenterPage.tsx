import { useMemo, useState } from 'react';
import { ExportMenu } from '@/components/ExportMenu';
import { AlertTriangle, CalendarClock, CheckCircle2, Download, Search, ArrowUpRight, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCollection } from '@/lib/db';
import { DEFAULT_SYSTEM_POLICY, type SystemPolicy } from '@/data/masterData';
import type { Asset, Invoice, SoftwareLicense, Vendor } from '@/data/models';
import { formatDate } from '@/data/models';
import { KIND_LABEL, buildExpiryAlerts, describeDays, isUndated, type ExpiryAlert, type ExpiryKind, type Severity } from '@/lib/alerts';
import type { StockMinimum } from '@/lib/stock';
import type { Page } from './App';
import { WarrantyTracker } from './WarrantyTracker';

interface Props {
  assetsList: Asset[];
  invoicesList: Invoice[];
  vendorsList: Vendor[];
  onNavigate: (page: Page) => void;
}

const SEVERITY_STYLE: Record<Severity, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/25',
  warning: 'bg-chart-3/15 text-chart-3 border-chart-3/30',
  info: 'bg-primary/10 text-primary border-primary/20',
};

const WINDOWS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'expired', label: 'Expired / overdue', test: (a: ExpiryAlert) => a.days < 0 || isUndated(a) },
  { key: '30', label: 'Next 30 days', test: (a: ExpiryAlert) => !isUndated(a) && a.days >= 0 && a.days <= 30 },
  { key: '90', label: '31–90 days', test: (a: ExpiryAlert) => !isUndated(a) && a.days > 30 && a.days <= 90 },
] as const;

export function ExpiryCenterPage({ assetsList, invoicesList, vendorsList, onNavigate }: Props) {
  const [licenses] = useCollection<SoftwareLicense>('licenses');
  const [policies] = useCollection<SystemPolicy>('system-policies');
  const policy = policies[0] || DEFAULT_SYSTEM_POLICY;

  const [kind, setKind] = useState<ExpiryKind | 'all'>('all');
  const [window, setWindow] = useState<(typeof WINDOWS)[number]['key']>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'alerts' | 'warranty'>('alerts');

  const [minimums] = useCollection<StockMinimum>('stock-minimums');
  const [sites] = useCollection<{ id: string; name: string }>('locations');
  const [categories] = useCollection<{ id: string; name: string }>('asset-categories');
  const alerts = useMemo(
    () => buildExpiryAlerts({
      assets: assetsList, licenses, vendors: vendorsList, invoices: invoicesList, policy,
      stock: { minimums, siteName: id => sites.find(s => s.id === id)?.name || id, typeName: id => categories.find(c => c.id === id)?.name || id },
    }),
    [assetsList, licenses, vendorsList, invoicesList, policy, minimums, sites, categories]
  );

  const counts = useMemo(() => {
    const byKind = new Map<ExpiryKind, number>();
    alerts.forEach(a => byKind.set(a.kind, (byKind.get(a.kind) || 0) + 1));
    return byKind;
  }, [alerts]);

  const visible = useMemo(() => {
    const test = WINDOWS.find(w => w.key === window)!.test;
    const q = query.trim().toLowerCase();
    return alerts.filter(a =>
      (kind === 'all' || a.kind === kind) &&
      test(a) &&
      (!q || `${a.subject} ${a.title} ${a.detail}`.toLowerCase().includes(q))
    );
  }, [alerts, kind, window, query]);

  const expired = alerts.filter(a => a.days < 0 || isUndated(a)).length;
  const soon = alerts.filter(a => !isUndated(a) && a.days >= 0 && a.days <= 30).length;
  const later = alerts.filter(a => !isUndated(a) && a.days > 30).length;

  const buildExport = () => ({
    name: 'expiry-alerts', sheet: 'Expiry alerts',
    headers: ['Type', 'Item', 'Alert', 'Detail', 'Date', 'Days', 'Severity'],
    rows: visible.map(a => [KIND_LABEL[a.kind], a.subject, a.title, a.detail, a.date, a.date ? a.days : '', a.severity]),
  });

  const pageFor = (a: ExpiryAlert): Page => a.target;

  const tiles = [
    { label: 'Expired / needs action', value: expired, icon: AlertTriangle, tone: 'var(--destructive)', onClick: () => setWindow('expired') },
    { label: 'Due in 30 days', value: soon, icon: Clock, tone: 'var(--chart-3)', onClick: () => setWindow('30') },
    { label: 'Due in 31–90 days', value: later, icon: CalendarClock, tone: 'var(--chart-1)', onClick: () => setWindow('90') },
  ];

  return (
    <div className="af-stagger space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expiry &amp; Alerts</h1>
          <p className="text-muted-foreground">
            Warranties, AMC, insurance, software licenses, vendor contracts and invoice due dates in one place.
            Warning window: assets {policy.warrantyAlertDays} days, licenses {policy.licenseAlertDays} days.
          </p>
        </div>
        {view === 'alerts' && <ExportMenu build={buildExport} disabled={visible.length === 0} />}
      </div>

      <div className="inline-flex rounded-lg border bg-muted/40 p-1" role="tablist">
        {([['alerts', 'All alerts'], ['warranty', 'Warranty tracker']] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${view === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>
        ))}
      </div>

      {view === 'warranty' ? <WarrantyTracker assetsList={assetsList} onNavigate={onNavigate} /> : <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {tiles.map(({ label, value, icon: Icon, tone, onClick }) => (
          <Card key={label} className="af-lift cursor-pointer" onClick={onClick}>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: `color-mix(in oklch, ${tone} 15%, transparent)`, color: tone }}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by item, type or detail…" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {WINDOWS.map(w => (
                <Button key={w.key} size="sm" variant={window === w.key ? 'default' : 'outline'} onClick={() => setWindow(w.key)}>{w.label}</Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant={kind === 'all' ? 'secondary' : 'ghost'} onClick={() => setKind('all')}>
              All types <span className="ml-1 text-muted-foreground">{alerts.length}</span>
            </Button>
            {(Object.keys(KIND_LABEL) as ExpiryKind[]).filter(k => counts.get(k)).map(k => (
              <Button key={k} size="sm" variant={kind === k ? 'secondary' : 'ghost'} onClick={() => setKind(k)}>
                {KIND_LABEL[k]} <span className="ml-1 text-muted-foreground">{counts.get(k)}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {visible.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <CheckCircle2 className="mx-auto h-9 w-9 text-chart-2" />
              <p className="mt-3 font-medium">{alerts.length === 0 ? 'Nothing is expiring soon' : 'No alerts match these filters'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {alerts.length === 0
                  ? 'Add warranty, AMC, insurance or license dates and they will appear here before they lapse.'
                  : 'Try a different type or time window.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(a => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <p className="font-medium">{a.subject}</p>
                      <p className="max-w-[420px] truncate text-xs text-muted-foreground">{a.detail}</p>
                    </TableCell>
                    <TableCell><Badge variant="outline">{KIND_LABEL[a.kind]}</Badge></TableCell>
                    <TableCell className="tabular-nums">{a.date ? formatDate(a.date) : '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={SEVERITY_STYLE[a.severity]}>
                        {isUndated(a) ? a.title : `${a.kind === 'invoice' ? (a.days < 0 ? 'Overdue' : 'Due') : (a.days < 0 ? 'Expired' : 'Expires')} ${describeDays(a.days)}`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" title={`Open ${a.target}`} onClick={() => onNavigate(pageFor(a))}>
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </>}
    </div>
  );
}
