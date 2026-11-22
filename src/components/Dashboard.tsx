import { 
  Package, 
  Users, 
  MapPin, 
  AlertTriangle, 
  TrendingUp, 
  ArrowUpRight,
  Clock,
  ShieldAlert,
  Headphones,
  BarChart3
} from 'lucide-react';
import { SetupGuide } from './SetupGuide';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CountUp } from '@/components/ui/count-up';
import { useCollection, kv } from '@/lib/db';
import {
  type Asset,
  type User,
  type Assignment,
  type Location,
  type AuditLog,
  type AssetHistoryEvent,
  type ItCallLog,
  type SoftwareLicense,
  formatDate,
  formatDateTime,
  formatCurrency,
  type AssetStatus,
  type AssetType
} from '@/data/models';
import type { Page } from './App';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { DEFAULT_SYSTEM_POLICY, type SystemPolicy } from '@/data/masterData';

interface DashboardProps {
  onNavigate: (page: Page) => void;
  assetsList?: Asset[];
  usersList?: User[];
  assignmentsList?: Assignment[];
  onAssetDrilldown?: (filter: { status?: AssetStatus; warranty?: 'expired'|'30'|'60'|'90'; type?: Asset['type'] }) => void;
}

function AttentionItem({ label, value, tone, onClick }: { label: string; value: number; tone: 'danger' | 'warning' | 'neutral'; onClick: () => void }) {
  const toneClass = tone === 'danger'
    ? 'border-destructive/25 bg-destructive/5 text-destructive'
    : tone === 'warning'
      ? 'border-amber-500/25 bg-amber-500/5 text-amber-700 dark:text-amber-400'
      : 'border-border bg-background text-foreground';
  return (
    <button type="button" onClick={onClick} className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent ${toneClass}`}>
      <span className="text-sm font-medium">{label}</span>
      <span className="text-lg font-bold">{value}</span>
    </button>
  );
}

export function Dashboard({ onNavigate, assetsList = [], usersList = [], assignmentsList = [], onAssetDrilldown }: DashboardProps) {
  const [locations] = useCollection<Location>('locations');
  const [auditLogs] = useCollection<AuditLog>('audit-logs');
  const [history] = useCollection<AssetHistoryEvent>('history');
  const [itCallLogs] = useCollection<ItCallLog>('call-logs');
  const [softwareLicenses] = useCollection<SoftwareLicense>('licenses');
  const [policies]=useCollection<SystemPolicy>('system-policies');
  const policy=policies[0]||DEFAULT_SYSTEM_POLICY;
  const [maintenanceRecords] = useCollection<{ id: string; status?: string }>('maintenance');
  const assets = assetsList;
  const users = usersList;
  const assignments = assignmentsList;
  const totalAssets = assets.length;
  const assignedAssets = assets.filter(a => a.status === 'assigned').length;
  const availableAssets = assets.filter(a => a.status === 'available').length;
  const maintenanceAssets = assets.filter(a => a.status === 'maintenance').length;
  const retiredAssets = assets.filter(a => a.status === 'retired').length;
  const activeAssignments = assignments.filter(a => a.status === 'active').length;
  const totalUsers = users.length;
  const today = new Date().toISOString().split('T')[0];
  const todaysCalls = itCallLogs.filter(call => call.date === today).length;
  const openCalls = itCallLogs.filter(call => call.status === 'open' || call.status === 'in-progress').length;
  const criticalOpenCalls = itCallLogs.filter(call => call.priority === 'critical' && (call.status === 'open' || call.status === 'in-progress')).length;
  const lostAssets = assets.filter(asset => asset.status === 'lost').length;
  const pendingAssignments = assignments.filter(assignment => assignment.status === 'pending').length;

  // Asset status distribution
  const statusData = [
    { name: 'Assigned', value: assignedAssets, color: 'var(--primary)' },
    { name: 'Available', value: availableAssets, color: 'var(--chart-2)' },
    { name: 'Maintenance', value: maintenanceAssets, color: 'var(--chart-5)' },
    { name: 'Retired', value: retiredAssets, color: 'var(--muted-foreground)' },
  ];

  // Asset type distribution
  const typeData = assets.reduce((acc, asset) => {
    const existing = acc.find(item => item.name === asset.type);
    if (existing) {
      existing.value++;
    } else {
      acc.push({ name: asset.type, value: 1 });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  const typeColors = [
    'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)',
    'var(--chart-5)', 'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  ];

  // Warranty alerts use the organization policy.
  const now = new Date();
  const ninetyDaysFromNow = new Date(now.getTime() + policy.warrantyAlertDays * 24 * 60 * 60 * 1000);
  const warrantyAlerts = assets.filter(a => {
    const expiry = new Date(a.warrantyExpiry);
    return expiry <= ninetyDaysFromNow && expiry > now;
  });

  // Expired warranties
  const expiredWarranties = assets.filter(a => new Date(a.warrantyExpiry) <= now);
  const coverageExpiring = assets.filter(asset => [asset.amcExpiry, asset.insuranceExpiry].some(value => {
    if (!value) return false;
    const expiry = new Date(value);
    return expiry > now && expiry <= ninetyDaysFromNow;
  })).length;

  // License utilization
  const licenseUtilization = softwareLicenses.map(l => ({
    name: l.name.length > 15 ? l.name.substring(0, 15) + '...' : l.name,
    used: l.usedSeats,
    total: l.totalSeats,
    utilization: l.totalSeats > 0 ? Math.round((l.usedSeats / l.totalSeats) * 100) : 0
  }));

  // Recent activity: system audit entries plus asset lifecycle events, newest first
  const recentActivity = [
    ...auditLogs,
    ...history.map(event => ({
      id: event.id,
      timestamp: event.timestamp,
      userName: event.performedBy || 'System',
      action: event.action,
      entityName: assets.find(a => a.id === event.assetId)?.name || event.assetId,
    })),
  ]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 5);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const addedThisMonth = assets.filter(a => (a.purchaseDate || '').startsWith(thisMonth)).length;

  const tooltipStyle = {
    contentStyle: {
      background: 'var(--popover)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      boxShadow: 'var(--shadow-lift)',
      fontSize: 12,
      padding: '8px 12px',
    },
    itemStyle: { color: 'var(--popover-foreground)' },
    cursor: { fill: 'color-mix(in oklch, var(--primary) 8%, transparent)' },
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const statCards = [
    { label: 'Total Assets', value: totalAssets, icon: Package, tone: 'chart-1', note: <><span className="text-chart-2 font-semibold">+{addedThisMonth}</span> purchased this month</>, onClick: () => onAssetDrilldown?.({}) },
    { label: 'Assigned', value: assignedAssets, icon: Users, tone: 'chart-2', note: <>{activeAssignments} active assignments</>, onClick: () => onAssetDrilldown?.({ status: 'assigned' }) },
    { label: "Today's IT Calls", value: todaysCalls, icon: Headphones, tone: 'chart-4', note: <>{openCalls} open or in progress</>, onClick: () => onNavigate('call-logs') },
    { label: 'In Maintenance', value: maintenanceAssets, icon: AlertTriangle, tone: 'chart-3', note: <>{maintenanceRecords.filter(m => m.status === 'in-progress').length} in progress</>, onClick: () => onAssetDrilldown?.({ status: 'maintenance' }) },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">IT operations overview</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">{greeting}. Review inventory, support activity, and items requiring attention.</p>
      </div>

      {/* First-run guidance */}
      <SetupGuide onNavigate={onNavigate} assetCount={totalAssets} users={users} />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, tone, note, onClick }) => (
          <Card key={label} className="group cursor-pointer transition-colors hover:border-primary/30" onClick={onClick}>
            <CardHeader className="flex flex-row items-center justify-between pb-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-[18px] w-[18px]" style={{ color: `var(--${tone})` }} />
            </CardHeader>
            <CardContent>
              <div className="text-[30px] leading-9 font-semibold tracking-[-0.03em] text-foreground"><CountUp value={value} /></div>
              <p className="text-xs text-muted-foreground mt-2">{note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-amber-500/30 bg-amber-500/[0.04]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" />Needs Attention</CardTitle>
          <p className="text-sm text-muted-foreground">Operational exceptions that may need an IT team response.</p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <AttentionItem label="Under repair" value={maintenanceAssets} tone="warning" onClick={() => onAssetDrilldown?.({ status: 'maintenance' })} />
          <AttentionItem label="Critical IT calls" value={criticalOpenCalls} tone="danger" onClick={() => onNavigate('call-logs')} />
          <AttentionItem label="Expired warranties" value={expiredWarranties.length} tone="danger" onClick={() => onAssetDrilldown?.({ warranty: 'expired' })} />
          <AttentionItem label="Coverage expiring" value={coverageExpiring} tone="warning" onClick={() => onNavigate('reports')} />
          <AttentionItem label={lostAssets ? 'Lost assets' : 'Pending assignments'} value={lostAssets || pendingAssignments} tone={lostAssets ? 'danger' : 'neutral'} onClick={() => lostAssets ? onAssetDrilldown?.({ status: 'lost' }) : onNavigate('assignments')} />
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="af-stagger grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Asset Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    isAnimationActive={false}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3} cornerRadius={6} stroke="var(--card)" strokeWidth={2}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-4 justify-center mt-2">
              {statusData.map((item) => {
                const status = item.name.toLowerCase() === 'maintenance' ? 'maintenance' : item.name.toLowerCase() as AssetStatus;
                return (
                  <button type="button" key={item.name} className="flex items-center gap-2 hover:opacity-70" onClick={() => onAssetDrilldown?.({ status })}>
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-muted-foreground">{item.name} ({item.value})</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Asset Types */}
        <Card>
          <CardHeader>
            <CardTitle>Assets by Type</CardTitle><p className="text-xs text-muted-foreground">Use the asset filters for type drill-down.</p>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" width={80} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={18} isAnimationActive={false}>
                    {typeData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={typeColors[index % typeColors.length]}
                        onClick={() => onAssetDrilldown?.({ type: entry.name as AssetType })}
                        cursor="pointer"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts & Activity Row */}
      <div className="af-stagger grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Warranty Alerts */}
        <Card className="af-lift cursor-pointer" onClick={() => onAssetDrilldown?.({ warranty: '90' })}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Warranty Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiredWarranties.length > 0 && (
              <div className="mb-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm font-medium text-destructive">
                  {expiredWarranties.length} expired warrant{expiredWarranties.length === 1 ? 'y' : 'ies'}
                </p>
                {expiredWarranties.map(a => (
                  <p key={a.id} className="text-xs text-muted-foreground mt-1">{a.name} ({a.assetTag})</p>
                ))}
              </div>
            )}
            {warrantyAlerts.length > 0 ? (
              <div className="space-y-2">
                {warrantyAlerts.map(asset => (
                  <div key={asset.id} className="flex items-center justify-between p-2 border border-border rounded-md">
                    <div>
                      <p className="text-sm font-medium text-foreground">{asset.name}</p>
                      <p className="text-xs text-muted-foreground">{asset.assetTag}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {formatDate(asset.warrantyExpiry)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : expiredWarranties.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No warranty alerts</p>
            ) : null}
          </CardContent>
        </Card>

        {/* License Utilization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              License Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {licenseUtilization.slice(0, 5).map(license => (
                <div key={license.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">{license.name}</span>
                    <span className="text-xs text-muted-foreground">{license.utilization}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`af-bar h-full rounded-full transition-all ${
                        license.utilization > 90 ? 'bg-destructive' : 
                        license.utilization > 70 ? 'bg-chart-5' : 'bg-primary'
                      }`}
                      style={{ width: `${license.utilization}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {license.used}/{license.total} seats used
                  </p>
                </div>
              ))}
            </div>
            <Button 
              variant="ghost" 
              className="w-full mt-3 text-xs" 
              onClick={() => onNavigate('licenses')}
            >
              View all licenses <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map(log => (
                <div key={log.id} className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-muted-foreground">
                      {log.userName.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      <span className="font-medium">{log.userName}</span> {log.action.toLowerCase()}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{log.entityName}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(log.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button 
              variant="ghost" 
              className="w-full mt-3 text-xs" 
              onClick={() => onNavigate('audit-logs')}
            >
              View all logs <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div className="af-stagger grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <Card className="af-lift cursor-pointer" onClick={() => onNavigate('users')}>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalUsers}</p>
              <p className="text-sm text-muted-foreground">Total Users</p>
            </div>
          </CardContent>
        </Card>
        <Card className="af-lift cursor-pointer" onClick={() => onNavigate('locations')}>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-12 w-12 rounded-xl bg-chart-2/10 flex items-center justify-center">
              <MapPin className="h-6 w-6 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{locations.length}</p>
              <p className="text-sm text-muted-foreground">Sites</p>
            </div>
          </CardContent>
        </Card>
        <Card className="af-lift cursor-pointer" onClick={() => onNavigate('licenses')}>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-12 w-12 rounded-xl bg-chart-3/10 flex items-center justify-center">
              <Package className="h-6 w-6 text-chart-3" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{softwareLicenses.length}</p>
              <p className="text-sm text-muted-foreground">Software Licenses</p>
            </div>
          </CardContent>
        </Card>
        <Card className="af-lift cursor-pointer" onClick={() => onNavigate('reports')}>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-12 w-12 rounded-xl bg-chart-4/10 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-chart-4" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{itCallLogs.length}</p>
              <p className="text-sm text-muted-foreground">IT Calls Logged</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
