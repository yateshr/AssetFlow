import { useMemo, useState } from 'react';
import { Search, Download, FileText, User, Package, MapPin, Key, Truck, ShieldCheck, Activity, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { auditLogs, type AuditLog, type AssetHistoryEvent, type User as UserRecord, type Asset, formatDateTime } from '@/data/sampleData';

interface AuditLogsPageProps {
  history?: AssetHistoryEvent[];
  usersList?: UserRecord[];
  assetsList?: Asset[];
}

type AuditRow = AuditLog & { source?: string };

export function AuditLogsPage({ history = [], usersList = [], assetsList = [] }: AuditLogsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState<'all'|'system'|'lifecycle'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const lifecycleLogs: AuditRow[] = useMemo(() => history.map(event => ({
    id: `history-${event.id}`,
    timestamp: event.timestamp,
    action: event.action,
    entityType: 'Asset',
    entityId: event.assetId,
    entityName: assetsList.find(a => a.id === event.assetId)?.name || event.assetId,
    userId: event.performedBy || '',
    userName: usersList.find(u => u.id === event.performedBy)?.name || event.performedBy || 'System',
    details: [
      event.from && `From: ${event.from}`,
      event.to && `To: ${event.to}`,
      event.reason,
      event.notes,
      event.beforeValue && `Before: ${event.beforeValue}`,
      event.afterValue && `After: ${event.afterValue}`,
    ].filter(Boolean).join(' • '),
    source: event.source || 'lifecycle'
  })), [history, usersList, assetsList]);

  const allLogs = useMemo<AuditRow[]>(() => [...auditLogs.map(x => ({...x, source:'system' as const})), ...lifecycleLogs]
    .sort((a,b) => b.timestamp.localeCompare(a.timestamp)), [lifecycleLogs]);

  const actions = [...new Set(allLogs.map(log => log.action))];
  const entityTypes = [...new Set(allLogs.map(log => log.entityType))];

  const filteredLogs = allLogs.filter(log => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || [log.entityName, log.userName, log.details, log.entityId].some(v => v.toLowerCase().includes(q));
    return matchesSearch &&
      (actionFilter === 'all' || log.action === actionFilter) &&
      (entityFilter === 'all' || log.entityType === entityFilter) &&
      (sourceFilter === 'all' || log.source === sourceFilter) &&
      (!fromDate || log.timestamp.slice(0, 10) >= fromDate) &&
      (!toDate || log.timestamp.slice(0, 10) <= toDate);
  });

  const compliance = [
    { label:'Asset history coverage', value:assetsList.length ? Math.round(assetsList.filter(a => history.some(h => h.assetId === a.id)).length / assetsList.length * 100) : 100, icon:Activity },
    { label:'Asset tags populated', value:assetsList.length ? Math.round(assetsList.filter(a => a.assetTag.trim()).length / assetsList.length * 100) : 100, icon:Package },
    { label:'Serial numbers populated', value:assetsList.length ? Math.round(assetsList.filter(a => a.serialNumber.trim()).length / assetsList.length * 100) : 100, icon:CheckCircle2 },
    { label:'Warranty dates populated', value:assetsList.length ? Math.round(assetsList.filter(a => a.warrantyExpiry.trim()).length / assetsList.length * 100) : 100, icon:ShieldCheck },
  ];
  const complianceScore = Math.round(compliance.reduce((s,c) => s+c.value, 0) / compliance.length);

  const handleExport = () => {
    const escape = (v:string) => `"${v.replaceAll('"','""')}"`;
    const csv = [
      ['Timestamp','Action','Entity Type','Entity ID','Entity Name','User','Source','Details'].map(escape).join(','),
      ...filteredLogs.map(log => [log.timestamp,log.action,log.entityType,log.entityId,log.entityName,log.userName,log.source || 'system',log.details].map(escape).join(','))
    ].join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='assetflow-audit-compliance.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const getEntityIcon = (entityType:string) => {
    switch(entityType) {
      case 'Asset': return Package;
      case 'User': return User;
      case 'Location': return MapPin;
      case 'License': return Key;
      case 'Vendor': return Truck;
      default: return FileText;
    }
  };

  const getActionBadge = (action:string) => {
    if (action.includes('Deleted') || action.includes('Retired') || action.includes('Disposed') || action.includes('Lost')) return 'bg-destructive/10 text-destructive border-destructive/20';
    if (action.includes('Created') || action.includes('Received') || action.includes('Completed')) return 'bg-chart-2/10 text-chart-2 border-chart-2/20';
    if (action.includes('Assigned') || action.includes('Transferred')) return 'bg-primary/10 text-primary border-primary/20';
    return 'bg-muted text-muted-foreground border-muted';
  };

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div><h1 className="text-2xl font-bold">Audit & Compliance</h1><p className="text-muted-foreground">Review system activity, asset lifecycle changes and data-quality checks.</p></div>
      <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 mr-2"/>Export Logs</Button>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card><CardContent className="py-4"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5"/><div><p className="text-2xl font-bold">{complianceScore}%</p><p className="text-sm text-muted-foreground">Compliance score</p></div></div></CardContent></Card>
      <Card><CardContent className="py-4"><div className="flex items-center gap-3"><FileText className="h-5 w-5"/><div><p className="text-2xl font-bold">{allLogs.length}</p><p className="text-sm text-muted-foreground">Total audit events</p></div></div></CardContent></Card>
      <Card><CardContent className="py-4"><div className="flex items-center gap-3"><Activity className="h-5 w-5"/><div><p className="text-2xl font-bold">{lifecycleLogs.length}</p><p className="text-sm text-muted-foreground">Lifecycle events</p></div></div></CardContent></Card>
      <Card><CardContent className="py-4"><div className="flex items-center gap-3">{complianceScore >= 90 ? <CheckCircle2 className="h-5 w-5"/> : <AlertTriangle className="h-5 w-5"/>}<div><p className="text-2xl font-bold">{compliance.filter(c=>c.value<100).length}</p><p className="text-sm text-muted-foreground">Checks needing attention</p></div></div></CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>Compliance Checks</CardTitle></CardHeader><CardContent><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{compliance.map(c=>{const Icon=c.icon;return <div key={c.label} className="border rounded-lg p-4"><div className="flex items-center gap-2"><Icon className="h-4 w-4"/><span className="text-sm font-medium">{c.label}</span></div><div className="mt-3 flex items-end justify-between"><span className="text-2xl font-bold">{c.value}%</span><Badge variant={c.value===100?'outline':'destructive'}>{c.value===100?'Pass':'Review'}</Badge></div></div>})}</div></CardContent></Card>

    <Card><CardContent className="py-4"><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3"><div className="relative lg:col-span-2"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/><Input placeholder="Search entity, user, ID or details..." className="pl-9" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/></div><select value={actionFilter} onChange={e=>setActionFilter(e.target.value)} className="px-3 py-2 border border-input rounded-md bg-background text-sm"><option value="all">All Actions</option>{actions.map(a=><option key={a}>{a}</option>)}</select><select value={entityFilter} onChange={e=>setEntityFilter(e.target.value)} className="px-3 py-2 border border-input rounded-md bg-background text-sm"><option value="all">All Entities</option>{entityTypes.map(e=><option key={e}>{e}</option>)}</select><select value={sourceFilter} onChange={e=>setSourceFilter(e.target.value as typeof sourceFilter)} className="px-3 py-2 border border-input rounded-md bg-background text-sm"><option value="all">All Sources</option><option value="system">System</option><option value="lifecycle">Lifecycle</option><option value="assets">Assets</option></select><Input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} title="From date"/><Input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} title="To date"/></div></CardContent></Card>

    <Card><CardHeader><CardTitle>Audit Event Timeline</CardTitle><p className="text-sm text-muted-foreground">{filteredLogs.length} events shown</p></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Timestamp</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>User</TableHead><TableHead>Source</TableHead><TableHead>Details</TableHead></TableRow></TableHeader><TableBody>{filteredLogs.length===0?<TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No audit logs found</TableCell></TableRow>:filteredLogs.slice(0,200).map(log=>{const Icon=getEntityIcon(log.entityType);return <TableRow key={log.id}><TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDateTime(log.timestamp)}</TableCell><TableCell><Badge variant="outline" className={getActionBadge(log.action)}>{log.action}</Badge></TableCell><TableCell><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground"/><div><p className="font-medium text-sm">{log.entityName}</p><p className="text-xs text-muted-foreground">{log.entityType} • {log.entityId}</p></div></div></TableCell><TableCell className="text-sm">{log.userName}</TableCell><TableCell><Badge variant="outline">{log.source || 'system'}</Badge></TableCell><TableCell className="text-sm text-muted-foreground max-w-md">{log.details || '—'}</TableCell></TableRow>})}</TableBody></Table></CardContent></Card>
  </div>;
}
