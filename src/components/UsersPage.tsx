import { useState } from 'react';
import { Plus, Search, Edit, Trash2, PackageCheck, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type Location, type User, type UserRole, type UserStatus, type Asset, type Assignment, type AssetHistoryEvent, formatDate } from '@/data/sampleData';
import { IT_ASSET_MANAGER } from './assetLifecycle';

interface UsersPageProps {
  usersList: User[];
  onUsersChange: (users: User[]) => void;
  currentUserId: string;
  departmentsList: string[];
  locationsList: Location[];
  assetsList: Asset[];
  assignmentsList: Assignment[];
  onAssetsChange: (assets: Asset[]) => void;
  onAssignmentsChange: (assignments: Assignment[]) => void;
  history: AssetHistoryEvent[];
  onHistoryChange: (events: AssetHistoryEvent[]) => void;
  currentUser: User;
}

export function UsersPage({
  usersList, onUsersChange, currentUserId, departmentsList, locationsList,
  assetsList, assignmentsList, onAssetsChange, onAssignmentsChange,
  history, onHistoryChange, currentUser
}: UsersPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [departingUser, setDepartingUser] = useState<User | null>(null);
  const [departureCondition, setDepartureCondition] = useState<'good' | 'fair' | 'damaged'>('good');
  const [departureNotes, setDepartureNotes] = useState('');
  const [viewingAssetsUser, setViewingAssetsUser] = useState<User | null>(null);

  // Size the dialog for the table, growing it only when an asset name/model
  // needs more room. The table below is a real HTML table so the header and
  // every asset row always share the exact same column boundaries.
  const viewingAssignedAssets = viewingAssetsUser
    ? assetsList.filter(asset => asset.assignedTo === viewingAssetsUser.id)
    : [];

  const longestAssetText = viewingAssignedAssets.reduce((longest, asset) => {
    return Math.max(
      longest,
      asset.name.length,
      `${asset.manufacturer} ${asset.model}`.length
    );
  }, 0);

  const assignedAssetsDialogWidth = Math.min(
    1500,
    Math.max(960, 960 + Math.max(0, longestAssetText - 32) * 7)
  );

  const filteredUsers = usersList.filter(user => {
    const userLocation = locationsList.find(location => location.id === user.locationId);
    const matchesSearch = searchQuery === '' || 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Boolean(userLocation?.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: UserRole) => {
    const variants = {
      admin: 'bg-destructive/10 text-destructive border-destructive/20',
      manager: 'bg-chart-5/10 text-chart-5 border-chart-5/20',
      user: 'bg-muted text-muted-foreground border-muted'
    };
    return variants[role];
  };

  const handleDelete = (id: string) => {
    if (id === currentUserId) {
      alert('You cannot delete the account you are currently signed in with.');
      return;
    }
    if (confirm('Are you sure you want to delete this user?')) {
      onUsersChange(usersList.filter(u => u.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-muted-foreground">Manage employees and their access</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by name, email, or department..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
              className="px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="user">User</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Office Location</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Join Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => {
                  const location = locationsList.find(item => item.id === user.locationId);

                  return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.phone}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.department}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{location?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getRoleBadge(user.role)}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        user.status === 'left'
                          ? 'bg-muted text-muted-foreground border-muted'
                          : user.status === 'inactive'
                            ? 'bg-chart-5/10 text-chart-5 border-chart-5/20'
                            : 'bg-chart-2/10 text-chart-2 border-chart-2/20'
                      }>
                        {user.status === 'left' ? 'Left Company' : user.status === 'inactive' ? 'Inactive' : 'Active'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(user.joinDate)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={`View assets assigned to ${user.name}`}
                          onClick={() => setViewingAssetsUser(user)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" title="Edit User" onClick={() => setEditingUser(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {user.status === 'active' && (
                          <Button variant="ghost" size="icon-sm" title="Mark Left Company" onClick={() => {
                            setDepartureCondition('good');
                            setDepartureNotes('');
                            setDepartingUser(user);
                          }}>
                            <PackageCheck className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(user.id)} disabled={user.id === currentUserId}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assigned assets */}
      <Dialog open={!!viewingAssetsUser} onOpenChange={(open) => !open && setViewingAssetsUser(null)}>
        <DialogContent
          className="max-h-[92vh] overflow-y-auto overflow-x-hidden p-5 sm:p-6 lg:p-7"
          style={{
            width: `min(${assignedAssetsDialogWidth}px, calc(100vw - 32px))`,
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-lg sm:text-xl">
              Assets Assigned to {viewingAssetsUser?.name}
            </DialogTitle>
            <DialogDescription className="text-sm leading-5">
              Currently assigned assets for this employee. Returned, retired, disposed, or lost assets are not shown here.
            </DialogDescription>
          </DialogHeader>

          {viewingAssetsUser && (() => {
            const assignedAssets = assetsList.filter(
              asset => asset.assignedTo === viewingAssetsUser.id
            );

            const getActiveAssignment = (assetId: string) =>
              assignmentsList
                .filter(a =>
                  a.assetId === assetId &&
                  a.userId === viewingAssetsUser.id &&
                  a.status === 'active'
                )
                .sort((a, b) => b.assignedDate.localeCompare(a.assignedDate))[0];

            const getStatusLabel = (status: AssetStatus) =>
              status === 'maintenance' ? 'Under Repair' :
              status === 'assigned' ? 'Assigned' :
              status === 'disposed' ? 'Disposed' :
              status === 'retired' ? 'Retired' :
              status === 'lost' ? 'Lost' :
              status;

            const getStatusClass = (status: AssetStatus) =>
              status === 'maintenance'
                ? 'bg-chart-5/10 text-chart-5 border-chart-5/20'
                : status === 'assigned'
                  ? 'bg-chart-2/10 text-chart-2 border-chart-2/20'
                  : 'bg-muted text-muted-foreground border-muted';

            return (
              <div className="space-y-4">
                {/* Compact summary */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  {[
                    { label: 'Assigned Assets', value: assignedAssets.length },
                    { label: 'Laptops', value: assignedAssets.filter(asset => asset.type === 'laptop').length },
                    { label: 'Phones', value: assignedAssets.filter(asset => asset.type === 'phone').length },
                    { label: 'Other', value: assignedAssets.filter(asset => asset.type !== 'laptop' && asset.type !== 'phone').length },
                  ].map(stat => (
                    <div
                      key={stat.label}
                      className="rounded-lg border bg-card px-3 py-2.5 shadow-sm"
                    >
                      <p className="text-xs font-medium text-muted-foreground leading-4">
                        {stat.label}
                      </p>
                      <p className="mt-0.5 text-xl font-semibold leading-6">
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>

                {assignedAssets.length === 0 ? (
                  <div className="border rounded-lg p-8 text-center">
                    <PackageCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="font-medium">No assets currently assigned</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      This employee currently has no assets assigned to them.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Desktop table.
                        This is a real HTML table so every row uses exactly the same
                        column structure as the header. No per-row CSS grid sizing. */}
                    <div className="hidden xl:block w-full rounded-lg border overflow-hidden">
                      <table
                        className="w-full border-collapse"
                        style={{ tableLayout: 'auto' }}
                      >
                        <colgroup>
                          <col style={{ minWidth: 300 }} />
                          <col style={{ width: 110 }} />
                          <col style={{ width: 125 }} />
                          <col style={{ width: 175 }} />
                          <col style={{ width: 145 }} />
                          <col style={{ width: 105 }} />
                        </colgroup>

                        <thead>
                          <tr className="bg-muted/40 border-b text-xs font-medium text-muted-foreground">
                            <th className="px-4 py-2.5 text-left font-medium whitespace-nowrap">Asset</th>
                            <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">Type</th>
                            <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">Asset Tag</th>
                            <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">Serial Number</th>
                            <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">Assigned Since</th>
                            <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">Status</th>
                          </tr>
                        </thead>

                        <tbody>
                          {assignedAssets.map(asset => {
                            const activeAssignment = getActiveAssignment(asset.id);

                            return (
                              <tr key={asset.id} className="border-b last:border-b-0">
                                <td className="px-4 py-3 align-middle">
                                  <div className="min-w-0">
                                    <p
                                      className="font-medium leading-5 whitespace-nowrap"
                                      title={asset.name}
                                    >
                                      {asset.name}
                                    </p>
                                    <p
                                      className="text-xs text-muted-foreground leading-4 whitespace-nowrap"
                                      title={`${asset.manufacturer} ${asset.model}`}
                                    >
                                      {asset.manufacturer} {asset.model}
                                    </p>
                                  </div>
                                </td>

                                <td className="px-3 py-3 text-sm capitalize whitespace-nowrap align-middle">
                                  {asset.type}
                                </td>

                                <td className="px-3 py-3 font-mono text-xs whitespace-nowrap align-middle">
                                  {asset.assetTag}
                                </td>

                                <td className="px-3 py-3 font-mono text-xs whitespace-nowrap align-middle">
                                  {asset.serialNumber}
                                </td>

                                <td className="px-3 py-3 text-sm whitespace-nowrap align-middle">
                                  {activeAssignment ? formatDate(activeAssignment.assignedDate) : '—'}
                                </td>

                                <td className="px-3 py-3 align-middle whitespace-nowrap">
                                  <Badge variant="outline" className={getStatusClass(asset.status)}>
                                    {getStatusLabel(asset.status)}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Smaller screens: cards instead of squeezing table columns. */}
                    <div className="xl:hidden space-y-3">
                      {assignedAssets.map(asset => {
                        const activeAssignment = getActiveAssignment(asset.id);

                        return (
                          <div key={asset.id} className="rounded-lg border p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium leading-5 break-words">{asset.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-4 break-words">
                                  {asset.manufacturer} {asset.model}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className={`shrink-0 ${getStatusClass(asset.status)}`}
                              >
                                {getStatusLabel(asset.status)}
                              </Badge>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
                              <div className="min-w-0">
                                <p className="text-[11px] text-muted-foreground">Type</p>
                                <p className="capitalize break-words">{asset.type}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] text-muted-foreground">Asset Tag</p>
                                <p className="font-mono text-xs break-all">{asset.assetTag}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] text-muted-foreground">Serial Number</p>
                                <p className="font-mono text-xs break-all">{asset.serialNumber}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] text-muted-foreground">Assigned Since</p>
                                <p>{activeAssignment ? formatDate(activeAssignment.assignedDate) : '—'}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                <p className="text-xs text-muted-foreground leading-4">
                  Tip: Use the asset's History action from the Assets page to see its complete lifecycle, including previous users, returns, repairs, and IT Asset Manager custody.
                </p>
              </div>
            );
          })()}

          <DialogFooter className="pt-1">
            <Button variant="outline" onClick={() => setViewingAssetsUser(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee departure confirmation */}
      <Dialog open={!!departingUser} onOpenChange={(open) => !open && setDepartingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Employee as Left Company</DialogTitle>
            <DialogDescription>
              This will automatically return all assigned assets to IT Asset Manager.
            </DialogDescription>
          </DialogHeader>
          {departingUser && (() => {
            const assigned = assetsList.filter(a => a.assignedTo === departingUser.id);
            return (
              <div className="space-y-4 py-2">
                <p className="text-sm">
                  <span className="font-medium">{departingUser.name}</span> currently has {assigned.length} assigned asset{assigned.length === 1 ? '' : 's'}.
                </p>
                {assigned.length > 0 ? (
                  <div className="border rounded-md divide-y">
                    {assigned.map(asset => (
                      <div key={asset.id} className="p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{asset.name}</p>
                          <p className="text-xs text-muted-foreground">{asset.assetTag}</p>
                        </div>
                        <Badge variant="outline">{IT_ASSET_MANAGER}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No assets are currently assigned to this employee.</p>
                )}

                {assigned.length > 0 && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Default return condition</label>
                      <select
                        value={departureCondition}
                        onChange={(e) => setDepartureCondition(e.target.value as 'good' | 'fair' | 'damaged')}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                      >
                        <option value="good">Good — return to available inventory</option>
                        <option value="fair">Fair — return to available inventory</option>
                        <option value="damaged">Damaged — send to Under Repair</option>
                      </select>
                      <p className="text-xs text-muted-foreground">
                        This condition is applied to all assets returned during this employee exit clearance.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Exit clearance notes</label>
                      <textarea
                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm min-h-[80px]"
                        value={departureNotes}
                        onChange={(e) => setDepartureNotes(e.target.value)}
                        placeholder="Record any handover, damage, or missing accessory details..."
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepartingUser(null)}>Cancel</Button>
            <Button onClick={() => {
              if (!departingUser) return;
              const today = new Date().toISOString().split('T')[0];
              const assigned = assetsList.filter(a => a.assignedTo === departingUser.id);

              onUsersChange(usersList.map(u =>
                u.id === departingUser.id ? { ...u, status: 'left' } : u
              ));

              onAssignmentsChange(assignmentsList.map(a =>
                a.userId === departingUser.id && a.status === 'active'
                  ? { ...a, status: 'returned', returnDate: today }
                  : a
              ));

              onAssetsChange(assetsList.map(asset =>
                asset.assignedTo === departingUser.id
                  ? {
                      ...asset,
                      assignedTo: undefined,
                      status: departureCondition === 'damaged' ? 'maintenance' : 'available'
                    }
                  : asset
              ));

              if (assigned.length > 0) {
                onHistoryChange([
                  ...history,
                  ...assigned.map(asset => ({
                    id: `H-${Date.now()}-${asset.id}`,
                    assetId: asset.id,
                    timestamp: new Date().toISOString(),
                    action: departureCondition === 'damaged' ? 'Under Repair' as const : 'Returned' as const,
                    performedBy: currentUser.id,
                    from: departingUser.name,
                    to: IT_ASSET_MANAGER,
                    userId: departingUser.id,
                    reason: 'Employee left company',
                    notes: [
                      `Exit clearance return condition: ${departureCondition}.`,
                      'Automatically returned to IT Asset Manager.',
                      departureNotes.trim() ? departureNotes.trim() : ''
                    ].filter(Boolean).join(' ')
                  }))
                ]);
              }
              setDepartingUser(null);
            }}>
              Confirm Departure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal || !!editingUser} onOpenChange={(open) => {
        if (!open) {
          setShowCreateModal(false);
          setEditingUser(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Update user information below.' : 'Fill in the details to add a new user.'}
            </DialogDescription>
          </DialogHeader>
          <UserForm 
            user={editingUser}
            onSubmit={(data) => {
              if (editingUser) {
                if (data.status === 'left' && editingUser.status !== 'left') {
                  if (editingUser.id === currentUserId) {
                    alert('You cannot mark the account you are currently signed in with as Left Company.');
                    return;
                  }
                  setShowCreateModal(false);
                  setEditingUser(null);
                  setDepartingUser(editingUser);
                  return;
                }
                onUsersChange(usersList.map(u => u.id === editingUser.id ? { ...u, ...data, status: editingUser.status === 'left' ? 'left' : data.status } : u));
              } else {
                const newUser: User = {
                  id: `USR-${String(usersList.length + 1).padStart(3, '0')}`,
                  ...data
                };
                onUsersChange([...usersList, newUser]);
              }
              setShowCreateModal(false);
              setEditingUser(null);
            }}
            onCancel={() => {
              setShowCreateModal(false);
              setEditingUser(null);
            }}
            departmentsList={departmentsList}
            locationsList={locationsList}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserForm({ user, onSubmit, onCancel, departmentsList, locationsList }: { 
  user: User | null; 
  onSubmit: (data: Omit<User, 'id'>) => void;
  onCancel: () => void;
  departmentsList: string[];
  locationsList: Location[];
}) {
  const [formData, setFormData] = useState<Omit<User, 'id'>>({
    name: user?.name || '',
    email: user?.email || '',
    department: user?.department || '',
    locationId: user?.locationId || '',
    role: user?.role || 'user',
    phone: user?.phone || '',
    joinDate: user?.joinDate || new Date().toISOString().split('T')[0],
    status: user?.status || 'active'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium">Full Name</label>
          <Input
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Office Location</label>
          <select
            value={formData.locationId}
            onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
            required
          >
            <option value="">Select office location</option>
            {locationsList.map(location => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Email</label>
          <Input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Phone</label>
          <Input
            required
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Department</label>
          <select
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
            required
          >
            <option value="">Select department</option>
            {departmentsList.map(department => (
              <option key={department} value={department}>{department}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Role</label>
          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
          >
            <option value="user">User</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Employee Status</label>
          <select
            value={formData.status}
            disabled={formData.status === 'left'}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as UserStatus })}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm disabled:opacity-60"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            {formData.status === 'left' && <option value="left">Left Company</option>}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Join Date</label>
          <Input
            type="date"
            required
            value={formData.joinDate}
            onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{user ? 'Update' : 'Create'} User</Button>
      </DialogFooter>
    </form>
  );
}
