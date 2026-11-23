import { isEmployee } from '@/lib/people';
import { useMemo, useState } from 'react';
import { masterLabel } from '@/lib/masterLabel';
import { confirmDialog } from '@/components/ConfirmHost';
import {
  CalendarDays,
  Download,
  Edit,
  Eye,
  Headphones,
  Plus,
  Search,
  Trash2,
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  formatDate,
  formatTitle,
  type Asset,
  type Location,
  type User,
  type ItCallCategory,
  type ItCallLog,
  type ItCallPriority,
  type ItCallStatus
} from '@/data/models';
import { exportExcelReport } from '@/lib/reportExport';
import { slaFor, type SlaState } from '@/lib/sla';
import { useCollection } from '@/lib/db';
import { DEFAULT_SYSTEM_POLICY, type MasterDataOption, type SystemPolicy } from '@/data/masterData';

const statuses: Array<ItCallStatus | 'all'> = ['all', 'open', 'in-progress', 'resolved', 'closed'];

interface CallLogsPageProps {
  usersList: User[];
  departmentsList: string[];
  assetsList: Asset[];
  callLogs: ItCallLog[];
  onCallLogsChange: (callLogs: ItCallLog[]) => void;
  currentUser: User;
}

const SLA_CLASS: Record<SlaState, string> = {
  none: '',
  'on-track': 'border-chart-2/30 bg-chart-2/10 text-chart-2',
  'due-soon': 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  breached: 'border-destructive/40 bg-destructive/10 text-destructive',
  met: 'border-chart-2/30 bg-chart-2/10 text-chart-2',
  missed: 'border-destructive/40 bg-destructive/10 text-destructive',
};

