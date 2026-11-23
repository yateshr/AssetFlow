import { useState } from 'react';
import { Pencil, Plus, Server } from 'lucide-react';
import { ExportMenu } from '@/components/ExportMenu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { MasterDataOption } from '@/data/masterData';
import { useCollection } from '@/lib/db';
import { masterLabel } from '@/lib/masterLabel';
import { newId, type Infrastructure, type InfraStatus } from './types';

const blank: Infrastructure = { id: '', name: '', type: '', ipAddress: '', macAddress: '', hostname: '', location: '', status: 'online', vendor: '', model: '', notes: '' };
const field = 'h-10 w-full rounded-md border bg-background px-3 text-sm';

/** Servers, switches, routers, UPS and other network equipment that is not handed out to employees. */
export function InfrastructureTab() {
  const [items, setItems] = useCollection<Infrastructure>('infrastructure');
  const [types] = useCollection<MasterDataOption>('infrastructure-types');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<Infrastructure | null>(null);

  const q = search.toLowerCase();
  const visible = items.filter(i => !q || [i.name, i.type, i.ipAddress, i.macAddress, i.hostname, i.location, i.vendor, i.model].some(v => (v || '').toLowerCase().includes(q)));
  const set = (patch: Partial<Infrastructure>) => setForm(f => (f ? { ...f, ...patch } : f));
  const activeTypes = types.filter(t => t.active);

  const save = () => {
    if (!form || !form.name.trim()) return;
    const item = { ...form, name: form.name.trim(), id: form.id || newId('INF') };
    setItems(prev => (form.id ? prev.map(x => (x.id === form.id ? item : x)) : [item, ...prev]));
    setForm(null);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" /> Network and infrastructure</CardTitle>
            <p className="text-sm text-muted-foreground">Servers and network equipment, kept apart from the devices given to employees.</p>
          </div>
          <div className="flex gap-2">
            <ExportMenu disabled={items.length === 0} build={() => ({
              name: 'infrastructure', sheet: 'Infrastructure',
              headers: ['Name', 'Type', 'Hostname', 'IP address', 'MAC address', 'Location', 'Status', 'Vendor', 'Model', 'Notes'],
              rows: visible.map(i => [i.name, masterLabel('infrastructure-types', i.type), i.hostname, i.ipAddress, i.macAddress, i.location, i.status, i.vendor, i.model, i.notes]),
            })} />
            <Button onClick={() => setForm({ ...blank, type: activeTypes[0]?.id || '' })}><Plus className="h-4 w-4" /> Add device</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input className="max-w-md" placeholder="Search name, address, location, vendor…" value={search} onChange={e => setSearch(e.target.value)} />
          {visible.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{items.length === 0 ? 'No infrastructure devices yet.' : 'No devices match.'}</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Device</TableHead><TableHead>Type</TableHead><TableHead>IP / MAC</TableHead><TableHead>Location</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Edit</TableHead></TableRow></TableHeader>
              <TableBody>
                {visible.map(i => (
                  <TableRow key={i.id}>
                    <TableCell><p className="font-medium">{i.name}</p><p className="text-xs text-muted-foreground">{[i.hostname, `${i.vendor} ${i.model}`.trim()].filter(Boolean).join(' · ')}</p></TableCell>
                    <TableCell>{masterLabel('infrastructure-types', i.type)}</TableCell>
                    <TableCell><p>{i.ipAddress || '—'}</p><p className="text-xs text-muted-foreground">{i.macAddress || '—'}</p></TableCell>
                    <TableCell>{i.location || '—'}</TableCell>
                    <TableCell><Badge variant={i.status === 'offline' ? 'destructive' : 'outline'} className="capitalize">{i.status}</Badge></TableCell>
                    <TableCell className="text-right"><Button size="icon-sm" variant="ghost" aria-label={`Edit ${i.name}`} onClick={() => setForm(i)}><Pencil className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!form} onOpenChange={o => { if (!o) setForm(null); }}>
        <DialogContent className="max-h-[90vh] sm:max-w-2xl overflow-y-auto">
          <form onSubmit={e => { e.preventDefault(); save(); }}>
            <DialogHeader><DialogTitle>{form?.id ? 'Edit device' : 'Add device'}</DialogTitle><DialogDescription>Network and infrastructure equipment.</DialogDescription></DialogHeader>
            {form && (
              <div className="grid gap-4 py-5 sm:grid-cols-2">
                <label className="space-y-1 text-sm">Name<Input required value={form.name} onChange={e => set({ name: e.target.value })} /></label>
                <label className="space-y-1 text-sm">Type
                  <select className={field} value={form.type} onChange={e => set({ type: e.target.value })}>
                    {activeTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    {form.type && !activeTypes.some(t => t.id === form.type) && <option value={form.type}>{masterLabel('infrastructure-types', form.type)}</option>}
                  </select>
                </label>
                <label className="space-y-1 text-sm">Hostname<Input value={form.hostname} onChange={e => set({ hostname: e.target.value })} /></label>
                <label className="space-y-1 text-sm">Location<Input value={form.location} onChange={e => set({ location: e.target.value })} placeholder="Server room, Somnath" /></label>
                <label className="space-y-1 text-sm">IP address<Input value={form.ipAddress} onChange={e => set({ ipAddress: e.target.value })} /></label>
                <label className="space-y-1 text-sm">MAC address<Input value={form.macAddress} onChange={e => set({ macAddress: e.target.value })} /></label>
                <label className="space-y-1 text-sm">Vendor<Input value={form.vendor} onChange={e => set({ vendor: e.target.value })} /></label>
                <label className="space-y-1 text-sm">Model<Input value={form.model} onChange={e => set({ model: e.target.value })} /></label>
                <label className="space-y-1 text-sm sm:col-span-2">Status
                  <select className={field} value={form.status} onChange={e => set({ status: e.target.value as InfraStatus })}><option value="online">Online</option><option value="offline">Offline</option><option value="maintenance">Maintenance</option></select>
                </label>
                <label className="space-y-1 text-sm sm:col-span-2">Notes<Textarea rows={2} value={form.notes} onChange={e => set({ notes: e.target.value })} /></label>
              </div>
            )}
            <DialogFooter><Button type="button" variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button>Save device</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
