import { useMemo, useState } from 'react';
import { CheckCircle2, Trash2, Wrench } from 'lucide-react';
import { confirmDialog } from '@/components/ConfirmHost';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_SYSTEM_POLICY, type SystemPolicy } from '@/data/masterData';
import type { Asset, AssetHistoryEvent, MaintenanceRecord, User } from '@/data/models';
import { formatCurrency } from '@/data/models';
import { daysUntil } from '@/lib/alerts';
import { useCollection } from '@/lib/db';
import { dmy } from '@/lib/dates';
import { newId } from './types';

/**
 * Repairs and servicing. Opening a repair puts the asset "under repair"; finishing it puts the asset back
 * where it was (assigned if someone holds it, otherwise available). Both steps are written to its history.
 */
export function MaintenanceTab({ assets, onAssetsChange, history, onHistoryChange, currentUser }: {
  assets: Asset[]; onAssetsChange: (a: Asset[]) => void; history: AssetHistoryEvent[]; onHistoryChange: (e: AssetHistoryEvent[]) => void; currentUser: User;
}) {
  const [records, setRecords] = useCollection<MaintenanceRecord>('maintenance');
  const [policies] = useCollection<SystemPolicy>('system-policies');
  const policy = policies[0] || DEFAULT_SYSTEM_POLICY;
  const [search, setSearch] = useState('');
  const [opening, setOpening] = useState<Asset | null>(null);
  const [finishing, setFinishing] = useState<MaintenanceRecord | null>(null);

  const open = records.filter(r => r.status !== 'completed');
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter(a => !q || `${a.assetTag} ${a.name} ${a.serialNumber}`.toLowerCase().includes(q)).slice(0, 25);
  }, [assets, search]);

  const openRepair = (asset: Asset, description: string, technician: string) => {
    const now = new Date().toISOString();
    const record: MaintenanceRecord = { id: newId('M'), assetId: asset.id, assetName: asset.name, date: now.slice(0, 10), type: 'repair', description, cost: 0, technician, status: 'in-progress' };
    setRecords(prev => [record, ...prev]);
    onAssetsChange(assets.map(a => (a.id === asset.id ? { ...a, status: 'maintenance' } : a)));
    onHistoryChange([...history, { id: newId('H'), assetId: asset.id, timestamp: now, action: 'Under Repair', performedBy: currentUser.id, from: asset.status, to: 'maintenance', reason: 'Repair opened', notes: description }]);
    setOpening(null);
  };

  const finishRepair = (record: MaintenanceRecord, cost: number) => {
    const asset = assets.find(a => a.id === record.assetId);
    setRecords(prev => prev.map(r => (r.id === record.id ? { ...r, status: 'completed', cost } : r)));
    if (asset) {
      const restored = asset.assignedTo ? 'assigned' : 'available';
      onAssetsChange(assets.map(a => (a.id === asset.id ? { ...a, status: restored } : a)));
      onHistoryChange([...history, { id: newId('H'), assetId: asset.id, timestamp: new Date().toISOString(), action: 'Repair Completed', performedBy: currentUser.id, from: 'maintenance', to: restored, reason: 'Repair completed', notes: record.description, cost }]);
    }
    setFinishing(null);
  };

  const remove = async (record: MaintenanceRecord) => {
    if (await confirmDialog({ title: 'Delete this repair record?', message: `${record.assetName}: ${record.description}`, destructive: true })) setRecords(prev => prev.filter(r => r.id !== record.id));
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> Repair &amp; maintenance</CardTitle>
          <p className="text-sm text-muted-foreground">Open a repair on any asset. It is marked under repair until you finish the repair.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-2">
            <h3 className="font-medium">Open repairs ({open.length})</h3>
            {open.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No repairs in progress.</p> : (
              <ul className="divide-y rounded-lg border">
                {open.map(r => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div className="min-w-0"><p className="font-medium">{r.assetName}</p><p className="text-sm text-muted-foreground">{r.description} · opened {dmy(r.date)}{r.technician ? ` · ${r.technician}` : ''}</p></div>
                    <div className="flex items-center gap-2"><Badge variant="outline" className="capitalize">{r.status}</Badge><Button size="sm" onClick={() => setFinishing(r)}><CheckCircle2 className="h-4 w-4" /> Finish</Button><Button size="icon-sm" variant="ghost" aria-label="Delete record" onClick={() => void remove(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="font-medium">Open a repair</h3>
            <Input className="max-w-md" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search any asset by tag, name or serial…" />
            {assets.length === 0 ? <p className="text-sm text-muted-foreground">There are no assets yet.</p> : (
              <ul className="divide-y rounded-lg border">
                {candidates.map(a => {
                  const days = daysUntil(a.warrantyExpiry);
                  const busy = open.some(r => r.assetId === a.id);
                  return (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                      <div className="min-w-0"><p className="font-medium"><span className="font-mono text-sm">{a.assetTag}</span> · {a.name}</p>
                        <p className="text-xs text-muted-foreground">{a.status === 'maintenance' ? 'Under repair' : a.status}{Number.isNaN(days) ? '' : days < 0 ? ' · warranty expired' : ` · warranty ${days} days left`}</p></div>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setOpening(a)}>{busy ? 'Repair open' : 'Open repair'}</Button>
                    </li>
                  );
                })}
                {candidates.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">No assets match.</li>}
              </ul>
            )}
          </section>

          {records.some(r => r.status === 'completed') && (
            <section className="space-y-2">
              <h3 className="font-medium">Completed</h3>
              <ul className="divide-y rounded-lg border text-sm">
                {records.filter(r => r.status === 'completed').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map(r => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3"><span>{r.assetName} · {r.description}</span><span className="text-muted-foreground">{dmy(r.date)}{r.cost ? ` · ${formatCurrency(r.cost)}` : ''}</span></li>
                ))}
              </ul>
            </section>
          )}
        </CardContent>
      </Card>

      <OpenRepairDialog asset={opening} defaultTechnician={policy.defaultSupportTeam} onClose={() => setOpening(null)} onSubmit={openRepair} />
      <FinishRepairDialog record={finishing} onClose={() => setFinishing(null)} onSubmit={finishRepair} />
    </>
  );
}

function OpenRepairDialog({ asset, defaultTechnician, onClose, onSubmit }: { asset: Asset | null; defaultTechnician: string; onClose: () => void; onSubmit: (a: Asset, description: string, technician: string) => void }) {
  const [description, setDescription] = useState('');
  const [technician, setTechnician] = useState('');
  return (
    <Dialog open={!!asset} onOpenChange={o => { if (!o) { setDescription(''); onClose(); } }}>
      <DialogContent>
        <form onSubmit={e => { e.preventDefault(); if (asset && description.trim()) { onSubmit(asset, description.trim(), technician.trim() || defaultTechnician); setDescription(''); setTechnician(''); } }}>
          <DialogHeader><DialogTitle>Open a repair</DialogTitle><DialogDescription>{asset ? `${asset.assetTag} · ${asset.name}` : ''}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-5">
            <label className="block space-y-1 text-sm">What is wrong?<Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Screen flickers, no power, battery swollen…" /></label>
            <label className="block space-y-1 text-sm">Handled by<Input value={technician} onChange={e => setTechnician(e.target.value)} placeholder={defaultTechnician} /></label>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!description.trim()}>Open repair</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FinishRepairDialog({ record, onClose, onSubmit }: { record: MaintenanceRecord | null; onClose: () => void; onSubmit: (r: MaintenanceRecord, cost: number) => void }) {
  const [cost, setCost] = useState('');
  return (
    <Dialog open={!!record} onOpenChange={o => { if (!o) { setCost(''); onClose(); } }}>
      <DialogContent>
        <form onSubmit={e => { e.preventDefault(); if (record) { onSubmit(record, Math.max(0, Number(cost) || 0)); setCost(''); } }}>
          <DialogHeader><DialogTitle>Finish this repair</DialogTitle><DialogDescription>{record ? `${record.assetName}: ${record.description}` : ''}</DialogDescription></DialogHeader>
          <label className="block space-y-1 py-5 text-sm">Repair cost (optional)<Input type="number" min="0" step="any" value={cost} onChange={e => setCost(e.target.value)} placeholder="0" /></label>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button>Mark finished</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
