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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  assets as sampleAssets, 
  users as sampleUsers, 
  locations, 
  assignments as sampleAssignments, 
  auditLogs,
  itCallLogs,
  softwareLicenses,
  maintenanceRecords,
  formatDate, 
  formatDateTime,
  formatCurrency,
  type AssetStatus,
  type AssetType 
} from '@/data/sampleData';
import type { Page } from './App';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface DashboardProps {
  onNavigate: (page: Page) => void;
  assetsList?: typeof sampleAssets;
  usersList?: typeof sampleUsers;
  assignmentsList?: typeof sampleAssignments;
  onAssetDrilldown?: (filter: { status?: AssetStatus; warranty?: 'expired'|'30'|'60'|'90'; type?: typeof sampleAssets[number]['type'] }) => void;
}

export function Dashboard({ onNavigate, assetsList = sampleAssets, usersList = sampleUsers, assignmentsList = sampleAssignments, onAssetDrilldown }: DashboardProps) {
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

  // Asset status distribution
  const statusData = [
    { name: 'Assigned', value: assignedAssets, color: 'var(--chart-1)' },
    { name: 'Available', value: availableAssets, color: 'var(--chart-2)' },
    { name: 'Maintenance', value: maintenanceAssets, color: 'var(--chart-3)' },
    { name: 'Retired', value: retiredAssets, color: 'var(--chart-4)' },
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

  // Warranty alerts (expiring within 90 days)
  const now = new Date();
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const warrantyAlerts = assets.filter(a => {
    const expiry = new Date(a.warrantyExpiry);
    return expiry <= ninetyDaysFromNow && expiry > now;
  });

  // Expired warranties
  const expiredWarranties = assets.filter(a => new Date(a.warrantyExpiry) <= now);

  // License utilization
  const licenseUtilization = softwareLicenses.map(l => ({
    name: l.name.length > 15 ? l.name.substring(0, 15) + '...' : l.name,
    used: l.usedSeats,
    total: l.totalSeats,
    utilization: Math.round((l.usedSeats / l.totalSeats) * 100)
  }));

  // Recent activity
  const recentActivity = auditLogs.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your IT asset management system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => onAssetDrilldown?.({})}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Assets</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalAssets}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-chart-2 font-medium">+3</span> added this month
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => onAssetDrilldown?.({ status: 'assigned' })}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assigned</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{assignedAssets}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeAssignments} active assignments
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => onNavigate('call-logs')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's IT Calls</CardTitle>
            <Headphones className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{todaysCalls}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {openCalls} open or in progress
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => onAssetDrilldown?.({ status: 'maintenance' })}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Maintenance</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{maintenanceAssets}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {maintenanceRecords.filter(m => m.status === 'in-progress').length} in progress
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" width={80} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Warranty Alerts */}
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => onAssetDrilldown?.({ warranty: '90' })}>
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
                      className={`h-full rounded-full transition-all ${
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => onNavigate('users')}>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalUsers}</p>
              <p className="text-sm text-muted-foreground">Total Users</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => onNavigate('locations')}>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-12 w-12 rounded-lg bg-chart-2/10 flex items-center justify-center">
              <MapPin className="h-6 w-6 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{locations.length}</p>
              <p className="text-sm text-muted-foreground">Locations</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => onNavigate('licenses')}>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-12 w-12 rounded-lg bg-chart-3/10 flex items-center justify-center">
              <Package className="h-6 w-6 text-chart-3" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{softwareLicenses.length}</p>
              <p className="text-sm text-muted-foreground">Software Licenses</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => onNavigate('reports')}>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-12 w-12 rounded-lg bg-chart-4/10 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-chart-4" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{itCallLogs.length}</p>
              <p className="text-sm text-muted-foreground">Report Data Points</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
