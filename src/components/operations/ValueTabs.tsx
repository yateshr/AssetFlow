import { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { ExportMenu } from '@/components/ExportMenu';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DEFAULT_SYSTEM_POLICY, type SystemPolicy } from '@/data/masterData';
import type { Asset, User } from '@/data/models';
import { formatCurrency } from '@/data/models';
import { daysUntil } from '@/lib/alerts';
import { dmy } from '@/lib/dates';
import { useCollection } from '@/lib/db';
import { depreciationFor, describeAge } from '@/lib/depreciation';

const select = 'h-10 rounded-md border bg-background px-3 text-sm';

/** Book value of every asset. Starts from the useful life and method in Settings; change them here to see "what if". */
export function DepreciationTab({ assets }: { assets: Asset[] }) {
  const [policies] = useCollection<SystemPolicy>('system-policies');
  const policy = policies[0] || DEFAULT_SYSTEM_POLICY;
  const [years, setYears] = useState(String(policy.usefulLifeYears));
  const [method, setMethod] = useState<'straight-line' | 'none'>(policy.depreciationMethod);
  const rows = useMemo(() => assets.map(a => ({ asset: a, dep: depreciationFor(a, { usefulLifeYears: Number(years) || 1, depreciationMethod: method }) })), [assets, years, method]);
  const totals = rows.reduce((t, r) => ({ cost: t.cost + r.dep.cost, current: t.current + r.dep.current }), { cost: 0, current: 0 });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div><CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Depreciation</CardTitle><p className="text-sm text-muted-foreground">Current book value of every asset.</p></div>
        <ExportMenu disabled={rows.length === 0} build={() => ({
          name: 'depreciation', sheet: 'Depreciation',
          headers: ['Asset Tag', 'Name', 'Purchase Date', 'Purchase Price', 'Age (years)', 'Book Value', 'Depreciated %'],
          rows: rows.map(({ asset: a, dep }) => [a.assetTag, a.name, dmy(a.purchaseDate), a.purchasePrice, Math.round(dep.ageYears * 10) / 10, dep.current, dep.percent]),
        })} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1 text-sm">Useful life (years)<Input type="number" min="1" max="50" className="w-32" value={years} onChange={e => setYears(e.target.value)} /></label>
          <label className="space-y-1 text-sm">Method<select className={`${select} block`} value={method} onChange={e => setMethod(e.target.value as 'straight-line' | 'none')}><option value="straight-line">Straight line</option><option value="none">No depreciation</option></select></label>
          <div className="ml-auto text-right text-sm"><p className="text-muted-foreground">Purchase value <b className="tabular-nums text-foreground">{formatCurrency(totals.cost)}</b></p><p className="text-muted-foreground">Book value <b className="tabular-nums text-foreground">{formatCurrency(totals.current)}</b></p></div>
        </div>
        {rows.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No assets yet.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Asset</TableHead><TableHead>Purchased</TableHead><TableHead>Age</TableHead><TableHead className="text-right">Purchase price</TableHead><TableHead className="text-right">Book value</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map(({ asset: a, dep }) => (
                <TableRow key={a.id}>
                  <TableCell><p className="font-mono text-sm font-semibold">{a.assetTag}</p><p className="text-xs text-muted-foreground">{a.name}</p></TableCell>
                  <TableCell>{dmy(a.purchaseDate) || '—'}</TableCell>
                  <TableCell>{a.purchaseDate ? describeAge(dep.ageYears) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(dep.cost)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatCurrency(dep.current)}{dep.percent > 0 && <span className="ml-1 text-xs font-normal text-muted-foreground">(−{dep.percent}%)</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/** Everything one employee currently holds. */
export function MyAssetsTab({ assets, users }: { assets: Asset[]; users: User[] }) {
  const people = users.filter(u => u.status === 'active');
  const [userId, setUserId] = useState('');
  const chosen = userId || people[0]?.id || '';
  const mine = assets.filter(a => a.assignedTo === chosen);
  return (
    <Card>
      <CardHeader><CardTitle>Assets held by an employee</CardTitle><p className="text-sm text-muted-foreground">Choose an employee to see what they hold.</p></CardHeader>
      <CardContent className="space-y-4">
        <select aria-label="Employee" className={`${select} w-full max-w-md`} value={chosen} onChange={e => setUserId(e.target.value)}>
          {people.map(u => <option key={u.id} value={u.id}>{u.name} · {u.department}</option>)}
        </select>
        {mine.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nothing is assigned to this employee.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Asset</TableHead><TableHead>Tag</TableHead><TableHead>Status</TableHead><TableHead>Warranty</TableHead></TableRow></TableHeader>
            <TableBody>
              {mine.map(a => {
                const days = daysUntil(a.warrantyExpiry);
                return (
                  <TableRow key={a.id}>
                    <TableCell><p className="font-medium">{a.name}</p><p className="text-xs text-muted-foreground">{[a.manufacturer, a.model].filter(Boolean).join(' ')}</p></TableCell>
                    <TableCell className="font-mono text-sm">{a.assetTag}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{a.status === 'maintenance' ? 'under repair' : a.status}</Badge></TableCell>
                    <TableCell>{Number.isNaN(days) ? '—' : days < 0 ? <Badge variant="destructive">Expired</Badge> : `${days} days left`}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
