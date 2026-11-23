import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { Asset } from '@/data/models';
import { useCollection } from '@/lib/db';
import { currentHolder, HOLDER_KIND_LABEL, type Holder } from '@/lib/holders';

/**
 * Change who holds an asset that is not given to an employee: back to the site's IT Assets Manager,
 * or out to a place where it is deployed (server room, gate camera, reception). Stays within the site.
 */
export function ChangeHolderDialog({ asset, canCreate, onClose, onConfirm }: {
  asset: Asset | null;
  /** Only company-wide admins may create new holders. */
  canCreate: boolean;
  onClose: () => void;
  onConfirm: (holder: Holder, note: string) => void;
}) {
  const [holders, setHolders] = useCollection<Holder>('holders');
  const [holderId, setHolderId] = useState('');
  const [newName, setNewName] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  // Keep the last asset while the dialog fades out so its text does not flicker.
  const [shown, setShown] = useState<Asset | null>(null);
  if (asset && asset !== shown) setShown(asset);
  const current = asset ?? shown;

  const here = current ? holders.filter(h => h.siteId === current.siteId && h.active !== false) : [];
  const now = current ? currentHolder(current, holders) : undefined;
  const options = here.filter(h => h.id !== now?.id);

  useEffect(() => { if (asset) { setHolderId(''); setNewName(''); setNote(''); setError(''); } }, [asset?.id]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    let target = here.find(h => h.id === holderId);
    if (!target && canCreate && newName.trim()) {
      const name = newName.trim();
      if (holders.some(h => h.siteId === current.siteId && h.name.trim().toLowerCase() === name.toLowerCase())) { setError(`“${name}” already exists at this site: choose it from the list.`); return; }
      target = { id: `HLD-${crypto.randomUUID().slice(0, 8)}`, siteId: current.siteId, kind: 'shared', name, active: true };
      setHolders([...holders, target]);
    }
    if (!target) { setError('Choose a holder or type a new place.'); return; }
    onConfirm(target, note.trim());
  };

  return (
    <Dialog open={!!asset} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Change holder</DialogTitle>
            <DialogDescription>{current ? `${current.assetTag} · ${current.name}` : ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-5">
            <p className="text-sm text-muted-foreground">Now held by <b className="text-foreground">{now?.name || 'nobody (no stock holder at this site yet)'}</b>.</p>
            <ul className="max-h-56 divide-y overflow-y-auto rounded-md border" role="radiogroup" aria-label="New holder">
              {options.length === 0 && <li className="p-3 text-sm text-muted-foreground">No other holders at this site yet.{canCreate ? ' Type a new place below.' : ' Ask an admin to add one in Sites.'}</li>}
              {options.map(h => (
                <li key={h.id}>
                  <label className="flex cursor-pointer items-center gap-3 p-2 text-sm hover:bg-muted/50">
                    <input type="radio" name="holder" checked={holderId === h.id} onChange={() => { setHolderId(h.id); setNewName(''); setError(''); }} />
                    <span className="flex-1">{h.name}</span>
                    <Badge variant="outline" className="text-[11px]">{HOLDER_KIND_LABEL[h.kind].split(' (')[0]}</Badge>
                  </label>
                </li>
              ))}
            </ul>
            {canCreate && (
              <label className="block space-y-1 text-sm">Or a new place
                <Input value={newName} onChange={e => { setNewName(e.target.value); setHolderId(''); setError(''); }} placeholder="Server room, Gate 1 camera, Reception…" />
              </label>
            )}
            <label className="block space-y-1 text-sm">Note (optional)<Input value={note} onChange={e => setNote(e.target.value)} placeholder="Installed by vendor, moved to the new rack…" /></label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!holderId && !newName.trim()}>Change holder</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
