import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Headphones,
  Package,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  assets,
  assignments,
  formatCurrency,
  formatDate,
  formatTitle,
  itCallLogs,
  maintenanceRecords,
  softwareLicenses
} from '@/data/sampleData';
import { exportExcelReport } from '@/lib/reportExport';

export function ReportsPage() {
  const assetStatusRows = groupCount(assets.map(asset => asset.status));
  const callStatusRows = groupCount(itCallLogs.map(call => call.status));
  const callCategoryRows = groupCount(itCallLogs.map(call => call.category));
  const callVolumeRows = groupByDate(itCallLogs.map(call => call.date));
  const openCriticalCalls = itCallLogs.filter(call => call.priority === 'critical' && call.status !== 'closed');
  const activeAssignments = assignments.filter(assignment => assignment.status === 'active').length;
  const inMaintenance = maintenanceRecords.filter(record => record.status === 'in-progress').length;
  const expiringLicenses = softwareLicenses.filter(license => daysUntil(license.expiryDate) <= 120);
  const expiredWarranties = assets.filter(asset => daysUntil(asset.warrantyExpiry) <= 0);
  const assetValue = assets.reduce((total, asset) => total + asset.purchasePrice, 0);

  const chartColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

  const handleExport = () => {
    exportExcelReport({
      title: 'IT Asset Management Report',
      subtitle: 'Assets, daily IT calls, licenses, warranty, and maintenance overview',
      generatedBy: 'AssetFlow',
      sections: [
        {
          title: 'Executive Summary',
          headers: ['Metric', 'Value'],
          rows: [
            ['Total assets', assets.length],
            ['Asset purchase value', formatCurrency(assetValue)],
            ['Active assignments', activeAssignments],
            ['IT calls logged', itCallLogs.length],
            ['Open critical calls', openCriticalCalls.length],
            ['Assets in maintenance', inMaintenance],
            ['Expired warranties', expiredWarranties.length],
            ['Licenses expiring within 120 days', expiringLicenses.length]
          ]
        },
        {
          title: 'Asset Status',
          headers: ['Status', 'Count'],
          rows: assetStatusRows.map(row => [formatTitle(row.name), row.value])
        },
        {
          title: 'IT Call Status',
          headers: ['Status', 'Count'],
          rows: callStatusRows.map(row => [formatTitle(row.name), row.value])
        },
        {
          title: 'IT Calls By Category',
          headers: ['Category', 'Count'],
          rows: callCategoryRows.map(row => [formatTitle(row.name), row.value])
        },
        {
          title: 'High Priority Queue',
          headers: ['ID', 'Date', 'Caller', 'Department', 'Priority', 'Status', 'Issue'],
          rows: itCallLogs
            .filter(call => call.priority === 'high' || call.priority === 'critical')
            .map(call => [call.id, call.date, call.callerName, call.department, formatTitle(call.priority), formatTitle(call.status), call.issue])
        },
        {
          title: 'Warranty Risk',
          headers: ['Asset Tag', 'Asset', 'Warranty Expiry', 'Status'],
          rows: assets
            .filter(asset => daysUntil(asset.warrantyExpiry) <= 120)
            .map(asset => [asset.assetTag, asset.name, asset.warrantyExpiry, asset.status])
        },
        {
          title: 'License Utilization',
          headers: ['License', 'Vendor', 'Used Seats', 'Total Seats', 'Utilization', 'Expiry'],
          rows: softwareLicenses.map(license => [
            license.name,
            license.vendor,
            license.usedSeats,
            license.totalSeats,
            `${Math.round((license.usedSeats / license.totalSeats) * 100)}%`,
            license.expiryDate
          ])
        }
      ]
    }, 'it-asset-management-report.xls');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground">Automatically generated IT asset and support insights</p>
        </div>
        <Button onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export Excel Report
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportMetric label="Asset Value" value={formatCurrency(assetValue)} icon={FileSpreadsheet} />
        <ReportMetric label="Active Assignments" value={activeAssignments} icon={Package} />
        <ReportMetric label="IT Calls" value={itCallLogs.length} icon={Headphones} />
        <ReportMetric label="Risk Items" value={expiredWarranties.length + expiringLicenses.length + openCriticalCalls.length} icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Asset Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={assetStatusRows} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={96} paddingAngle={2}>
                    {assetStatusRows.map((_, index) => (
                      <Cell key={index} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, formatTitle(String(name))]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <Legend rows={assetStatusRows} colors={chartColors} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily IT Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={callVolumeRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Calls By Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={callCategoryRows} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tickFormatter={formatTitle} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" width={100} />
                  <Tooltip labelFormatter={(label) => formatTitle(String(label))} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {callCategoryRows.map((_, index) => (
                      <Cell key={index} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operational Risk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RiskRow label="Open critical calls" value={openCriticalCalls.length} icon={Headphones} />
            <RiskRow label="Assets in maintenance" value={inMaintenance} icon={TrendingUp} />
            <RiskRow label="Expired warranties" value={expiredWarranties.length} icon={AlertTriangle} />
            <RiskRow label="Licenses expiring within 120 days" value={expiringLicenses.length} icon={ShieldCheck} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Review Queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Area</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expiredWarranties.map(asset => (
                <TableRow key={asset.id}>
                  <TableCell>Warranty</TableCell>
                  <TableCell>{asset.name} ({asset.assetTag})</TableCell>
                  <TableCell>{formatDate(asset.warrantyExpiry)}</TableCell>
                  <TableCell><Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Expired</Badge></TableCell>
                </TableRow>
              ))}
              {expiringLicenses.map(license => (
                <TableRow key={license.id}>
                  <TableCell>License</TableCell>
                  <TableCell>{license.name}</TableCell>
                  <TableCell>{formatDate(license.expiryDate)}</TableCell>
                  <TableCell><Badge variant="outline" className="bg-chart-5/10 text-chart-5 border-chart-5/20">Renewal Review</Badge></TableCell>
                </TableRow>
              ))}
              {openCriticalCalls.map(call => (
                <TableRow key={call.id}>
                  <TableCell>IT Call</TableCell>
                  <TableCell>{call.issue}</TableCell>
                  <TableCell>{formatDate(call.date)}</TableCell>
                  <TableCell><Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Critical</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportMetric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Package }) {
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

function RiskRow({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Package }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <span className="text-xl font-semibold text-foreground">{value}</span>
    </div>
  );
}

function Legend({ rows, colors }: { rows: Array<{ name: string; value: number }>; colors: string[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-4">
      {rows.map((row, index) => (
        <div key={row.name} className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
          <span className="text-xs text-muted-foreground">{formatTitle(row.name)} ({row.value})</span>
        </div>
      ))}
    </div>
  );
}

function groupCount(values: string[]) {
  return values.reduce((rows, value) => {
    const row = rows.find(item => item.name === value);
    if (row) {
      row.value += 1;
    } else {
      rows.push({ name: value, value: 1 });
    }
    return rows;
  }, [] as Array<{ name: string; value: number }>);
}

function groupByDate(values: string[]) {
  return groupCount(values)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(row => ({ ...row, name: row.name.slice(5) }));
}

function daysUntil(date: string) {
  const today = new Date();
  const target = new Date(date);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
