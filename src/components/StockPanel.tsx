import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Eye, HandHelping } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { Asset, AssetCategory, AssetHistoryEvent, Assignment, Location, User } from '@/data/models';
import { useCollection } from '@/lib/db';
import { defaultHolder, type Holder } from '@/lib/holders';
import { isInStock, issueFromStock, minimumId, pickForIssue, stockLines, type StockLine, type StockMinimum } from '@/lib/stock';

const select = 'h-9 rounded-md border bg-background px-2 text-sm';

interface Props {
  assets: Asset[];
  onAssetsChange: (assets: Asset[]) => void;
  history: AssetHistoryEvent[];
  onHistoryChange: (events: AssetHistoryEvent[]) => void;
  users: User[];
  sites: Location[];
  categories: AssetCategory[];
  currentUser: User;
  /** Show these assets in the table below. */
  onShow: (siteId: string, type: string, holderId: string | undefined) => void;
}

/**
 * What is available to give out, per site and asset type: everything held by the site's
 * IT Assets Manager. Lets you set a minimum level (low stock raises an alert) and issue
 * an item to an employee in one step.
 */
export function StockPanel({ assets, onAssetsChange, history, onHistoryChange, users, sites, categories, currentUser, onShow }: Props) {
  const [holders] = useCollection<Holder>('holders');
  const [minimums, setMinimums] = useCollection<StockMinimum>('stock-minimums');
  const [assignments, setAssignments] = useCollection<Assignment>('assignments');
  const [open, setOpen] = useState(true);
  const [issuing, setIssuing] = useState<StockLine | null>(null);

  const lines = useMemo(() => stockLines(assets, minimums), [assets, minimums]);
  const typeName = (id: string) => categories.find(c => c.id === id)?.name || id;
  const siteName = (id: string) => sites.find(s => s.id === id)?.name || id;
  const lowCount = lines.filter(l => l.low).length;
  const total = lines.reduce((n, l) => n + l.count, 0);

  // Sites with a stock holder (even when empty) so a new site shows up ready for its first invoice.
  const siteIds = [...new Set([...lines.map(l => l.siteId), ...holders.filter(h => h.kind === 'stock' && h.active !== false && sites.some(s => s.id === h.siteId)).map(h => h.siteId)])]
    .sort((a, b) => siteName(a).localeCompare(siteName(b)));

  const setMinimum = (siteId: string, type: string, value: number) => {
    const id = minimumId(siteId, type);
    const min = Math.max(0, Math.round(value) || 0);
    setMinimums(prev => {
      const rest = prev.filter(m => m.id !== id);
      return min > 0 ? [...rest, { id, siteId, type, min }] : rest;
    });
  };

  const issue = (line: StockLine, assetId: string, employeeId: string, notes: string) => {
    const asset = assets.find(a => a.id === assetId);
    const employee = users.find(u => u.id === employeeId);
    if (!asset || !employee) return;
    const holderName = (holders.find(h => h.id === asset.heldBy) ?? defaultHolder(holders, asset.siteId))?.name || 'Stock';
    const next = assignments.reduce((n, a) => Math.max(n, Number(a.id.replace(/\D/g, '')) || 0), 0) + 1;
    const result = issueFromStock(asset, employee, holderName, currentUser.id, next, notes);
    setAssignments(prev => [...prev, result.assignment]);
    onAssetsChange(assets.map(a => (a.id === asset.id ? result.asset : a)));
    onHistoryChange([...history, result.history]);
    toast.success(`${asset.assetTag} given to ${employee.name}`, { description: `${typeName(line.type)} · ${siteName(line.siteId)}` });
    setIssuing(null);
  };

  if (siteIds.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-center gap-2 text-left" aria-expanded={open}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-semibold">Available stock</span>
          <span className="text-sm text-muted-foreground">{total} ready to give out</span>
          {lowCount > 0 && <Badge variant="destructive" className="ml-1"><AlertTriangle className="mr-1 h-3 w-3" />{lowCount} running low</Badge>}
        </button>

        {open && siteIds.map(siteId => {
          const site = lines.filter(l => l.siteId === siteId);
          const holder = defaultHolder(holders, siteId);
          const usedTypes = new Set(site.map(l => l.type));
          const addable = categories.filter(c => c.active && !usedTypes.has(c.id));
          return (
            <section key={siteId} className="space-y-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium">{siteName(siteId)} <span className="font-normal text-muted-foreground">· held by {holder?.name || 'no stock holder yet'}</span></h3>
                <span className="text-xs text-muted-foreground">{site.reduce((n, l) => n + l.count, 0)} in stock</span>
              </div>
              {site.length === 0 ? <p className="text-sm text-muted-foreground">Nothing in stock here yet. New assets from an invoice are kept by {holder?.name || 'the site’s stock holder'}.</p> : (
                <ul className="divide-y">
                  {site.map(l => (
                    <li key={l.type} className="flex flex-wrap items-center gap-3 py-2">
                      <span className="min-w-[8rem] flex-1 font-medium">{typeName(l.type)}</span>
                      <span className={`w-10 text-right text-lg font-semibold tabular-nums ${l.low ? 'text-destructive' : ''}`}>{l.count}</span>
                      {l.low && <Badge variant="destructive">{l.count === 0 ? 'Out' : 'Low'}</Badge>}
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">Keep at least
                        <Input key={`${l.siteId}-${l.type}-${l.min}`} type="number" min="0" className="h-8 w-16" defaultValue={l.min || ''} placeholder="0" aria-label={`Minimum ${typeName(l.type)} at ${siteName(l.siteId)}`}
                          onBlur={e => { if (Number(e.target.value || 0) !== l.min) setMinimum(l.siteId, l.type, Number(e.target.value)); }} />
                      </label>
                      <Button size="sm" variant="ghost" onClick={() => onShow(l.siteId, l.type, holder?.id)} disabled={l.count === 0}><Eye className="mr-1 h-4 w-4" />Show</Button>
                      <Button size="sm" onClick={() => setIssuing(l)} disabled={l.count === 0}><HandHelping className="mr-1 h-4 w-4" />Issue</Button>
                    </li>
                  ))}
                </ul>
              )}
              {addable.length > 0 && <AddMinimum categories={addable} onAdd={(type, min) => setMinimum(siteId, type, min)} />}
            </section>
          );
        })}
      </CardContent>

      <IssueDialog line={issuing} assets={assets} users={users} typeName={typeName} siteName={siteName} onClose={() => setIssuing(null)} onIssue={issue} />
    </Card>
  );
}

