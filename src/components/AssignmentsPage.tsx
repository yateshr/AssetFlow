import { useState } from 'react';
import { Plus, Search, ArrowRightLeft, CheckCircle, XCircle, Clock, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  type Asset,
  type Assignment, 
  type AssignmentStatus,
  type AssetHistoryEvent,
  type User,
  type Location,
  formatDate 
} from '@/data/sampleData';

interface AssignmentsPageProps {
  assignmentsList: Assignment[];
  onAssignmentsChange: (assignments: Assignment[]) => void;
  assetsList: Asset[];
  onAssetsChange: (assets: Asset[]) => void;
  usersList: User[];
  history: AssetHistoryEvent[];
  onHistoryChange: (events: AssetHistoryEvent[]) => void;
  currentUser: User;
}

export function AssignmentsPage({
  assignmentsList,
  onAssignmentsChange,
  assetsList,
  onAssetsChange,
  usersList,
  history,
  onHistoryChange,
  currentUser,
}: AssignmentsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | 'all'>('all');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState<Assignment | null>(null);

  const filteredAssignments = assignmentsList.filter(assignment => {
    const matchesSearch = searchQuery === '' || 
      assignment.assetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assignment.userName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || assignment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: AssignmentStatus) => {
    const variants = {
      active: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
      returned: 'bg-muted text-muted-foreground border-muted',
      pending: 'bg-chart-5/10 text-chart-5 border-chart-5/20'
    };
    return variants[status];
  };

  const getStatusIcon = (status: AssignmentStatus) => {
    switch (status) {
      case 'active': return CheckCircle;
      case 'returned': return XCircle;
      case 'pending': return Clock;
    }
  };

  const handleReturn = (
    assignment: Assignment,
    condition: 'good' | 'fair' | 'damaged' | 'missing',
    notes: string
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const nextStatus: Asset['status'] =
      condition === 'damaged' ? 'maintenance' :
      condition === 'missing' ? 'lost' :
      'available';

    const conditionLabel = condition === 'good' ? 'Good' :
      condition === 'fair' ? 'Fair' :
      condition === 'damaged' ? 'Damaged' : 'Missing';

    onAssignmentsChange(assignmentsList.map(a =>
      a.id === assignment.id
        ? {
            ...a,
            status: 'returned' as AssignmentStatus,
            returnDate: today,
            notes: [
              a.notes,
              `Checked in ${today}. Return condition: ${conditionLabel}.`,
              notes.trim() ? `Return notes: ${notes.trim()}` : ''
            ].filter(Boolean).join(' ')
          }
        : a
    ));

    onAssetsChange(assetsList.map(asset =>
      asset.id === assignment.assetId
        ? { ...asset, status: nextStatus, assignedTo: undefined }
        : asset
    ));

    onHistoryChange([
      ...history,
      {
        id: `H-${Date.now()}-RETURN`,
        assetId: assignment.assetId,
        timestamp: new Date().toISOString(),
        action: condition === 'damaged' ? 'Under Repair' : condition === 'missing' ? 'Lost' : 'Returned',
        performedBy: currentUser.id,
        from: assignment.userName,
        to: 'IT Asset Manager',
        userId: assignment.userId,
        reason: 'Asset checked in',
        notes: [
          `Return condition: ${conditionLabel}.`,
          notes.trim() ? notes.trim() : ''
        ].filter(Boolean).join(' ')
      }
    ]);

    setShowReturnModal(null);
  };

  const availableAssets = assetsList.filter(a => a.status === 'available');
  const activeUsers = usersList.filter(user => user.status === 'active');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assignments</h1>
          <p className="text-muted-foreground">Track asset check-out and check-in to employees</p>
        </div>
        <Button onClick={() => setShowAssignModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Assign Asset
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-12 w-12 rounded-lg bg-chart-2/10 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {assignmentsList.filter(a => a.status === 'active').length}
              </p>
              <p className="text-sm text-muted-foreground">Active Assignments</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
              <XCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {assignmentsList.filter(a => a.status === 'returned').length}
              </p>
              <p className="text-sm text-muted-foreground">Returned</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-12 w-12 rounded-lg bg-chart-5/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-chart-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {assignmentsList.filter(a => a.status === 'pending').length}
              </p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by asset or user..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AssignmentStatus | 'all')}
              className="px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="returned">Returned</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Assignments Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Assigned Date</TableHead>
                <TableHead>Return Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No assignments found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAssignments.map((assignment) => {
                  const StatusIcon = getStatusIcon(assignment.status);
                  return (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <p className="font-medium text-foreground">{assignment.assetName}</p>
                        <p className="text-xs text-muted-foreground">{assignment.assetId}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">{assignment.userName}</p>
                        <p className="text-xs text-muted-foreground">{assignment.userId}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(assignment.assignedDate)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {assignment.returnDate ? formatDate(assignment.returnDate) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusBadge(assignment.status)}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {assignment.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {assignment.status === 'active' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setShowReturnModal(assignment)}
                          >
                            <ArrowRightLeft className="h-4 w-4 mr-1" />
                            Return
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assign Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Asset</DialogTitle>
            <DialogDescription>Check out an available asset to an employee</DialogDescription>
          </DialogHeader>
          <AssignForm 
            availableAssets={availableAssets}
            users={activeUsers}
            onSubmit={(data) => {
              const newAssignment: Assignment = {
                id: `ASG-${String(assignmentsList.length + 1).padStart(3, '0')}`,
                ...data,
                status: 'active'
              };
              onAssignmentsChange([...assignmentsList, newAssignment]);
              onAssetsChange(assetsList.map(asset =>
                asset.id === data.assetId
                  ? { ...asset, status: 'assigned', assignedTo: data.userId }
                  : asset
              ));
              onHistoryChange([
                ...history,
                {
                  id: `H-${Date.now()}-CHECKOUT`,
                  assetId: data.assetId,
                  timestamp: new Date().toISOString(),
                  action: 'Assigned',
                  performedBy: currentUser.id,
                  from: 'IT Asset Manager',
                  to: data.userName,
                  userId: data.userId,
                  reason: 'Asset checked out',
                  notes: data.notes
                }
              ]);
              setShowAssignModal(false);
            }}
            onCancel={() => setShowAssignModal(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Return Modal */}
      <Dialog open={!!showReturnModal} onOpenChange={(open) => !open && setShowReturnModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Asset</DialogTitle>
            <DialogDescription>
              Record the asset check-in and capture its return condition.
            </DialogDescription>
          </DialogHeader>
          {showReturnModal && (
            <ReturnForm
              assignment={showReturnModal}
              onSubmit={(condition, notes) => handleReturn(showReturnModal, condition, notes)}
              onCancel={() => setShowReturnModal(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


function ReturnForm({
  assignment,
  onSubmit,
  onCancel
}: {
  assignment: Assignment;
  onSubmit: (condition: 'good' | 'fair' | 'damaged' | 'missing', notes: string) => void;
  onCancel: () => void;
}) {
  const [condition, setCondition] = useState<'good' | 'fair' | 'damaged' | 'missing'>('good');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(condition, notes);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border bg-muted/20 p-4 space-y-1">
        <p className="text-sm"><span className="font-medium">Asset:</span> {assignment.assetName}</p>
        <p className="text-sm"><span className="font-medium">Employee:</span> {assignment.userName}</p>
        <p className="text-sm"><span className="font-medium">Checked out:</span> {formatDate(assignment.assignedDate)}</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Condition at Check-in</label>
        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value as 'good' | 'fair' | 'damaged' | 'missing')}
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
        >
          <option value="good">Good — return to available inventory</option>
          <option value="fair">Fair — return to available inventory</option>
          <option value="damaged">Damaged — send to Under Repair</option>
          <option value="missing">Missing — mark asset as Lost</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Return Notes</label>
        <textarea
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm min-h-[90px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Condition details, missing accessories, damage, remarks..."
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit"><PackageCheck className="h-4 w-4 mr-2" />Check In Asset</Button>
      </DialogFooter>
    </form>
  );
}

function AssignForm({ 
  availableAssets, 
  users, 
  onSubmit, 
  onCancel 
}: { 
  availableAssets: Asset[];
  users: User[];
  onSubmit: (data: Omit<Assignment, 'id' | 'status'>) => void;
  onCancel: () => void;
}) {
  const [selectedAsset, setSelectedAsset] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [condition, setCondition] = useState<'new' | 'good' | 'fair'>('good');
  const [notes, setNotes] = useState('');
  const [accessories, setAccessories] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const asset = availableAssets.find(a => a.id === selectedAsset);
    const user = users.find(u => u.id === selectedUser);
    
    if (asset && user) {
      onSubmit({
        assetId: asset.id,
        assetName: asset.name,
        userId: user.id,
        userName: user.name,
        assignedDate: new Date().toISOString().split('T')[0],
        notes: [
          `Checked out in ${condition === 'new' ? 'New' : condition === 'good' ? 'Good' : 'Fair'} condition.`,
          accessories.trim() ? `Accessories issued: ${accessories.trim()}.` : '',
          notes.trim() ? `Notes: ${notes.trim()}` : ''
        ].filter(Boolean).join(' ')
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Select Asset</label>
        <select
          value={selectedAsset}
          onChange={(e) => setSelectedAsset(e.target.value)}
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
          required
        >
          <option value="">Choose an asset...</option>
          {availableAssets.map(asset => (
            <option key={asset.id} value={asset.id}>
              {asset.name} ({asset.assetTag})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Assign To</label>
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
          required
        >
          <option value="">Choose a user...</option>
          {users.map(user => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.department})
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Condition at Check-out</label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as 'new' | 'good' | 'fair')}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
          >
            <option value="new">New</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Accessories Issued</label>
          <Input
            value={accessories}
            onChange={(e) => setAccessories(e.target.value)}
            placeholder="Charger, bag, mouse..."
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Notes (optional)</label>
        <textarea
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm min-h-[80px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes about this assignment..."
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Check Out Asset</Button>
      </DialogFooter>
    </form>
  );
}
