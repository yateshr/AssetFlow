import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Asset, User } from '@/data/models';
import { useCollection } from '@/lib/db';
import { stockHolderName, type Holder } from '@/lib/holders';

const select = 'h-9 rounded-md border bg-background px-2 text-sm';

/**
 * The site's IT Assets Manager: the one named account that holds every asset at the site that is not
 * given to an employee, for example "IT Assets Manager – Somnath". Whether an item is in the store or
 * installed somewhere is its status; this account just says who answers for it. Used inside the Site dialog.
 */
export function HolderEditor({ siteId, siteName, assets }: { siteId: string; siteName: string; assets: Asset[] }) {
  const [holders, setHolders] = useCollection<Holder>('holders');
  const [users] = useCollection<User>('users');
  const holder = holders.find(h => h.siteId === siteId && h.active !== false);
  const [name, setName] = useState('');

  const counts = useMemo(() => {
    const here = assets.filter(a => a.siteId === siteId && !a.assignedTo);
    return { stock: here.filter(a => a.status === 'available').length, deployed: here.filter(a => a.status === 'deployed').length };
  }, [assets, siteId]);

  const people = users.filter(u => u.status !== 'left' && u.status !== 'inactive');
  const patch = (change: Partial<Holder>) => { if (holder) setHolders(holders.map(h => (h.id === holder.id ? { ...h, ...change } : h))); };
  const create = () => setHolders([...holders, { id: `HLD-${crypto.randomUUID().slice(0, 8)}`, siteId, kind: 'stock', name: name.trim() || stockHolderName(siteName), active: true }]);

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div>
        <h4 className="font-semibold">IT Assets Manager</h4>
        <p className="text-xs text-muted-foreground">Holds every asset at this site that is not given to an employee. New assets from an invoice go to it. Mark an item as <b>deployed</b> to say it is installed somewhere (server room, gate…) instead of sitting in the store.</p>
      </div>

      {holder ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2">
          <Input className="h-8 min-w-[12rem] flex-1" value={holder.name} aria-label="Holder name" onChange={e => patch({ name: e.target.value })} />
          <select className={select} aria-label="Responsible person" value={holder.responsibleUserId || ''} onChange={e => patch({ responsibleUserId: e.target.value || undefined })}>
            <option value="">Responsible person…</option>
            {people.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">{counts.stock} in stock · {counts.deployed} deployed</span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Input className="h-9 min-w-[12rem] flex-1" value={name} onChange={e => setName(e.target.value)} aria-label="Holder name" placeholder={stockHolderName(siteName)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); create(); } }} />
          <Button type="button" size="sm" variant="outline" onClick={create}><Plus className="h-4 w-4" /> Create IT Assets Manager</Button>
          <p className="w-full text-xs text-amber-600 dark:text-amber-400">This site has none yet: create it so new assets have somewhere to be kept.</p>
        </div>
      )}
    </div>
  );
}
