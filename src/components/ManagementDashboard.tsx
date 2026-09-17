import { useMemo } from 'react';
import { Activity, AlertTriangle, Boxes, CheckCircle2, CircleDollarSign, Laptop, Network, Package, RefreshCw, ShieldAlert, Users, Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Asset, User } from '@/data/sampleData';
import type { Page } from './App';

interface ManagementDashboardProps {
  assets: Asset[];
  users: User[];
  onNavigate: (page: Page) => void;
}

export function ManagementDashboard({ assets, users, onNavigate }: ManagementDashboardProps) {
  const now = Date.now();
  const warranty90 = assets.filter(a => {
    const t = new Date(a.warrantyExpiry).getTime();
    return Number.isFinite(t) && t >= now && t <= now + 90 * 86400000;
  }).length;
  const expired = assets.filter(a => {
    const t = new Date(a.warrantyExpiry).getTime();
    return Number.isFinite(t) && t < now;
  }).length;
  const value = assets.reduce((s, a) => s + (a.purchasePrice || 0), 0);
  const byType = useMemo(() => {
    const m: Record<string, number> = {};
    assets.forEach(a => { m[a.type] = (m[a.type] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [assets]);
  const maxType = Math.max(1, ...byType.map(([, n]) => n));

  const cards = [
    ['Total Assets', assets.length, Package],
    ['Assigned', assets.filter(a => a.status === 'assigned').length, Laptop],
    ['IT Stock', assets.filter(a => a.status === 'available' && !a.assignedTo).length, Boxes],
    ['Under Repair', assets.filter(a => a.status === 'maintenance').length, Wrench],
    ['Lost', assets.filter(a => a.status === 'lost').length, AlertTriangle],
    ['Asset Value', `₹${value.toLocaleString('en-IN')}`, CircleDollarSign],
    ['Employees', users.filter(u => u.status === 'active').length, Users],
    ['Warranty ≤90d', warranty90, ShieldAlert],
  ] as const;

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Management Dashboard</h1><p className="text-muted-foreground">Live operational view of assets, people, warranty risk and lifecycle status.</p></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(([label, value, Icon]) => <Card key={label}><CardContent className="p-4"><div className="flex justify-between items-start"><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold mt-1">{value}</p></div><Icon className="h-5 w-5 text-muted-foreground" /></div></CardContent></Card>)}
    </div>

    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2"><CardHeader><CardTitle>Asset Distribution</CardTitle></CardHeader><CardContent className="space-y-3">
        {byType.map(([type, count]) => <div key={type} className="grid grid-cols-[100px_1fr_40px] items-center gap-3 text-sm"><span className="capitalize">{type}</span><div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${(count / maxType) * 100}%` }} /></div><span className="text-right font-medium">{count}</span></div>)}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Operational Health</CardTitle></CardHeader><CardContent className="space-y-3">
        <Health label="Available" value={assets.filter(a => a.status === 'available').length} />
        <Health label="Assigned" value={assets.filter(a => a.status === 'assigned').length} />
        <Health label="Repair" value={assets.filter(a => a.status === 'maintenance').length} />
        <Health label="Retired" value={assets.filter(a => a.status === 'retired').length} />
        <Health label="Lost" value={assets.filter(a => a.status === 'lost').length} />
      </CardContent></Card>
    </div>

    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <Button variant="outline" className="h-auto justify-start p-4" onClick={() => onNavigate('assets')}><Package className="h-4 w-4 mr-3" /><span>Manage Assets</span></Button>
      <Button variant="outline" className="h-auto justify-start p-4" onClick={() => onNavigate('operations')}><Boxes className="h-4 w-4 mr-3" /><span>IT Operations</span></Button>
      <Button variant="outline" className="h-auto justify-start p-4" onClick={() => onNavigate('assignments')}><Activity className="h-4 w-4 mr-3" /><span>Assignments</span></Button>
      <Button variant="outline" className="h-auto justify-start p-4" onClick={() => onNavigate('audit-logs')}><RefreshCw className="h-4 w-4 mr-3" /><span>Audit & History</span></Button>
    </div>

    <Card><CardHeader><CardTitle>Warranty & Lifecycle Alerts</CardTitle></CardHeader><CardContent className="grid md:grid-cols-3 gap-3">
      <AlertCard icon={ShieldAlert} label="Warranty expires within 90 days" value={warranty90} onClick={() => onNavigate('assets')} />
      <AlertCard icon={AlertTriangle} label="Expired warranties" value={expired} onClick={() => onNavigate('assets')} />
      <AlertCard icon={Wrench} label="Assets under repair" value={assets.filter(a => a.status === 'maintenance').length} onClick={() => onNavigate('operations')} />
    </CardContent></Card>
  </div>;
}

function Health({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center justify-between rounded-md border p-2"><span className="text-sm">{label}</span><Badge variant={label === 'Lost' && value ? 'destructive' : 'outline'}>{value}</Badge></div>;
}
function AlertCard({ icon: Icon, label, value, onClick }: { icon: typeof ShieldAlert; label: string; value: number; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-lg border p-4 text-left hover:bg-muted transition-colors"><div className="flex items-center gap-2"><Icon className="h-4 w-4" /><span className="text-sm font-medium">{label}</span></div><p className="text-2xl font-bold mt-2">{value}</p><p className="text-xs text-muted-foreground">Open related module →</p></button>;
}
