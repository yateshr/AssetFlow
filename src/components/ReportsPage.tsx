import { useEffect, useMemo, useState } from 'react';
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
import { loadConsolidatedSummary, useCollection } from '@/lib/db';
import { DEFAULT_SYSTEM_POLICY, type SystemPolicy } from '@/data/masterData';
import {
  formatCurrency,
  formatDate,
  formatTitle,
  type Asset,
  type AssetHistoryEvent,
  type Assignment,
  type Invoice,
  type Location,
  type ItCallLog,
  type User,
  type Vendor,
  type AssetCategory,
  type CompanySummary,
} from '@/data/models';

type Period = 'month' | 'quarter' | 'year' | 'all' | 'custom';

interface ReportsPageProps {
  assetsList: Asset[];
  usersList: User[];
  assignmentsList: Assignment[];
  invoicesList: Invoice[];
  vendorsList: Vendor[];
  sitesList: Location[];
  departmentsList: string[];
  callLogsList: ItCallLog[];
  history: AssetHistoryEvent[];
  assetCategories: AssetCategory[];
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
  sitesList,
  departmentsList,
  callLogsList,
  history,
  assetCategories,
}: ReportsPageProps) {
  const [policies]=useCollection<SystemPolicy>('system-policies');
  const policy=policies[0]||DEFAULT_SYSTEM_POLICY;
  const [period, setPeriod] = useState<Period>('year');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [assetTypeFilter, setAssetTypeFilter] = useState('all');
  const [reportView, setReportView] = useState<'portfolio' | 'overview' | 'assets' | 'lifecycle' | 'calls' | 'financial'>('overview');
  const [portfolio,setPortfolio]=useState<CompanySummary[]>([]);
  useEffect(()=>{loadConsolidatedSummary().then(setPortfolio).catch(()=>setPortfolio([]));},[]);

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
        asset.siteId === locationFilter ||
        sitesList.find((l) => l.id === asset.siteId)?.name === locationFilter;

      const matchesType = assetTypeFilter === 'all' || asset.type === assetTypeFilter;

      return matchesDepartment && matchesLocation && matchesType;
    });
  }, [assetsList, usersList, sitesList, departmentFilter, locationFilter, assetTypeFilter]);

  const periodAssets = filteredAssets.filter((asset) => inPeriod(asset.purchaseDate));
  const periodInvoices = invoicesList.filter((invoice) => inPeriod(invoice.invoiceDate));
  const periodCalls = callLogsList.filter((call) =>
    inPeriod(call.date) && (departmentFilter === 'all' || call.department === departmentFilter)
  );
  const scopedAssetIds = new Set(filteredAssets.map((asset) => asset.id));
  const periodHistory = history.filter((event) =>
    scopedAssetIds.has(event.assetId) && inPeriod(event.timestamp.slice(0, 10))
  );

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
    return days >= 0 && days <= policy.warrantyAlertDays;
  });

  const warrantyExpired = filteredAssets.filter((asset) => {
    const expiry = new Date(`${asset.warrantyExpiry}T00:00:00`);
    return expiry.getTime() < today.getTime();
  });

  const activeAssignments = assignmentsList.filter((a) => a.status === 'active').length;
  const pendingAssignments = assignmentsList.filter((a) => a.status === 'pending').length;
  const activeUsers = usersList.filter((u) => u.status === 'active').length;
  const openCalls = periodCalls.filter((call) => call.status === 'open' || call.status === 'in-progress').length;
  const resolvedCalls = periodCalls.filter((call) => call.status === 'resolved' || call.status === 'closed').length;
  const callResolutionRate = periodCalls.length ? Math.round((resolvedCalls / periodCalls.length) * 100) : 0;

  const statusRows = [
    { name: 'Assigned', value: assignedCount, color: 'var(--primary)' },
    { name: 'Available', value: availableCount, color: 'var(--chart-2)' },
    { name: 'Maintenance', value: maintenanceCount, color: 'var(--chart-5)' },
    { name: 'Retired', value: retiredCount, color: 'var(--muted-foreground)' },
    { name: 'Disposed', value: disposedCount, color: 'var(--muted-foreground)' },
    { name: 'Lost', value: lostCount, color: 'var(--destructive)' },
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

  const locationRows = sitesList
    .map((location) => ({
      name: location.name,
      value: filteredAssets.filter(
        (asset) =>
          asset.siteId === location.id || asset.siteId === location.name
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

  const callCategoryRows = Object.entries(
    periodCalls.reduce<Record<string, number>>((acc, call) => {
      acc[formatTitle(call.category)] = (acc[formatTitle(call.category)] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const lifecycleRows = Object.entries(
    periodHistory.reduce<Record<string, number>>((acc, event) => {
      acc[event.action] = (acc[event.action] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

  const warrantyForecast = Object.entries(
    filteredAssets.reduce<Record<string, number>>((acc, asset) => {
      const expiry = new Date(`${asset.warrantyExpiry}T00:00:00`);
      const months = (expiry.getFullYear() - today.getFullYear()) * 12 + expiry.getMonth() - today.getMonth();
      if (Number.isFinite(expiry.getTime()) && months >= 0 && months < 12) {
        const key = asset.warrantyExpiry.slice(0, 7);
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {})
  ).sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({
    month: new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    value,
  }));

  const amcExpiring = filteredAssets.filter((asset) => asset.amcExpiry && new Date(asset.amcExpiry) >= today && new Date(asset.amcExpiry).getTime() <= today.getTime() + policy.warrantyAlertDays * 86400000);
  const insuranceExpiring = filteredAssets.filter((asset) => asset.insuranceExpiry && new Date(asset.insuranceExpiry) >= today && new Date(asset.insuranceExpiry).getTime() <= today.getTime() + policy.warrantyAlertDays * 86400000);

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

  const chartTooltip = {
    contentStyle: {
      background: 'var(--popover)',
      color: 'var(--popover-foreground)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      fontSize: 12,
    },
    cursor: { fill: 'color-mix(in oklch, var(--primary) 8%, transparent)' },
  };

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
              [`Warranty expiring within ${policy.warrantyAlertDays} days`, warrantySoon.length],
              ['Expired warranties', warrantyExpired.length],
              ['Assets under maintenance', maintenanceCount],
              ['Lost assets', lostCount],
              ['IT calls in period', periodCalls.length],
              ['Open IT calls', openCalls],
              ['Call resolution rate', `${callResolutionRate}%`],
              ['Lifecycle events in period', periodHistory.length],
              [`AMC expiring within ${policy.warrantyAlertDays} days`, amcExpiring.length],
              [`Insurance expiring within ${policy.warrantyAlertDays} days`, insuranceExpiring.length],
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
            title: 'Assets by Site',
            headers: ['Site', 'Count'],
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
          {
            title: 'IT Call Analysis',
            headers: ['Category', 'Calls'],
            rows: callCategoryRows.map((row) => [row.name, row.value]),
          },
          {
            title: 'Asset Lifecycle Activity',
            headers: ['Lifecycle Action', 'Events'],
            rows: lifecycleRows.map((row) => [row.name, row.value]),
          },
        ],
      },
      `assetflow-executive-report-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  return (
    <div className="af-stagger space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Executive / Management Reports</h1>
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
              <option value="all">All sites</option>
              {sitesList.map((location) => (
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
              {assetCategories.filter(category=>category.active&&category.name.trim()).map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <Badge variant="outline">{periodLabel}</Badge>
            <span className="text-sm text-muted-foreground">
              {filteredAssets.length} assets in scope
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1" role="tablist" aria-label="Report sections">
        {([
          ['portfolio', 'All Companies'],
          ['overview', 'Overview'],
          ['assets', 'Assets'],
          ['lifecycle', 'Lifecycle'],
          ['calls', 'IT Calls'],
          ['financial', 'Financial'],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={reportView === value} onClick={() => setReportView(value)} className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${reportView === value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      <Card className={reportView==='portfolio'?'':'hidden'}><CardHeader><CardTitle>Company portfolio</CardTitle><p className="text-sm text-muted-foreground">Consolidated operational position across every company you can access.</p></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="py-3">Company</th><th>Sites</th><th>Users</th><th>Assets</th><th>Assigned</th><th>Maintenance</th><th>Open calls</th><th className="text-right">Asset value</th><th className="text-right">Invoice total</th></tr></thead><tbody>{portfolio.map(row=><tr key={row.companyId} className="border-b last:border-0"><td className="py-4"><p className="font-medium">{row.companyName}</p><p className="text-xs text-muted-foreground">{row.companyCode}</p></td><td>{row.sites}</td><td>{row.users}</td><td>{row.assets}</td><td>{row.assigned}</td><td>{row.maintenance}</td><td>{row.openCalls}</td><td className="text-right">{formatCurrency(row.assetValue)}</td><td className="text-right">{formatCurrency(row.invoiceTotal)}</td></tr>)}{portfolio.length===0&&<tr><td colSpan={9} className="py-10 text-center text-muted-foreground">No accessible company data is available.</td></tr>}</tbody></table></CardContent></Card>

      <div className={`${reportView==='portfolio'?'hidden':'grid'} grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4`}>
        <MetricCard label="Total Asset Value" value={formatCurrency(totalValue)} icon={Wallet} />
        <MetricCard label="Assets in Scope" value={filteredAssets.length} icon={Package} />
        <MetricCard label="Period IT Spend" value={formatCurrency(periodSpend)} icon={Receipt} />
        <MetricCard label="Active Assignments" value={activeAssignments} icon={Activity} />
      </div>

      <div className={`${reportView === 'overview' || reportView === 'assets' ? 'grid' : 'hidden'} grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4`}>
        <MetricCard label="Assigned" value={assignedCount} icon={Users} />
        <MetricCard label="Available" value={availableCount} icon={Laptop} />
        <MetricCard label="Under Maintenance" value={maintenanceCount} icon={TrendingUp} />
        <MetricCard label="Active Employees" value={activeUsers} icon={Building2} />
      </div>

      <div className={`${reportView === 'overview' || reportView === 'calls' || reportView === 'lifecycle' ? 'grid' : 'hidden'} grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4`}>
        <MetricCard label="IT Calls" value={periodCalls.length} icon={Activity} />
        <MetricCard label="Open Calls" value={openCalls} icon={AlertTriangle} />
        <MetricCard label="Resolution Rate" value={`${callResolutionRate}%`} icon={TrendingUp} />
        <MetricCard label="Lifecycle Events" value={periodHistory.length} icon={Package} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className={reportView === 'assets' ? '' : 'hidden'}>
          <CardHeader>
            <CardTitle>Asset Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {reportView === 'assets' && statusRows.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusRows}
                      isAnimationActive={false}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={105}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {statusRows.map((_, index) => (
                        <Cell key={index} fill={statusRows[index].color} />
                      ))}
                    </Pie>
                    <Tooltip {...chartTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No assets match the selected filters." />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={reportView === 'assets' ? '' : 'hidden'}>
          <CardHeader>
            <CardTitle>Assets by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {reportView === 'assets' && typeRows.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeRows} layout="vertical" margin={{ left: 12, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={90} />
                    <Tooltip {...chartTooltip} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
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

        <Card className={reportView === 'assets' ? '' : 'hidden'}>
          <CardHeader>
            <CardTitle>Asset Distribution by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {reportView === 'assets' && departmentRows.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentRows} margin={{ left: 8, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-25} textAnchor="end" height={70} interval={0} />
                    <YAxis allowDecimals={false} />
                    <Tooltip {...chartTooltip} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
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

        <Card className={reportView === 'financial' ? '' : 'hidden'}>
          <CardHeader>
            <CardTitle>IT Spend Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {reportView === 'financial' && monthlySpend.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySpend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => formatCurrency(Number(value))} />
                    <Tooltip {...chartTooltip} formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
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
        <Card className={reportView === 'calls' ? '' : 'hidden'}>
          <CardHeader><CardTitle>IT Calls by Category</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {reportView === 'calls' && callCategoryRows.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={callCategoryRows} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={110} />
                    <Tooltip {...chartTooltip} />
                    <Bar dataKey="value" fill="var(--chart-2)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState text="No IT calls in the selected period." />}
            </div>
          </CardContent>
        </Card>

        <Card className={reportView === 'lifecycle' ? '' : 'hidden'}>
          <CardHeader><CardTitle>Asset Lifecycle Activity</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {reportView === 'lifecycle' && lifecycleRows.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={lifecycleRows} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={105} />
                    <Tooltip {...chartTooltip} />
                    <Bar dataKey="value" fill="var(--chart-3)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState text="No lifecycle activity in the selected period." />}
            </div>
          </CardContent>
        </Card>

        <Card className={reportView === 'lifecycle' ? '' : 'hidden'}>
          <CardHeader><CardTitle>Warranty Expiry Forecast</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {reportView === 'lifecycle' && warrantyForecast.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={warrantyForecast}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip {...chartTooltip} />
                    <Bar dataKey="value" fill="var(--chart-5)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState text="No warranty expiries in the next 12 months." />}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className={reportView === 'lifecycle' ? '' : 'hidden'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Risk & Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <RiskRow label={`Warranty expiring within ${policy.warrantyAlertDays} days`} value={warrantySoon.length} />
            <RiskRow label="Expired warranties" value={warrantyExpired.length} />
            <RiskRow label="Lost assets" value={lostCount} />
            <RiskRow label="Disposed assets" value={disposedCount} />
            <RiskRow label="Pending assignments" value={pendingAssignments} />
            <RiskRow label={`AMC expiring within ${policy.warrantyAlertDays} days`} value={amcExpiring.length} />
            <RiskRow label={`Insurance expiring within ${policy.warrantyAlertDays} days`} value={insuranceExpiring.length} />
          </CardContent>
        </Card>

        <Card className={reportView === 'assets' ? '' : 'hidden'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Site Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {locationRows.length ? locationRows.slice(0, 8).map((row) => (
              <div key={row.name} className="flex items-center justify-between gap-3">
                <span className="truncate text-sm">{row.name}</span>
                <Badge variant="secondary">{row.value}</Badge>
              </div>
            )) : <EmptyState text="No site data available." />}
          </CardContent>
        </Card>

        <Card className={reportView === 'financial' ? '' : 'hidden'}>
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

      <Card className={reportView === 'overview' ? '' : 'hidden'}>
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
              detail={`Assets expiring within ${policy.warrantyAlertDays} days`}
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
