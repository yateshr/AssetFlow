import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  Download,
  FileSpreadsheet,
  Laptop,
  MapPin,
  Package,
  Receipt,
  ShieldAlert,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { exportExcelReport } from '@/lib/reportExport';
import {
  formatCurrency,
  formatDate,
  formatTitle,
  type Asset,
  type Assignment,
  type Invoice,
  type Location,
  type User,
  type Vendor,
} from '@/data/sampleData';

type Period = 'month' | 'quarter' | 'year' | 'all' | 'custom';

interface ReportsPageProps {
  assetsList: Asset[];
  usersList: User[];
  assignmentsList: Assignment[];
  invoicesList: Invoice[];
  vendorsList: Vendor[];
  locationsList: Location[];
  departmentsList: string[];
}

const chartColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export function ReportsPage({
  assetsList,
  usersList,
  assignmentsList,
  invoicesList,
  vendorsList,
  locationsList,
  departmentsList,
}: ReportsPageProps) {
  const [period, setPeriod] = useState<Period>('year');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [assetTypeFilter, setAssetTypeFilter] = useState('all');

  const today = new Date();

  const range = useMemo(() => {
    const end = new Date(today);
    let start: Date | null = null;

    if (period === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (period === 'quarter') {
      start = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
    } else if (period === 'year') {
      start = new Date(today.getFullYear(), 0, 1);
    } else if (period === 'custom' && customFrom) {
      start = new Date(`${customFrom}T00:00:00`);
      if (customTo) {
        end.setTime(new Date(`${customTo}T23:59:59`).getTime());
      }
    }

    return { start, end };
  }, [period, customFrom, customTo]);

  const inPeriod = (date: string) => {
    const value = new Date(`${date}T00:00:00`);
    if (Number.isNaN(value.getTime())) return false;
    if (range.start && value < range.start) return false;
    if (value > range.end) return false;
    return true;
  };

  const filteredAssets = useMemo(() => {
    return assetsList.filter((asset) => {
      const matchesDepartment =
        departmentFilter === 'all' ||
        (asset.assignedTo
          ? usersList.find((u) => u.id === asset.assignedTo)?.department === departmentFilter
          : false);

      const matchesLocation =
        locationFilter === 'all' ||
        asset.location === locationFilter ||
        locationsList.find((l) => l.id === asset.location)?.name === locationFilter;

      const matchesType = assetTypeFilter === 'all' || asset.type === assetTypeFilter;

      return matchesDepartment && matchesLocation && matchesType;
    });
  }, [assetsList, usersList, locationsList, departmentFilter, locationFilter, assetTypeFilter]);

  const periodAssets = filteredAssets.filter((asset) => inPeriod(asset.purchaseDate));
  const periodInvoices = invoicesList.filter((invoice) => inPeriod(invoice.invoiceDate));

  const totalValue = filteredAssets.reduce((sum, asset) => sum + asset.purchasePrice, 0);
  const periodSpend = periodInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const assignedCount = filteredAssets.filter((asset) => asset.status === 'assigned').length;
  const availableCount = filteredAssets.filter((asset) => asset.status === 'available').length;
  const maintenanceCount = filteredAssets.filter((asset) => asset.status === 'maintenance').length;
  const retiredCount = filteredAssets.filter((asset) => asset.status === 'retired').length;
  const disposedCount = filteredAssets.filter((asset) => asset.status === 'disposed').length;
  const lostCount = filteredAssets.filter((asset) => asset.status === 'lost').length;

  const warrantySoon = filteredAssets.filter((asset) => {
    const expiry = new Date(`${asset.warrantyExpiry}T00:00:00`);
    const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
    return days >= 0 && days <= 90;
  });

  const warrantyExpired = filteredAssets.filter((asset) => {
    const expiry = new Date(`${asset.warrantyExpiry}T00:00:00`);
    return expiry.getTime() < today.getTime();
  });

  const activeAssignments = assignmentsList.filter((a) => a.status === 'active').length;
  const pendingAssignments = assignmentsList.filter((a) => a.status === 'pending').length;
  const activeUsers = usersList.filter((u) => u.status === 'active').length;

  const statusRows = [
    { name: 'Assigned', value: assignedCount },
    { name: 'Available', value: availableCount },
    { name: 'Maintenance', value: maintenanceCount },
    { name: 'Retired', value: retiredCount },
    { name: 'Disposed', value: disposedCount },
    { name: 'Lost', value: lostCount },
  ].filter((row) => row.value > 0);

  const typeRows = Object.entries(
    filteredAssets.reduce<Record<string, number>>((acc, asset) => {
      acc[asset.type] = (acc[asset.type] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, value]) => ({ name: formatTitle(name), value }))
    .sort((a, b) => b.value - a.value);

  const departmentRows = departmentsList
    .map((department) => ({
      name: department,
      value: filteredAssets.filter((asset) => {
        if (!asset.assignedTo) return false;
        return usersList.find((u) => u.id === asset.assignedTo)?.department === department;
      }).length,
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);

  const locationRows = locationsList
    .map((location) => ({
      name: location.name,
      value: filteredAssets.filter(
        (asset) =>
          asset.location === location.id || asset.location === location.name
      ).length,
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);

  const vendorRows = vendorsList
    .map((vendor) => ({
      name: vendor.name,
      value: periodInvoices
        .filter((invoice) => invoice.vendorId === vendor.id)
        .reduce((sum, invoice) => sum + invoice.total, 0),
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const monthlySpend = useMemo(() => {
    const map = new Map<string, number>();
    periodInvoices.forEach((invoice) => {
      const key = invoice.invoiceDate.slice(0, 7);
      map.set(key, (map.get(key) || 0) + invoice.total);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, value]) => ({
        month: new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        }),
        value,
      }));
  }, [periodInvoices]);

  const periodLabel =
    period === 'all'
      ? 'All available data'
      : period === 'custom'
        ? `${customFrom || 'Start'} → ${customTo || 'Today'}`
        : period === 'month'
          ? 'This month'
          : period === 'quarter'
            ? 'This quarter'
            : 'This year';

  const handleExport = () => {
    exportExcelReport(
      {
        title: 'AssetFlow Executive Management Report',
        subtitle: `${periodLabel} • Management summary`,
        generatedBy: 'AssetFlow',
        sections: [
          {
            title: 'Executive Summary',
            headers: ['Metric', 'Value'],
            rows: [
              ['Reporting period', periodLabel],
              ['Assets in scope', filteredAssets.length],
              ['Total asset purchase value', formatCurrency(totalValue)],
              ['Assets purchased in period', periodAssets.length],
              ['Period invoice spend', formatCurrency(periodSpend)],
              ['Active assignments', activeAssignments],
              ['Pending assignments', pendingAssignments],
              ['Active employees', activeUsers],
              ['Warranty expiring within 90 days', warrantySoon.length],
              ['Expired warranties', warrantyExpired.length],
              ['Assets under maintenance', maintenanceCount],
              ['Lost assets', lostCount],
            ],
          },
          {
            title: 'Asset Status',
            headers: ['Status', 'Count'],
            rows: statusRows.map((row) => [row.name, row.value]),
          },
          {
            title: 'Assets by Type',
            headers: ['Asset Type', 'Count'],
            rows: typeRows.map((row) => [row.name, row.value]),
          },
          {
            title: 'Assets by Department',
            headers: ['Department', 'Count'],
            rows: departmentRows.map((row) => [row.name, row.value]),
          },
          {
            title: 'Assets by Location',
            headers: ['Location', 'Count'],
            rows: locationRows.map((row) => [row.name, row.value]),
          },
          {
            title: 'Vendor Spend',
            headers: ['Vendor', 'Invoice Spend'],
            rows: vendorRows.map((row) => [row.name, formatCurrency(row.value)]),
          },
          {
            title: 'Warranty Risk',
            headers: ['Asset Tag', 'Asset', 'Warranty Expiry', 'Status'],
            rows: [...warrantySoon, ...warrantyExpired]
              .sort((a, b) => a.warrantyExpiry.localeCompare(b.warrantyExpiry))
              .map((asset) => [
                asset.assetTag,
                asset.name,
                formatDate(asset.warrantyExpiry),
                formatTitle(asset.status),
              ]),
          },
        ],
      },
      `assetflow-executive-report-${new Date().toISOString().slice(0, 10)}.xls`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Executive / Management Reports</h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            Management-ready view of asset inventory, financial activity, operations, and risk.
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export Management Report
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
            >
              <option value="month">This month</option>
              <option value="quarter">This quarter</option>
              <option value="year">This year</option>
              <option value="all">All available data</option>
              <option value="custom">Custom range</option>
            </select>

            {period === 'custom' ? (
              <>
                <input
                  type="date"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
                <input
                  type="date"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </>
            ) : (
              <div className="hidden lg:block" />
            )}

            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="all">All departments</option>
              {departmentsList.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>

            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="all">All locations</option>
              {locationsList.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={assetTypeFilter}
              onChange={(e) => setAssetTypeFilter(e.target.value)}
            >
              <option value="all">All asset types</option>
              {['laptop', 'desktop', 'monitor', 'phone', 'tablet', 'printer', 'server', 'accessory'].map((type) => (
                <option key={type} value={type}>{formatTitle(type)}</option>
              ))}
            </select>
            <Badge variant="outline">{periodLabel}</Badge>
            <span className="text-sm text-muted-foreground">
              {filteredAssets.length} assets in scope
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Asset Value" value={formatCurrency(totalValue)} icon={Wallet} />
        <MetricCard label="Assets in Scope" value={filteredAssets.length} icon={Package} />
        <MetricCard label="Period IT Spend" value={formatCurrency(periodSpend)} icon={Receipt} />
        <MetricCard label="Active Assignments" value={activeAssignments} icon={Activity} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Assigned" value={assignedCount} icon={Users} />
        <MetricCard label="Available" value={availableCount} icon={Laptop} />
        <MetricCard label="Under Maintenance" value={maintenanceCount} icon={TrendingUp} />
        <MetricCard label="Active Employees" value={activeUsers} icon={Building2} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Asset Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {statusRows.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusRows}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={105}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {statusRows.map((_, index) => (
                        <Cell key={index} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No assets match the selected filters." />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assets by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {typeRows.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeRows} layout="vertical" margin={{ left: 12, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={90} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {typeRows.map((_, index) => (
                        <Cell key={index} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No asset type data available." />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Asset Distribution by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {departmentRows.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentRows} margin={{ left: 8, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-25} textAnchor="end" height={70} interval={0} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {departmentRows.map((_, index) => (
                        <Cell key={index} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No department assignment data available." />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>IT Spend Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {monthlySpend.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySpend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => formatCurrency(Number(value))} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No invoice activity in the selected period." />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Risk & Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <RiskRow label="Warranty expiring within 90 days" value={warrantySoon.length} />
            <RiskRow label="Expired warranties" value={warrantyExpired.length} />
            <RiskRow label="Lost assets" value={lostCount} />
            <RiskRow label="Disposed assets" value={disposedCount} />
            <RiskRow label="Pending assignments" value={pendingAssignments} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {locationRows.length ? locationRows.slice(0, 8).map((row) => (
              <div key={row.name} className="flex items-center justify-between gap-3">
                <span className="truncate text-sm">{row.name}</span>
                <Badge variant="secondary">{row.value}</Badge>
              </div>
            )) : <EmptyState text="No location data available." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Vendor Spend
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {vendorRows.length ? vendorRows.map((row) => (
              <div key={row.name} className="flex items-center justify-between gap-3">
                <span className="truncate text-sm">{row.name}</span>
                <span className="text-sm font-medium">{formatCurrency(row.value)}</span>
              </div>
            )) : <EmptyState text="No invoice spend in the selected period." />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Management Review Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <ReviewCard
              title="Warranty Renewal"
              count={warrantySoon.length}
              detail="Assets expiring within 90 days"
            />
            <ReviewCard
              title="Expired Warranty"
              count={warrantyExpired.length}
              detail="Assets already outside warranty"
            />
            <ReviewCard
              title="Lost Assets"
              count={lostCount}
              detail="Assets requiring investigation"
            />
            <ReviewCard
              title="Pending Assignment"
              count={pendingAssignments}
              detail="Assignments awaiting completion"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Package;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}

function RiskRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Badge variant={value > 0 ? 'outline' : 'secondary'}>{value}</Badge>
    </div>
  );
}

function ReviewCard({
  title,
  count,
  detail,
}: {
  title: string;
  count: number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{title}</p>
        <Badge variant={count > 0 ? 'outline' : 'secondary'}>{count}</Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