export function CallLogsPage({ usersList, departmentsList, assetsList, callLogs, onCallLogsChange, currentUser }: CallLogsPageProps) {
  const [sitesList]=useCollection<Location>('locations');
  const [priorityRecords]=useCollection<MasterDataOption>('call-priorities');
  const [supportTeams]=useCollection<MasterDataOption>('support-teams');
  const [policies]=useCollection<SystemPolicy>('system-policies');
  const policy=policies[0]||DEFAULT_SYSTEM_POLICY;
  const priorities: Array<ItCallPriority|'all'>=['all',...priorityRecords.filter(option=>option.active).map(option=>option.id)];
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<ItCallStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<ItCallPriority | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCall, setEditingCall] = useState<ItCallLog | null>(null);
  const [viewingCall, setViewingCall] = useState<ItCallLog | null>(null);

  const filteredCallLogs = useMemo(() => {
    return callLogs.filter(call => {
      const search = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === ''
        || call.id.toLowerCase().includes(search)
        || call.callerName.toLowerCase().includes(search)
        || call.department.toLowerCase().includes(search)
        || call.issue.toLowerCase().includes(search)
        || call.employeeNumber?.toLowerCase().includes(search)
        || call.troubleshooting?.toLowerCase().includes(search)
        || call.assetTag?.toLowerCase().includes(search);

      const matchesDate = dateFilter === '' || call.date === dateFilter;
      const matchesStatus = statusFilter === 'all' || call.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || call.priority === priorityFilter;

      return matchesSearch && matchesDate && matchesStatus && matchesPriority;
    });
  }, [callLogs, dateFilter, priorityFilter, searchQuery, statusFilter]);

  const openCount = filteredCallLogs.filter(call => call.status === 'open').length;
  const inProgressCount = filteredCallLogs.filter(call => call.status === 'in-progress').length;
  const resolvedCount = filteredCallLogs.filter(call => call.status === 'resolved' || call.status === 'closed').length;
  const criticalCount = filteredCallLogs.filter(call => call.priority === 'critical').length;

  const handleDelete = async (id: string) => {
    if (await confirmDialog({ title: 'Delete call?', message: 'Delete this call log entry? This cannot be undone.', destructive: true })) {
      onCallLogsChange(callLogs.filter(call => call.id !== id));
    }
  };

  const handleExport = () => {
    exportExcelReport({
      title: 'Daily IT Call Logbook',
      subtitle: dateFilter ? `Filtered date: ${formatDate(dateFilter)}` : 'All available call log entries',
      generatedBy: 'AssetFlow',
      sections: [
        {
          title: 'Summary',
          headers: ['Metric', 'Value'],
          rows: [
            ['Total calls', filteredCallLogs.length],
            ['Open', openCount],
            ['In progress', inProgressCount],
            ['Resolved or closed', resolvedCount],
            ['Critical priority', criticalCount]
          ]
        },
        {
          title: 'Call Log Entries',
          headers: ['Call ID', 'Date', 'Time', 'Employee No.', 'Asset ID', 'Department', 'User Name', 'Problem Description', 'Troubleshooting Step', 'Resolution', 'Status', 'Resolution Date', 'Assigned To', 'Priority', 'Category'],
          rows: filteredCallLogs.map(call => [
            call.id,
            call.date,
            call.time,
            call.employeeNumber || '',
            call.assetTag || '',
            call.department,
            call.callerName,
            call.issue,
            call.troubleshooting || '',
            call.resolution || '',
            formatTitle(call.status),
            call.resolutionDate || call.closedAt || '',
            call.assignedTo,
            formatTitle(call.priority),
            masterLabel('call-categories', call.category)
          ])
        }
      ]
    }, `daily-it-call-logbook-${dateFilter || 'all'}.xls`);
  };

  return (
    <div className="af-stagger space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">IT Call Logbook</h1>
          <p className="text-muted-foreground">Track daily support calls, issues, ownership, and resolutions</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Call
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Calls" value={filteredCallLogs.length} icon={Headphones} />
        <MetricCard label="Open" value={openCount} icon={CalendarDays} />
        <MetricCard label="In Progress" value={inProgressCount} icon={Edit} />
        <MetricCard label="Critical" value={criticalCount} icon={X} />
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px_160px_160px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search caller, department, issue, call ID, or asset tag..."
                className="pl-9"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <Input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ItCallStatus | 'all')}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {statuses.map(status => (
                <option key={status} value={status}>{status === 'all' ? 'All Status' : formatTitle(status)}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as ItCallPriority | 'all')}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {priorities.map(priority => (
                <option key={priority} value={priority}>{priority === 'all' ? 'All Priority' : formatTitle(priority)}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Call</TableHead>
                <TableHead>Caller</TableHead>
                <TableHead>Asset ID</TableHead>
                <TableHead>Problem</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCallLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    No call log entries found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCallLogs.map(call => (
                  <TableRow key={call.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{call.id}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(call.date)} at {call.time}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{call.callerName}</p>
                        <p className="text-xs text-muted-foreground">{call.department}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{call.assetTag || '—'}</TableCell>
                    <TableCell className="max-w-[260px]"><p className="truncate text-sm" title={call.issue}>{call.issue}</p><p className="text-xs text-muted-foreground">{masterLabel('call-categories', call.category)}</p></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getPriorityClass(call.priority, priorityRecords)}>
                        {priorityRecords.find(p => p.id === call.priority)?.name || formatTitle(call.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell>{(() => { const sla = slaFor(call, priorityRecords); return sla.state === 'none' ? <span className="text-muted-foreground">—</span> : <Badge variant="outline" className={SLA_CLASS[sla.state]} title={sla.dueAt ? `Due ${sla.dueAt.toLocaleString()}` : undefined}>{sla.label}</Badge>; })()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{call.assignedTo}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusClass(call.status)}>
                        {formatTitle(call.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => setViewingCall(call)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditingCall(call)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(call.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showCreateModal || !!editingCall} onOpenChange={(open) => {
        if (!open) {
          setShowCreateModal(false);
          setEditingCall(null);
        }
      }}>
        <DialogContent className="max-h-[90vh] sm:max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCall ? 'Edit Call Log' : 'New Call Log'}</DialogTitle>
            <DialogDescription>Record the call details, assignment, and resolution status.</DialogDescription>
          </DialogHeader>
          <CallLogForm
            callLog={editingCall}
            usersList={usersList}
            departmentsList={departmentsList}
            assetsList={assetsList}
            sitesList={sitesList}
            currentUser={currentUser}
            onCancel={() => {
              setShowCreateModal(false);
              setEditingCall(null);
            }}
            onSubmit={(data) => {
              if (editingCall) {
                onCallLogsChange(callLogs.map(call => call.id === editingCall.id ? { ...call, ...data } : call));
              } else {
                onCallLogsChange([
                  {
                    id: `CALL-${String(callLogs.length + 1).padStart(3, '0')}`,
                    ...data
                  },
                  ...callLogs
                ]);
              }
              setShowCreateModal(false);
              setEditingCall(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingCall} onOpenChange={(open) => !open && setViewingCall(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Call Details</DialogTitle>
            <DialogDescription>{viewingCall?.id}</DialogDescription>
          </DialogHeader>
          {viewingCall && <CallLogDetail callLog={viewingCall} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingCall(null)}>Close</Button>
            <Button onClick={() => {
              setEditingCall(viewingCall);
              setViewingCall(null);
            }}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Headphones }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}

function CallLogForm({
  callLog,
  usersList,
  departmentsList,
  assetsList,
  sitesList,
    currentUser,
  onSubmit,
  onCancel
}: {
  callLog: ItCallLog | null;
  usersList: User[];
  departmentsList: string[];
  assetsList: Asset[];
  sitesList: Location[];
  currentUser: User;
  onSubmit: (data: Omit<ItCallLog, 'id'>) => void;
  onCancel: () => void;
}) {
  const [supportTeams]=useCollection<MasterDataOption>('support-teams');
  const [categoryRecords]=useCollection<MasterDataOption>('call-categories');
  const [priorityRecords]=useCollection<MasterDataOption>('call-priorities');
  const [policies]=useCollection<SystemPolicy>('system-policies');
  const policy=policies[0]||DEFAULT_SYSTEM_POLICY;
  const categories=categoryRecords.filter(option=>option.active&&option.name.trim());
  const priorities=priorityRecords.filter(option=>option.active&&option.name.trim());
  const [formData, setFormData] = useState<Omit<ItCallLog, 'id'>>({
    siteId: callLog?.siteId || currentUser.siteId || '',
    date: callLog?.date || new Date().toISOString().split('T')[0],
    time: callLog?.time || new Date().toTimeString().slice(0, 5),
    employeeNumber: callLog?.employeeNumber || '',
    callerName: callLog?.callerName || '',
    department: callLog?.department || '',
    contactNumber: callLog?.contactNumber || '',
    category: callLog?.category || categories[0]?.id || '',
    priority: callLog?.priority || priorities[0]?.id || '',
    issue: callLog?.issue || '',
    troubleshooting: callLog?.troubleshooting || '',
    assetTag: callLog?.assetTag || '',
    assignedTo: callLog?.assignedTo || policy.defaultSupportTeam,
    status: callLog?.status || 'open',
    resolution: callLog?.resolution || '',
    resolutionDate: callLog?.resolutionDate || '',
    closedAt: callLog?.closedAt || ''
  });
  const selectedUserId = usersList.find(user => user.name === formData.callerName)?.id || '';
  const selectedUser = usersList.find(user => user.id === selectedUserId);
  const selectedAsset = assetsList.find(asset => asset.assetTag === formData.assetTag);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({
      ...formData,
      siteId: formData.siteId || selectedAsset?.siteId || selectedUser?.siteId || currentUser.siteId,
      assetTag: formData.assetTag || undefined,
      employeeNumber: formData.employeeNumber || undefined,
      troubleshooting: formData.troubleshooting || undefined,
      resolution: formData.resolution || undefined,
      resolutionDate: formData.resolutionDate || undefined,
      closedAt: formData.closedAt || undefined
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date">
          <Input type="date" required value={formData.date} onChange={(event) => setFormData({ ...formData, date: event.target.value })} />
        </Field>
        <Field label="Time">
          <Input type="time" required value={formData.time} onChange={(event) => setFormData({ ...formData, time: event.target.value })} />
        </Field>
        <Field label="Caller/User">
          <select
            value={selectedUserId}
            onChange={(event) => {
              const selectedUser = usersList.find(user => user.id === event.target.value);
              setFormData({
                ...formData,
                callerName: selectedUser?.name || '',
                department: selectedUser?.department || '',
                contactNumber: selectedUser?.phone || '',
                siteId: selectedUser?.siteId || formData.siteId
              });
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
          >
            <option value="">Select user</option>
            {usersList.filter(user => isEmployee(user) || user.id === selectedUserId).map(user => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.department})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Employee No.">
          <Input value={formData.employeeNumber || ''} onChange={(event) => setFormData({ ...formData, employeeNumber: event.target.value })} placeholder="Employee number" />
        </Field>
        <Field label="Department">
          <select
            value={formData.department}
            onChange={(event) => setFormData({ ...formData, department: event.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
          >
            <option value="">Select department</option>
            {departmentsList.map(department => (
              <option key={department} value={department}>{department}</option>
            ))}
          </select>
        </Field>
        <Field label="Contact Number">
          <Input required value={formData.contactNumber} onChange={(event) => setFormData({ ...formData, contactNumber: event.target.value })} />
        </Field>
        <Field label="Asset ID">
          <select value={formData.assetTag || ''} onChange={(event) => { const asset=assetsList.find(item=>item.assetTag===event.target.value); setFormData({ ...formData, assetTag: event.target.value, siteId: asset?.siteId || formData.siteId }); }} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">No linked asset</option>
            {assetsList.map(asset => <option key={asset.id} value={asset.assetTag}>{asset.assetTag} — {asset.name}</option>)}
          </select>
        </Field>
        <Field label="Call Site">
          <select required value={formData.siteId || ''} onChange={(event) => setFormData({ ...formData, siteId: event.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">Select site</option>
            {sitesList.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
        </Field>
        <Field label="Category">
          <select value={formData.category} onChange={(event) => setFormData({ ...formData, category: event.target.value as ItCallCategory })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {categories.map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select value={formData.priority} onChange={(event) => setFormData({ ...formData, priority: event.target.value as ItCallPriority })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {priorities.map(priority => (
              <option key={priority.id} value={priority.id}>{priority.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Assigned To">
          <select required value={formData.assignedTo} onChange={(event) => setFormData({ ...formData, assignedTo: event.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{supportTeams.filter(option=>option.active&&option.name.trim()).map(option=><option key={option.id} value={option.name}>{option.name}</option>)}</select>
        </Field>
        <Field label="Status">
          <select value={formData.status} onChange={(event) => setFormData({ ...formData, status: event.target.value as ItCallStatus })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {statuses.filter(status => status !== 'all').map(status => (
              <option key={status} value={status}>{formatTitle(status)}</option>
            ))}
          </select>
        </Field>
        <Field label="Issue" className="sm:col-span-2">
          <textarea required value={formData.issue} onChange={(event) => setFormData({ ...formData, issue: event.target.value })} className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>
        <Field label="Troubleshooting Step" className="sm:col-span-2">
          <textarea value={formData.troubleshooting || ''} onChange={(event) => setFormData({ ...formData, troubleshooting: event.target.value })} className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Steps attempted before the final resolution" />
        </Field>
        <Field label="Resolution" className="sm:col-span-2">
          <textarea value={formData.resolution} onChange={(event) => setFormData({ ...formData, resolution: event.target.value })} className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>
        <Field label="Resolution Date">
          <Input type="date" value={formData.resolutionDate || ''} onChange={(event) => setFormData({ ...formData, resolutionDate: event.target.value })} />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{callLog ? 'Update' : 'Create'} Call</Button>
      </DialogFooter>
    </form>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function CallLogDetail({ callLog }: { callLog: ItCallLog }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Detail label="Date" value={`${formatDate(callLog.date)} at ${callLog.time}`} />
      <Detail label="Caller" value={callLog.callerName} />
      <Detail label="Employee No." value={callLog.employeeNumber || '-'} />
      <Detail label="Department" value={callLog.department} />
      <Detail label="Contact" value={callLog.contactNumber} />
      <Detail label="Category" value={formatTitle(callLog.category)} />
      <Detail label="Priority" value={formatTitle(callLog.priority)} />
      <Detail label="Asset Tag" value={callLog.assetTag || '-'} />
      <Detail label="Assigned To" value={callLog.assignedTo} />
      <Detail label="Status" value={formatTitle(callLog.status)} />
      <Detail label="Closed At" value={callLog.closedAt || '-'} />
      <Detail label="Issue" value={callLog.issue} className="sm:col-span-2" />
      <Detail label="Troubleshooting Step" value={callLog.troubleshooting || '-'} className="sm:col-span-2" />
      <Detail label="Resolution" value={callLog.resolution || '-'} className="sm:col-span-2" />
      <Detail label="Resolution Date" value={callLog.resolutionDate ? formatDate(callLog.resolutionDate) : '-'} />
    </div>
  );
}

function Detail({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

const TONE_CLASS: Record<string, string> = {
  gray: 'bg-muted text-muted-foreground border-border',
  green: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  blue: 'bg-primary/10 text-primary border-primary/20',
  amber: 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400',
  orange: 'bg-chart-5/10 text-chart-5 border-chart-5/20',
  red: 'bg-destructive/10 text-destructive border-destructive/20',
};
const LEGACY_TONE: Record<string, string> = { low: 'green', medium: 'blue', high: 'orange', critical: 'red' };

function getPriorityClass(priority: ItCallPriority, records: MasterDataOption[] = []) {
  const tone = records.find(p => p.id === priority)?.tone || LEGACY_TONE[priority] || 'gray';
  return TONE_CLASS[tone] || TONE_CLASS.gray;
}

function getStatusClass(status: ItCallStatus) {
  const classes = {
    open: 'bg-destructive/10 text-destructive border-destructive/20',
    'in-progress': 'bg-chart-5/10 text-chart-5 border-chart-5/20',
    resolved: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
    closed: 'bg-muted text-muted-foreground border-muted'
  };
  return classes[status];
}
