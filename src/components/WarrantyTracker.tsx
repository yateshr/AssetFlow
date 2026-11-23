import { useMemo, useState } from 'react';
import { makeModel } from '@/lib/utils';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, HelpCircle, Search, ShieldCheck } from 'lucide-react';
import { ExportMenu } from '@/components/ExportMenu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCollection } from '@/lib/db';
import { daysUntil } from '@/lib/alerts';
import type { Asset, Location } from '@/data/models';
import type { Page } from './App';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 19-Oct-2026, the same style as the printed asset labels. */
function dmy(date?: string) {
  if (!date) return '';
  const d = new Date(date.length <= 10 ? `${date}T00:00:00` : date);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

const INACTIVE = new Set(['retired', 'disposed', 'lost']);

const FILTERS = [
  { key: 'all', label: 'All', test: (d: number) => true },
  { key: 'expired', label: 'Expired', test: (d: number) => d < 0 },
  { key: '30', label: 'Next 30 days', test: (d: number) => d >= 0 && d <= 30 },
  { key: '90', label: '31–90 days', test: (d: number) => d > 30 && d <= 90 },
  { key: '365', label: '91 days – 1 year', test: (d: number) => d > 90 && d <= 365 },
  { key: 'long', label: 'Over 1 year', test: (d: number) => d > 365 },
  { key: 'none', label: 'No warranty date', test: (d: number) => Number.isNaN(d) },
] as const;

function remainingLabel(days: number) {
  if (Number.isNaN(days)) return 'No warranty date';
  if (days === 0) return 'Expires today';
  if (days < 0) return `Expired ${Math.abs(days)} day${days === -1 ? '' : 's'} ago`;
  if (days > 365) {
    const y = Math.floor(days / 365);
    const m = Math.floor((days % 365) / 30);
    return `${y} yr${y > 1 ? 's' : ''}${m ? ` ${m} mo` : ''} left`;
  }
  return `${days} day${days === 1 ? '' : 's'} left`;
}

const tone = (days: number) =>
  Number.isNaN(days) ? 'bg-muted text-muted-foreground border-border'
  : days < 0 ? 'bg-destructive/10 text-destructive border-destructive/25'
  : days <= 30 ? 'bg-destructive/10 text-destructive border-destructive/25'
  : days <= 90 ? 'bg-chart-3/15 text-chart-3 border-chart-3/30'
  : 'bg-chart-2/10 text-chart-2 border-chart-2/25';

export function WarrantyTracker({ assetsList, onNavigate }: { assetsList: Asset[]; onNavigate: (page: Page) => void }) {
  const [sites] = useCollection<Location>('locations');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const rows = useMemo(() => {
    const out = assetsList
      .filter(a => showInactive || !INACTIVE.has(a.status))
      .map(a => {
        const days = daysUntil(a.warrantyExpiry);
        const start = new Date(`${(a.purchaseDate || '').slice(0, 10)}T00:00:00`).getTime();
        const end = new Date(`${(a.warrantyExpiry || '').slice(0, 10)}T00:00:00`).getTime();
        const progress = Number.isFinite(start) && Number.isFinite(end) && end > start ? Math.min(1, Math.max(0, (Date.now() - start) / (end - start))) : null;
        return { asset: a, days, progress, site: sites.find(s => s.id === a.siteId)?.name || '' };
      });
    // Soonest / already-expired first; assets with no warranty date last.
    return out.sort((x, y) => (Number.isNaN(x.days) ? 1 : 0) - (Number.isNaN(y.days) ? 1 : 0) || x.days - y.days);
  }, [assetsList, sites, showInactive]);

  const q = query.trim().toLowerCase();
  const test = FILTERS.find(f => f.key === filter)!.test;
  const visible = rows.filter(r => test(r.days) && (!q || `${r.asset.assetTag} ${r.asset.name} ${r.asset.manufacturer} ${r.asset.model} ${r.asset.serialNumber} ${r.site}`.toLowerCase().includes(q)));
  const count = (f: (typeof FILTERS)[number]['key']) => rows.filter(r => FILTERS.find(x => x.key === f)!.test(r.days)).length;

  const tiles = [
    { label: 'Under warranty', value: rows.filter(r => r.days >= 0).length, icon: ShieldCheck, color: 'var(--chart-2)', go: 'all' as const },
    { label: 'Expired', value: count('expired'), icon: AlertTriangle, color: 'var(--destructive)', go: 'expired' as const },
    { label: 'Ending in 30 days', value: count('30'), icon: Clock, color: 'var(--chart-3)', go: '30' as const },
    { label: 'No warranty date', value: count('none'), icon: HelpCircle, color: 'var(--muted-foreground)', go: 'none' as const },
  ];

  const build = () => ({
    name: 'warranty-tracker', sheet: 'Warranty',
    headers: ['Asset Tag', 'Name', 'Type', 'Make & Model', 'Serial', 'Site', 'Status', 'Warranty Start', 'Warranty End', 'Days Remaining', 'Remaining'],
    rows: visible.map(({ asset: a, days, site }) => [
      a.assetTag, a.name, a.type, makeModel(a), a.serialNumber, site, a.status,
      dmy(a.purchaseDate), dmy(a.warrantyExpiry), Number.isNaN(days) ? '' : days, remainingLabel(days),
    ]),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon, color, go }) => (
          <Card key={label} className="af-lift cursor-pointer" onClick={() => setFilter(go)}>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in oklch, ${color} 15%, transparent)`, color }}><Icon className="h-5 w-5" /></div>
              <div><p className="text-2xl font-bold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by tag, name, model, serial or site…" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Include retired, disposed &amp; lost
            </label>
            <ExportMenu build={build} disabled={visible.length === 0} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(f => (
              <Button key={f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'} onClick={() => setFilter(f.key)}>
                {f.label} <span className="ml-1 opacity-70">{count(f.key)}</span>
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
              <p className="mt-3 font-medium">{rows.length === 0 ? 'No assets yet' : 'No assets match these filters'}</p>
              <p className="mt-1 text-sm text-muted-foreground">{rows.length === 0 ? 'Add assets with a purchase date and warranty end date and every device will be tracked here.' : 'Try a different time range or clear the search.'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Warranty period</TableHead>
                  <TableHead>Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(({ asset: a, days, progress, site }) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => onNavigate('assets')} title="Open Assets">
                    <TableCell>
                      <p className="font-mono text-sm font-semibold">{a.assetTag}</p>
                      <p className="max-w-[320px] truncate text-xs text-muted-foreground">{a.name}{a.manufacturer || a.model ? ` · ${makeModel(a)}` : ''}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{site || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm tabular-nums">
                      {a.warrantyExpiry ? `${dmy(a.purchaseDate) || '—'} to ${dmy(a.warrantyExpiry)}` : '—'}
                      {progress !== null && days >= 0 && (
                        <div className="mt-1 h-1 w-40 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.round(progress * 100)}%` }} />
                        </div>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="outline" className={tone(days)}><CalendarClock className="mr-1 h-3 w-3" />{remainingLabel(days)}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
