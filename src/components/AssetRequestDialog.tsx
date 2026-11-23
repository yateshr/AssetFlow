import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { AssetCategory, Location } from '@/data/models';
import { requestAssetCreation } from '@/lib/db';

const field = 'h-10 w-full rounded-md border bg-background px-3 text-sm';

/** A site IT admin asks the Super Admin to create assets that have no invoice. */
export function AssetRequestDialog({ open, onClose, sites, categories, defaultSiteId, onSent }: {
  open: boolean; onClose: () => void; sites: Location[]; categories: AssetCategory[]; defaultSiteId?: string; onSent: () => void;
}) {
  const types = categories.filter(c => c.active);
  const [siteId, setSiteId] = useState('');
  const [assetType, setAssetType] = useState('');
  const [name, setName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [serials, setSerials] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setSiteId(defaultSiteId && sites.some(s => s.id === defaultSiteId) ? defaultSiteId : sites[0]?.id || '');
    setAssetType(types[0]?.id || '');
    setName(''); setManufacturer(''); setModel(''); setWarrantyExpiry(''); setSerials(''); setReason(''); setError(''); setBusy(false);
  }, [open]);

  const list = serials.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Enter the item name, for example “Wireless mouse”.'); return; }
    if (list.length === 0) { setError('Enter at least one serial number.'); return; }
    if (new Set(list.map(s => s.toLowerCase())).size !== list.length) { setError('Serial numbers must be different from each other.'); return; }
    if (reason.trim().length < 5) { setError('Explain why these assets have no invoice.'); return; }
    setBusy(true); setError('');
    try {
      await requestAssetCreation({
        siteId, assetType, reason: reason.trim(),
        items: list.map(serialNumber => ({
          name: name.trim(), serialNumber, manufacturer: manufacturer.trim() || undefined, model: model.trim() || undefined, warrantyExpiry: warrantyExpiry || undefined,
        })),
      });
      toast.success('Request sent to the Super Admin');
      onSent(); onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the request.');
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Request assets without an invoice</DialogTitle>
            <DialogDescription>Normally assets are created from an invoice. If there is none, the Super Admin must approve these first.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-5 sm:grid-cols-2">
            {sites.length > 1 && (
              <label className="space-y-1 text-sm sm:col-span-2">Site
                <select className={field} value={siteId} onChange={e => setSiteId(e.target.value)}>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              </label>
            )}
            <label className="space-y-1 text-sm">Asset type
              <select className={field} value={assetType} onChange={e => setAssetType(e.target.value)}>{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </label>
            <label className="space-y-1 text-sm">Item name<Input value={name} onChange={e => setName(e.target.value)} placeholder="Wireless mouse" /></label>
            <label className="space-y-1 text-sm">Manufacturer<Input value={manufacturer} onChange={e => setManufacturer(e.target.value)} /></label>
            <label className="space-y-1 text-sm">Model<Input value={model} onChange={e => setModel(e.target.value)} /></label>
            <label className="space-y-1 text-sm sm:col-span-2">Warranty expiry (optional)<Input type="date" value={warrantyExpiry} onChange={e => setWarrantyExpiry(e.target.value)} /></label>
            <label className="space-y-1 text-sm sm:col-span-2">Serial numbers, one per line{list.length > 0 && <span className="text-muted-foreground"> ({list.length})</span>}
              <Textarea rows={4} value={serials} onChange={e => setSerials(e.target.value)} placeholder={'MS-0001\nMS-0002'} className="font-mono" />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">Why is there no invoice?
              <Textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Gifted by vendor, replacement under warranty, found during audit…" />
            </label>
            {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button disabled={busy || !siteId || !assetType}>{busy ? 'Sending…' : 'Send request'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
