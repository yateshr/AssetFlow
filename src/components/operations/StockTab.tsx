import { useState } from 'react';
import { History, Minus, Plus } from 'lucide-react';
import { ExportMenu } from '@/components/ExportMenu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/data/models';
import { DEFAULT_SYSTEM_POLICY, type SystemPolicy } from '@/data/masterData';
import { useCollection } from '@/lib/db';
import { newId, type MovementType, type StockItem, type StockMovement } from './types';

/**
 * Spares and consumables counted by quantity (cables, mice, toner). Every change is written to the
 * stock history. Individually tracked equipment (laptops, monitors) belongs in Assets, not here.
 */
export function StockTab({ userName }: { userName: string }) {
  const [stock, setStock] = useCollection<StockItem>('stock-items');
  const [movements, setMovements] = useCollection<StockMovement>('stock-movements');
  const [policies] = useCollection<SystemPolicy>('system-policies');
  const policy = policies[0] || DEFAULT_SYSTEM_POLICY;
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const visible = stock.filter(s => {
    const q = search.toLowerCase();
    return (!q || `${s.name} ${s.sku} ${s.category}`.toLowerCase().includes(q)) && (!lowOnly || s.quantity <= s.minQuantity);
  });

  const move = (item: StockItem, type: MovementType, quantity: number, reason: string) => {
    const before = item.quantity;
    const delta = type === 'issued' ? -Math.abs(quantity) : Math.abs(quantity);
    const after = Math.max(0, before + delta);
    setStock(prev => prev.map(x => (x.id === item.id ? { ...item, quantity: after } : x)));
    setMovements(prev => [{ id: newId('SM'), stockId: item.id, itemName: item.name, type, quantity: Math.abs(quantity), before, after, reason, performedBy: userName, timestamp: new Date().toISOString() }, ...prev]);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>IT Stock</CardTitle>
            <p className="text-sm text-muted-foreground">Spares and consumables counted by quantity, with a minimum-stock warning.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportMenu disabled={stock.length === 0} build={() => ({
              name: 'it-stock', sheet: 'IT Stock',
              headers: ['Item', 'SKU', 'Category', 'Quantity', 'Minimum', 'Location', 'Unit cost'],
              rows: visible.map(s => [s.name, s.sku, s.category, s.quantity, s.minQuantity, s.location, s.unitCost]),
            })} />
            <Button variant="outline" onClick={() => setShowHistory(true)}><History className="h-4 w-4" /> History</Button>
            <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add item</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input className="max-w-sm" placeholder="Search item, SKU or category…" value={search} onChange={e => setSearch(e.target.value)} />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} /> Low stock only</label>
          </div>
          {visible.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{stock.length === 0 ? 'No stock items yet. Add your first one.' : 'No items match.'}</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>SKU</TableHead><TableHead>Quantity</TableHead><TableHead>Minimum</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Adjust</TableHead></TableRow></TableHeader>
              <TableBody>
                {visible.map(s => (
                  <TableRow key={s.id}>
                    <TableCell><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.category}</p></TableCell>
                    <TableCell className="font-mono text-xs">{s.sku}</TableCell>
                    <TableCell className="tabular-nums">{s.quantity} {s.quantity <= s.minQuantity && <Badge variant="destructive" className="ml-2">Low</Badge>}</TableCell>
                    <TableCell className="tabular-nums">{s.minQuantity}</TableCell>
                    <TableCell>{s.location || '—'}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="icon-sm" variant="outline" aria-label={`Issue one ${s.name}`} disabled={s.quantity <= 0} onClick={() => move(s, 'issued', 1, 'Stock issued')}><Minus className="h-4 w-4" /></Button>
                        <Button size="icon-sm" variant="outline" aria-label={`Receive one ${s.name}`} onClick={() => move(s, 'received', 1, 'Stock received')}><Plus className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddStockDialog open={adding} defaultLocation={policy.defaultStockLocation} onClose={() => setAdding(false)} onAdd={(item, qty) => {
        setStock(prev => [item, ...prev]);
        if (qty > 0) setMovements(prev => [{ id: newId('SM'), stockId: item.id, itemName: item.name, type: 'received', quantity: qty, before: 0, after: qty, reason: 'Initial stock', performedBy: userName, timestamp: new Date().toISOString() }, ...prev]);
        setAdding(false);
      }} />

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-h-[85vh] sm:max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Stock history</DialogTitle><DialogDescription>Every receipt, issue and adjustment.</DialogDescription></DialogHeader>
          {movements.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No stock movements yet. Use + and − on an item.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead>Movement</TableHead><TableHead>Qty</TableHead><TableHead>Before → after</TableHead><TableHead>By</TableHead></TableRow></TableHeader>
              <TableBody>
                {[...movements].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(m.timestamp.slice(0, 10))}</TableCell><TableCell>{m.itemName}</TableCell>
                    <TableCell className="capitalize">{m.type}</TableCell><TableCell className="tabular-nums">{m.quantity}</TableCell>
                    <TableCell className="tabular-nums">{m.before} → {m.after}</TableCell><TableCell>{m.performedBy}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddStockDialog({ open, defaultLocation, onClose, onAdd }: { open: boolean; defaultLocation: string; onClose: () => void; onAdd: (item: StockItem, quantity: number) => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [qty, setQty] = useState('0');
  const [min, setMin] = useState('5');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Enter the item name, for example “USB mouse”.'); return; }
    const quantity = Math.max(0, Math.round(Number(qty) || 0));
    onAdd({ id: newId('STK'), name: name.trim(), sku: `SKU-${Date.now().toString().slice(-6)}`, category: category.trim() || 'General', quantity, minQuantity: Math.max(0, Math.round(Number(min) || 0)), unitCost: 0, location: location.trim() || defaultLocation }, quantity);
    setName(''); setCategory(''); setQty('0'); setMin('5'); setLocation(''); setError('');
  };
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader><DialogTitle>Add stock item</DialogTitle><DialogDescription>For spares and consumables counted by quantity.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-5 sm:grid-cols-2">
            <label className="space-y-1 text-sm sm:col-span-2">Item name<Input value={name} onChange={e => { setName(e.target.value); setError(''); }} placeholder="USB mouse" /></label>
            <label className="space-y-1 text-sm">Category<Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Accessories" /></label>
            <label className="space-y-1 text-sm">Location<Input value={location} onChange={e => setLocation(e.target.value)} placeholder={defaultLocation} /></label>
            <label className="space-y-1 text-sm">Starting quantity<Input type="number" min="0" value={qty} onChange={e => setQty(e.target.value)} /></label>
            <label className="space-y-1 text-sm">Warn when at or below<Input type="number" min="0" value={min} onChange={e => setMin(e.target.value)} /></label>
            {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button>Add item</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
