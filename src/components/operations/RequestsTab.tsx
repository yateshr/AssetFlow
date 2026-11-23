import { useState } from 'react';
import { Check, ClipboardList, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { AssetCategory, User } from '@/data/models';
import { dmy } from '@/lib/dates';
import { useCollection } from '@/lib/db';
import { newId, type EquipmentRequest, type RequestStatus } from './types';

const select = 'h-10 w-full rounded-md border bg-background px-3 text-sm';

/** Employees ask IT for equipment; IT approves, rejects and marks it done. (Approving does not assign anything by itself.) */
export function RequestsTab({ users }: { users: User[] }) {
  const [requests, setRequests] = useCollection<EquipmentRequest>('asset-requests');
  const [categories] = useCollection<AssetCategory>('asset-categories');
  const types = categories.filter(c => c.active);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [assetType, setAssetType] = useState('');
  const [reason, setReason] = useState('');

  const people = users.filter(u => u.status === 'active');
  const set = (id: string, status: RequestStatus) => setRequests(prev => prev.map(r => (r.id === id ? { ...r, status } : r)));
  const nameOf = (id: string) => users.find(u => u.id === id)?.name || id;
  const typeOf = (id: string) => categories.find(c => c.id === id)?.name || id;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !reason.trim()) return;
    setRequests(prev => [{ id: newId('REQ'), userId, assetType, reason: reason.trim(), date: new Date().toISOString().slice(0, 10), status: 'pending' }, ...prev]);
    setReason(''); setOpen(false);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Equipment requests</CardTitle><p className="text-sm text-muted-foreground">What employees have asked IT for.</p></div>
          <Button onClick={() => { setUserId(people[0]?.id || ''); setAssetType(types[0]?.id || ''); setOpen(true); }}><Plus className="h-4 w-4" /> New request</Button>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No requests yet.</p> : (
            <ul className="divide-y rounded-lg border">
              {requests.map(r => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0"><p className="font-medium">{nameOf(r.userId)} <span className="font-normal text-muted-foreground">· {typeOf(r.assetType)} · {dmy(r.date)}</span></p><p className="text-sm text-muted-foreground">{r.reason}</p></div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{r.status}</Badge>
                    {r.status === 'pending' && <><Button size="sm" onClick={() => set(r.id, 'approved')}><Check className="h-4 w-4" /> Approve</Button><Button size="sm" variant="outline" onClick={() => set(r.id, 'rejected')}><X className="h-4 w-4" /> Reject</Button></>}
                    {r.status === 'approved' && <Button size="sm" variant="outline" onClick={() => set(r.id, 'completed')}>Mark done</Button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit}>
            <DialogHeader><DialogTitle>New equipment request</DialogTitle><DialogDescription>Record what an employee needs.</DialogDescription></DialogHeader>
            <div className="grid gap-4 py-5">
              <label className="space-y-1 text-sm">Employee<select className={select} value={userId} onChange={e => setUserId(e.target.value)}>{people.map(u => <option key={u.id} value={u.id}>{u.name} · {u.department}</option>)}</select></label>
              <label className="space-y-1 text-sm">Equipment<select className={select} value={assetType} onChange={e => setAssetType(e.target.value)}>{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
              <label className="space-y-1 text-sm">Why is it needed?<Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} /></label>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!userId || !reason.trim()}>Save request</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