function AddMinimum({ categories, onAdd }: { categories: AssetCategory[]; onAdd: (type: string, min: number) => void }) {
  const [type, setType] = useState('');
  const [min, setMin] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
      <span>Warn me when stock of</span>
      <select className={select} aria-label="Asset type" value={type} onChange={e => setType(e.target.value)}>
        <option value="">choose a type…</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <span>falls below</span>
      <Input type="number" min="1" className="h-9 w-16" value={min} onChange={e => setMin(e.target.value)} aria-label="Minimum" />
      <Button type="button" size="sm" variant="outline" disabled={!type || !(Number(min) > 0)} onClick={() => { onAdd(type, Number(min)); setType(''); setMin(''); }}>Set</Button>
    </div>
  );
}

function IssueDialog({ line, assets, users, typeName, siteName, onClose, onIssue }: {
  line: StockLine | null; assets: Asset[]; users: User[];
  typeName: (id: string) => string; siteName: (id: string) => string;
  onClose: () => void; onIssue: (line: StockLine, assetId: string, employeeId: string, notes: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [chosenAsset, setChosenAsset] = useState('');
  const [notes, setNotes] = useState('');
  // Keep the last shown line while the dialog fades out so its text does not flicker.
  const [shown, setShown] = useState<StockLine | null>(null);
  if (line && line !== shown) setShown(line);
  const current = line ?? shown;

  const candidates = useMemo(() => (current ? assets.filter(a => a.siteId === current.siteId && a.type === current.type && isInStock(a)).sort((a, b) => (a.purchaseDate || '').localeCompare(b.purchaseDate || '')) : []), [assets, current]);
  const suggested = current ? pickForIssue(assets, current.siteId, current.type) : undefined;
  const assetId = chosenAsset && candidates.some(a => a.id === chosenAsset) ? chosenAsset : suggested?.id || '';

  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter(u => u.status === 'active' && (!q || `${u.name} ${u.employeeId || ''} ${u.department}`.toLowerCase().includes(q)))
      .sort((a, b) => Number(b.siteId === current?.siteId) - Number(a.siteId === current?.siteId) || a.name.localeCompare(b.name))
      .slice(0, 60);
  }, [users, query, current]);

  const reset = () => { setQuery(''); setEmployeeId(''); setChosenAsset(''); setNotes(''); };
  const employee = employeeId && people.some(u => u.id === employeeId) ? employeeId : '';

  return (
    <Dialog open={!!line} onOpenChange={o => { if (!o) { reset(); onClose(); } }}>
      <DialogContent>
        <form onSubmit={e => { e.preventDefault(); if (current && assetId && employee) { onIssue(current, assetId, employee, notes.trim()); reset(); } }}>
          <DialogHeader>
            <DialogTitle>Issue {current ? typeName(current.type) : ''} from stock</DialogTitle>
            <DialogDescription>{current ? `${siteName(current.siteId)} · ${current.count} in stock` : ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-5">
            <label className="block space-y-1 text-sm">Give to
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search employee by name, ID or department…" />
            </label>
            <select className="w-full rounded-md border bg-background px-2 py-1 text-sm" size={Math.min(6, Math.max(3, people.length))} aria-label="Employee" value={employee} onChange={e => setEmployeeId(e.target.value)}>
              {people.map(u => <option key={u.id} value={u.id}>{u.name}{u.employeeId ? ` (${u.employeeId})` : ''} · {u.department}</option>)}
            </select>
            <label className="block space-y-1 text-sm">Item
              <select className={`${select} w-full`} value={assetId} onChange={e => setChosenAsset(e.target.value)}>
                {candidates.map(a => <option key={a.id} value={a.id}>{a.assetTag} · {a.name}{a.id === suggested?.id ? ' (oldest in stock)' : ''}</option>)}
              </select>
            </label>
            <label className="block space-y-1 text-sm">Note (optional)<Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Desk 4, replacement for the old one…" /></label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
            <Button disabled={!assetId || !employee}>Issue</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
