import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { Asset } from '@/data/models';

/**
 * Mark an asset as deployed: installed somewhere on site (server room, gate, reception…) instead of
 * sitting in the store. The asset stays with the site's IT Assets Manager; "Where" says where it is.
 */
export function DeployDialog({ asset, places, onClose, onConfirm }: {
  asset: Asset | null;
  /** Places already used at this site, offered as quick picks. */
  places: string[];
  onClose: () => void;
  onConfirm: (where: string, note: string) => void;
}) {
  const [where, setWhere] = useState('');
  const [note, setNote] = useState('');
  // Keep the last asset while the dialog fades out so its text does not flicker.
  const [shown, setShown] = useState<Asset | null>(null);
  if (asset && asset !== shown) setShown(asset);
  const current = asset ?? shown;
  const changing = current?.status === 'deployed';

  useEffect(() => { if (asset) { setWhere(asset.deployedAt || ''); setNote(''); } }, [asset?.id]);

  return (
    <Dialog open={!!asset} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent>
        <form onSubmit={e => { e.preventDefault(); if (where.trim()) onConfirm(where.trim(), note.trim()); }}>
          <DialogHeader>
            <DialogTitle>{changing ? 'Change where it is installed' : 'Mark as deployed'}</DialogTitle>
            <DialogDescription>{current ? `${current.assetTag} · ${current.name}` : ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-5">
            <label className="block space-y-1 text-sm">Where is it installed?
              <Input autoFocus value={where} onChange={e => setWhere(e.target.value)} placeholder="Server room, Gate 1, Reception, Warehouse…" />
            </label>
            {places.length > 0 && (
              <div className="flex flex-wrap gap-2" aria-label="Places already in use">
                {places.map(p => <button key={p} type="button" onClick={() => setWhere(p)} className="rounded-full border px-3 py-1 text-xs hover:bg-muted">{p}</button>)}
              </div>
            )}
            <label className="block space-y-1 text-sm">Note (optional)<Input value={note} onChange={e => setNote(e.target.value)} placeholder="Installed by the vendor, new rack…" /></label>
            <p className="text-xs text-muted-foreground">It stays with the site&apos;s IT Assets Manager, but it is no longer counted as available stock.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!where.trim()}>{changing ? 'Save' : 'Mark as deployed'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
