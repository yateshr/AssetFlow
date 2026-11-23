import { useMemo, useState } from 'react';
import { Archive, Plus, Trash2, Undo2 } from 'lucide-react';
import { confirmDialog } from '@/components/ConfirmHost';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Asset, User } from '@/data/models';
import { useCollection } from '@/lib/db';
import { HOLDER_KIND_LABEL, stockHolderName, type Holder, type HolderKind } from '@/lib/holders';

const select = 'h-9 rounded-md border bg-background px-2 text-sm';

/**
 * Holders of one site: the named accounts that hold assets which are not assigned to an employee,
 * for example "IT Assets Manager – Somnath". Used inside the Site dialog.
 */
export function HolderEditor({ siteId, siteName, assets }: { siteId: string; siteName: string; assets: Asset[] }) {
  const [holders, setHolders] = useCollection<Holder>('holders');
  const [users] = useCollection<User>('users');
  const mine = holders.filter(h => h.siteId === siteId);
  const [name, setName] = useState('');
  const hasStock = mine.some(h => h.kind === 'stock' && h.active);
  const [kindChoice, setKindChoice] = useState<HolderKind>('stock');
  // A site has exactly one IT Assets Manager (stock holder): once it exists only other kinds can be added.
  const kind: HolderKind = kindChoice === 'stock' && hasStock ? 'shared' : kindChoice;
  const [error, setError] = useState('');

  const held = useMemo(() => {
    const counts = new Map<string, number>();
    assets.filter(a => a.siteId === siteId && !a.assignedTo && a.heldBy).forEach(a => counts.set(a.heldBy!, (counts.get(a.heldBy!) || 0) + 1));
    return counts;
  }, [assets, siteId]);

  const people = users.filter(u => u.status !== 'left' && u.status !== 'inactive');
  const patch = (id: string, change: Partial<Holder>) => setHolders(holders.map(h => (h.id === id ? { ...h, ...change } : h)));

  const add = () => {
    const label = name.trim() || (kind === 'stock' ? stockHolderName(siteName) : '');
    if (!label) { setError('Enter a name, for example “RPP 1 camera”.'); return; }
    if (holders.some(h => h.siteId === siteId && h.name.trim().toLowerCase() === label.toLowerCase())) { setError(`“${label}” already exists at this site.`); return; }
    setHolders([...holders, { id: `HLD-${crypto.randomUUID().slice(0, 8)}`, siteId, kind, name: label, active: true }]);
    setName(''); setError(''); setKindChoice('shared');
  };

  const remove = async (h: Holder) => {
    if (await confirmDialog({ title: 'Delete holder?', message: `Delete “${h.name}”? It holds no assets.`, destructive: true })) setHolders(holders.filter(x => x.id !== h.id));
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div>
        <h4 className="font-semibold">Asset holders</h4>
        <p className="text-xs text-muted-foreground">Who holds assets that are not given to an employee. Each site has <b>one</b> IT Assets Manager (the stock holder): new assets from an invoice go to it. Add a holder for each place where equipment is deployed (server room, gate, reception) and for vacant desks, then use “Change holder” on an asset to put it there.</p>
      </div>

      {mine.length > 0 && (
        <ul className="divide-y rounded-md border bg-background">
          {mine.map(h => {
            const count = held.get(h.id) || 0;
            return (
              <li key={h.id} className={`flex flex-wrap items-center gap-2 p-2 ${h.active ? '' : 'opacity-60'}`}>
                <Input className="h-8 min-w-[12rem] flex-1" value={h.name} aria-label="Holder name" onChange={e => patch(h.id, { name: e.target.value })} />
                <Badge variant="outline" className="shrink-0 text-[11px]">{h.kind === 'stock' ? 'Stock' : h.kind === 'shared' ? 'Shared' : 'Vacant desk'}</Badge>
                <select className={select} aria-label="Responsible person" value={h.responsibleUserId || ''} onChange={e => patch(h.id, { responsibleUserId: e.target.value || undefined })}>
                  <option value="">Responsible person…</option>
                  {people.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <span className="text-xs text-muted-foreground">{count} held</span>
                {h.active
                  ? <Button type="button" size="sm" variant="ghost" onClick={() => patch(h.id, { active: false })} title="Stop using this holder"><Archive className="h-4 w-4" /></Button>
                  : <Button type="button" size="sm" variant="ghost" disabled={h.kind === 'stock' && hasStock} onClick={() => patch(h.id, { active: true })} title={h.kind === 'stock' && hasStock ? 'This site already has an active IT Assets Manager' : 'Use this holder again'}><Undo2 className="h-4 w-4" /></Button>}
                <Button type="button" size="icon-sm" variant="ghost" disabled={count > 0} onClick={() => void remove(h)} aria-label={`Delete ${h.name}`} title={count > 0 ? 'Holds assets: archive it instead' : 'Delete'}><Trash2 className={`h-4 w-4 ${count > 0 ? '' : 'text-destructive'}`} /></Button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Input className="h-9 min-w-[12rem] flex-1" value={name} onChange={e => { setName(e.target.value); setError(''); }} aria-label="New holder name"
          placeholder={kind === 'stock' ? stockHolderName(siteName) : 'Place, e.g. Server room, Gate 1 camera'}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <select className={select} aria-label="Holder kind" value={kind} onChange={e => setKindChoice(e.target.value as HolderKind)}>
          {(Object.keys(HOLDER_KIND_LABEL) as HolderKind[]).filter(k => k !== 'stock' || !hasStock).map(k => <option key={k} value={k}>{HOLDER_KIND_LABEL[k]}</option>)}
        </select>
        <Button type="button" size="sm" variant="outline" onClick={add}><Plus className="h-4 w-4" /> Add holder</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {mine.length === 0 && <p className="text-xs text-amber-600 dark:text-amber-400">No holder yet: add a stock holder so new assets have somewhere to be kept.</p>}
    </div>
  );
}
