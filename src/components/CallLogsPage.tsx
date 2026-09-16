import { useMemo, useState } from 'react';
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
  itCallLogs as initialCallLogs,
  formatDate,
  formatTitle,
  type User,
  type ItCallCategory,
  type ItCallLog,
  type ItCallPriority,
  type ItCallStatus
} from '@/data/sampleData';
import { exportExcelReport } from '@/lib/reportExport';

const statuses: Array<ItCallStatus | 'all'> = ['all', 'open', 'in-progress', 'resolved', 'closed'];
const priorities: Array<ItCallPriority | 'all'> = ['all', 'low', 'medium', 'high', 'critical'];
const categories: Array<ItCallCategory | 'all'> = ['all', 'hardware', 'software', 'network', 'access', 'asset-request', 'other'];

interface CallLogsPageProps {
  usersList: User[];
  departmentsList: string[];
}

export function CallLogsPage({ usersList, departmentsList }: CallLogsPageProps) {
  const [callLogs, setCallLogs] = useState<ItCallLog[]>(initialCallLogs);
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

  const handleDelete = (id: string) => {
    if (confirm('Delete this call log entry?')) {
      setCallLogs(callLogs.filter(call => call.id !== id));
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
          headers: ['ID', 'Date', 'Time', 'Caller', 'Department', 'Contact', 'Category', 'Priority', 'Asset Tag', 'Assigned To', 'Status', 'Issue', 'Resolution'],
          rows: filteredCallLogs.map(call => [
            call.id,
            call.date,
            call.time,
            call.callerName,
            call.department,
            call.contactNumber,
            formatTitle(call.category),
            formatTitle(call.priority),
            call.assetTag || '',
            call.assignedTo,
            formatTitle(call.status),
            call.issue,
            call.resolution || ''
          ])
        }
      ]
    }, `daily-it-call-logbook-${dateFilter || 'all'}.xls`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">IT Call Logbook</h1>
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
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCallLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
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
                    <TableCell>{formatTitle(call.category)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getPriorityClass(call.priority)}>
                        {formatTitle(call.priority)}
                      </Badge>
                    </TableCell>
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
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCall ? 'Edit Call Log' : 'New Call Log'}</DialogTitle>
            <DialogDescription>Record the call details, assignment, and resolution status.</DialogDescription>
          </DialogHeader>
          <CallLogForm
            callLog={editingCall}
            usersList={usersList}
            departmentsList={departmentsList}
            onCancel={() => {
              setShowCreateModal(false);
              setEditingCall(null);
            }}
            onSubmit={(data) => {
              if (editingCall) {
                setCallLogs(callLogs.map(call => call.id === editingCall.id ? { ...call, ...data } : call));
              } else {
                setCallLogs([
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
        <DialogContent className="max-w-2xl">
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
  onSubmit,
  onCancel
}: {
  callLog: ItCallLog | null;
  usersList: User[];
  departmentsList: string[];
  onSubmit: (data: Omit<ItCallLog, 'id'>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Omit<ItCallLog, 'id'>>({
    date: callLog?.date || new Date().toISOString().split('T')[0],
    time: callLog?.time || new Date().toTimeString().slice(0, 5),
    callerName: callLog?.callerName || '',
    department: callLog?.department || '',
    contactNumber: callLog?.contactNumber || '',
    category: callLog?.category || 'hardware',
    priority: callLog?.priority || 'medium',
    issue: callLog?.issue || '',
    assetTag: callLog?.assetTag || '',
    assignedTo: callLog?.assignedTo || '',
    status: callLog?.status || 'open',
    resolution: callLog?.resolution || '',
    closedAt: callLog?.closedAt || ''
  });
  const selectedUserId = usersList.find(user => user.name === formData.callerName)?.id || '';

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({
      ...formData,
      assetTag: formData.assetTag || undefined,
      resolution: formData.resolution || undefined,
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
                contactNumber: selectedUser?.phone || ''
              });
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
          >
            <option value="">Select user</option>
            {usersList.map(user => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.department})
              </option>
            ))}
          </select>
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
        <Field label="Asset Tag">
          <Input value={formData.assetTag} onChange={(event) => setFormData({ ...formData, assetTag: event.target.value })} />
        </Field>
        <Field label="Category">
          <select value={formData.category} onChange={(event) => setFormData({ ...formData, category: event.target.value as ItCallCategory })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {categories.filter(category => category !== 'all').map(category => (
              <option key={category} value={category}>{formatTitle(category)}</option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select value={formData.priority} onChange={(event) => setFormData({ ...formData, priority: event.target.value as ItCallPriority })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {priorities.filter(priority => priority !== 'all').map(priority => (
              <option key={priority} value={priority}>{formatTitle(priority)}</option>
            ))}
          </select>
        </Field>
        <Field label="Assigned To">
          <Input required value={formData.assignedTo} onChange={(event) => setFormData({ ...formData, assignedTo: event.target.value })} />
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
        <Field label="Resolution" className="sm:col-span-2">
          <textarea value={formData.resolution} onChange={(event) => setFormData({ ...formData, resolution: event.target.value })} className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
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
      <Detail label="Department" value={callLog.department} />
      <Detail label="Contact" value={callLog.contactNumber} />
      <Detail label="Category" value={formatTitle(callLog.category)} />
      <Detail label="Priority" value={formatTitle(callLog.priority)} />
      <Detail label="Asset Tag" value={callLog.assetTag || '-'} />
      <Detail label="Assigned To" value={callLog.assignedTo} />
      <Detail label="Status" value={formatTitle(callLog.status)} />
      <Detail label="Closed At" value={callLog.closedAt || '-'} />
      <Detail label="Issue" value={callLog.issue} className="sm:col-span-2" />
      <Detail label="Resolution" value={callLog.resolution || '-'} className="sm:col-span-2" />
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

function getPriorityClass(priority: ItCallPriority) {
  const classes = {
    low: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
    medium: 'bg-primary/10 text-primary border-primary/20',
    high: 'bg-chart-5/10 text-chart-5 border-chart-5/20',
    critical: 'bg-destructive/10 text-destructive border-destructive/20'
  };
  return classes[priority];
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
