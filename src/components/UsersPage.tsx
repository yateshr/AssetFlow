import { useEffect, useState } from 'react';
import { EmployeeImportDialog } from './EmployeeImportDialog';
import { confirmDialog } from '@/components/ConfirmHost';
import { toast } from 'sonner';
import { isEmployee } from '@/lib/people';
import { ExportMenu } from '@/components/ExportMenu';
import { Plus, Search, Edit, Trash2, PackageCheck, Eye, ArrowRightLeft, Upload, ChevronLeft, ChevronRight, MailX } from 'lucide-react';
import { getActiveCompanyId, listTransferLocations, requestTransfer, transferEmployee } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type Location, type User, type UserStatus, type Asset, type AssetStatus, type Assignment, type AssetHistoryEvent, type Company, formatDate } from '@/data/models';
import { custodianName } from './assetLifecycle';
import { DepartmentsPage } from './DepartmentsPage';

interface UsersPageProps {
  usersList: User[];
  onUsersChange: (users: User[]) => void;
  currentUserId: string;
  departmentsList: string[];
  onDepartmentsChange: (departments: string[]) => void;
  departmentRecords: Array<{ id: string; name: string; siteId?: string }>;
  onDepartmentRecordsChange: (departments: Array<{ id: string; name: string; siteId?: string }>) => void;
  sitesList: Location[];
  assetsList: Asset[];
  assignmentsList: Assignment[];
  onAssetsChange: (assets: Asset[]) => void;
  onAssignmentsChange: (assignments: Assignment[]) => void;
  history: AssetHistoryEvent[];
  onHistoryChange: (events: AssetHistoryEvent[]) => void;
  currentUser: User;
  companies: Company[];
}

export function UsersPage({
  usersList, onUsersChange, currentUserId, departmentsList, onDepartmentsChange, departmentRecords, onDepartmentRecordsChange, sitesList,
  assetsList, assignmentsList, onAssetsChange, onAssignmentsChange,
  history, onHistoryChange, currentUser, companies
}: UsersPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  // Rows per page is remembered on this computer.
  const [pageSize, setPageSize] = useState(() => { try { const n = Number(localStorage.getItem('assetflow-employees-page-size')); return [10, 25, 50, 100].includes(n) ? n : 25; } catch { return 25; } });
  const changePageSize = (n: number) => { setPageSize(n); setPage(1); try { localStorage.setItem('assetflow-employees-page-size', String(n)); } catch { /* ignore */ } };
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [departingUser, setDepartingUser] = useState<User | null>(null);
  const [departureCondition, setDepartureCondition] = useState<'good' | 'fair' | 'damaged'>('good');
  const [departureNotes, setDepartureNotes] = useState('');
  const [viewingAssetsUser, setViewingAssetsUser] = useState<User | null>(null);
  const [transferringUser, setTransferringUser] = useState<User | null>(null);

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

  // Employees only: logins (Super Admin, site IT admins) are managed under Companies & access, not here.
  const filteredUsers = usersList.filter(isEmployee).filter(user => {
    const userLocation = sitesList.find(location => location.id === user.siteId);
    const matchesSearch = searchQuery === '' || 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Boolean(userLocation?.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesSite = siteFilter === 'all' || user.siteId === siteFilter;
    const matchesDepartment = departmentFilter === 'all' || user.department === departmentFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesSite && matchesDepartment && matchesStatus;
  });
  const employeeList = usersList.filter(isEmployee);
  // The departments of the chosen site (all sites when none is chosen), whether or not anyone is in them yet.
  const departmentOptions = [...new Set([...departmentRecords.filter(d => siteFilter === 'all' || d.siteId === siteFilter).map(d => d.name), ...employeeList.filter(u => siteFilter === 'all' || u.siteId === siteFilter).map(u => u.department)].filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageUsers = filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize);
  const filtersActive = siteFilter !== 'all' || departmentFilter !== 'all' || statusFilter !== 'all' || searchQuery !== '';
  // E-mail is optional. Older imports invented addresses ending in @import.local: offer to clear them.
  const invented = employeeList.filter(u => /@import\.local$/i.test(u.email || ''));
  const clearInvented = async () => {
    if (await confirmDialog({ title: 'Clear generated e-mail addresses?', message: `${invented.length} employee${invented.length === 1 ? ' has' : 's have'} an address made up by an earlier import (ending in @import.local). They will be left blank. Real addresses are not touched.`, confirmLabel: 'Clear them' })) {
      onUsersChange(usersList.map(u => (isEmployee(u) && /@import\.local$/i.test(u.email || '') ? { ...u, email: '' } : u)));
      toast.success('Generated e-mail addresses cleared');
    }
  };

  const handleDelete = async (id: string) => {
    if (id === currentUserId) {
      toast.error('You cannot delete the account you are currently signed in with.');
      return;
    }
    if (await confirmDialog({ title: 'Delete employee?', message: 'Are you sure you want to delete this employee?', destructive: true })) {
      onUsersChange(usersList.filter(u => u.id !== id));
    }
  };

  return (
    <div className="af-stagger space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Employees</h1>
          <p className="text-muted-foreground">Manage employee records, departments and assigned sites. Portal access is managed separately for IT staff.</p>
        </div>
        <div className="flex flex-wrap gap-2">
        {['super_admin', 'admin'].includes(currentUser.role) && <Button variant="outline" onClick={() => setShowImport(true)}><Upload className="h-4 w-4 mr-2" />Import</Button>}
        <ExportMenu disabled={filteredUsers.length === 0} build={() => ({
          name: 'employees', sheet: 'Employees',
          headers: ['Employee ID', 'Name', 'Email', 'Phone', 'Department', 'Site', 'Role', 'Status', 'Join Date'],
          rows: filteredUsers.map(u => [u.employeeId || u.id, u.name, u.email, u.phone, u.department, sitesList.find(l => l.id === u.siteId)?.name || u.siteId, u.role, u.status, u.joinDate]),
        })} />
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Employee
        </Button>
        </div>
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
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              />
            </div>
            {([
              ['Site', siteFilter, (v: string) => { setSiteFilter(v); setDepartmentFilter('all'); setPage(1); }, [['all', 'All sites'], ...sitesList.map(l => [l.id, l.name])]],
              ['Department', departmentFilter, (v: string) => { setDepartmentFilter(v); setPage(1); }, [['all', 'All departments'], ...departmentOptions.map(d => [d, d])]],
              ['Status', statusFilter, (v: string) => { setStatusFilter(v); setPage(1); }, [['all', 'Any status'], ['active', 'Active'], ['inactive', 'Inactive'], ['left', 'Left company']]],
            ] as Array<[string, string, (v: string) => void, string[][]]>).map(([label, value, set, options]) => (
              <select key={label} aria-label={label} value={value} onChange={e => set(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
              </select>
            ))}
            {filtersActive && <Button variant="ghost" onClick={() => { setSearchQuery(''); setSiteFilter('all'); setDepartmentFilter('all'); setStatusFilter('all'); setPage(1); }}>Clear</Button>}
          </div>
          {invented.length > 0 && (
            <button type="button" onClick={() => void clearInvented()} className="mt-3 inline-flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-sm hover:bg-amber-500/10">
              <MailX className="h-4 w-4" /> {invented.length} generated e-mail address{invented.length === 1 ? '' : 'es'} (@import.local): clear them
            </button>
          )}
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Assigned Site</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Join Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No employees found
                  </TableCell>
                </TableRow>
              ) : (
                pageUsers.map((user) => {
                  const location = sitesList.find(item => item.id === user.siteId);

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
                    <TableCell className="text-sm text-muted-foreground">{user.email || '—'}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{user.employeeId || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.department}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{location?.name || '-'}</TableCell>
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
                        <Button variant="ghost" size="icon-sm" title="Edit employee" onClick={() => setEditingUser(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {user.status === 'active' && <Button variant="ghost" size="icon-sm" title="Transfer employee" onClick={() => setTransferringUser(user)}><ArrowRightLeft className="h-4 w-4" /></Button>}
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
            <span>{filteredUsers.length === 0 ? '0 employees' : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filteredUsers.length)} of ${filteredUsers.length}`}</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2">Rows per page
                <select aria-label="Rows per page" value={pageSize} onChange={e => changePageSize(Number(e.target.value))} className="h-8 rounded-md border border-input bg-background px-2">
                  {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="min-w-[5rem] text-center tabular-nums">Page {safePage} of {pageCount}</span>
                <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <EmployeeImportDialog open={showImport} onClose={() => setShowImport(false)} />
      <DepartmentsPage
        departmentsList={departmentsList}
        onDepartmentsChange={onDepartmentsChange}
        departmentRecords={departmentRecords}
        onDepartmentRecordsChange={onDepartmentRecordsChange}
        sitesList={sitesList}
        usersList={usersList}
        onUsersChange={onUsersChange}
      />

      <EmployeeTransferDialog
        employee={transferringUser}
        companies={companies.filter(company => company.active)}
        locations={sitesList}
        departments={departmentsList}
        departmentRecords={departmentRecords}
        currentUser={currentUser}
        onClose={() => setTransferringUser(null)}
        onTransfer={async ({ targetCompanyId, targetSiteId, targetDepartment, reason }) => {
          const sourceCompanyId = getActiveCompanyId();
          if (!transferringUser || !sourceCompanyId) return;
          if (['super_admin', 'admin'].includes(currentUser.role)) {
            await transferEmployee({ sourceCompanyId, targetCompanyId, employeeId: transferringUser.id, targetSiteId, targetDepartment, reason });
            if (sourceCompanyId === targetCompanyId) onUsersChange(usersList.map(user => user.id === transferringUser.id ? { ...user, siteId: targetSiteId, department: targetDepartment } : user));
            return;
          }
          await requestTransfer({ requestType: 'employee', sourceCompanyId, sourceSiteId: transferringUser.siteId, targetCompanyId, targetSiteId, targetDepartment, entityId: transferringUser.id, reason });
        }}
      />

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
                  Tip: Use the asset's History action from the Assets page to see its complete lifecycle, including previous users, returns, repairs, and {custodianName()} custody.
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
              This will automatically return all assigned assets to {custodianName()}.
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
                        <Badge variant="outline">{custodianName()}</Badge>
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
                        className="w-full px-3 py-2 border border-input rounded-lg bg-background shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 text-sm"
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
                        className="w-full px-3 py-2 border border-input rounded-lg bg-background shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 text-sm min-h-[80px]"
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
                    to: custodianName(),
                    userId: departingUser.id,
                    reason: 'Employee left company',
                    notes: [
                      `Exit clearance return condition: ${departureCondition}.`,
                      `Automatically returned to ${custodianName()}.`,
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
            <DialogTitle>{editingUser ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Update user information below.' : 'Fill in the details to add a new user.'}
            </DialogDescription>
          </DialogHeader>
          <UserForm 
            user={editingUser}
            onSubmit={(data) => {
              const code = (data.employeeId || '').trim().toLowerCase();
              const clash = code ? usersList.find(u => u.id !== editingUser?.id && (u.employeeId || '').trim().toLowerCase() === code) : undefined;
              if (clash) {
                toast.error(`Employee ID ${data.employeeId} is already used by ${clash.name}.`, { description: 'Every employee needs a different ID. Names and departments can repeat.' });
                return;
              }
              if (editingUser) {
                if (data.status === 'left' && editingUser.status !== 'left') {
                  if (editingUser.id === currentUserId) {
                    toast.error('You cannot mark the account you are currently signed in with as Left Company.');
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
              departmentRecords={departmentRecords}
            sitesList={sitesList}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmployeeTransferDialog({employee,companies,locations,departments,departmentRecords=[],currentUser,onClose,onTransfer}:{employee:User|null;companies:Company[];locations:Location[];departments:string[];departmentRecords?:Array<{id:string;name:string;siteId?:string}>;currentUser:User;onClose:()=>void;onTransfer:(input:{targetCompanyId:string;targetSiteId:string;targetDepartment:string;reason:string})=>Promise<void>}) {
  const [companyId,setCompanyId]=useState(''); const [siteId,setSiteId]=useState(''); const [targetLocations,setTargetLocations]=useState<Array<{id:string;name:string}>>([]); const [department,setDepartment]=useState(''); const [reason,setReason]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const sourceCompanyId=getActiveCompanyId()||'';
  const sameCompany=companyId===sourceCompanyId;
  useEffect(()=>{if(employee){setCompanyId(sourceCompanyId);setSiteId("");setDepartment("");setReason('');setError('');setBusy(false);}},[employee?.id,sourceCompanyId]);
  useEffect(()=>{if(!employee||!companyId)return;if(companyId===sourceCompanyId){setTargetLocations(locations.filter(l=>l.id!==employee.siteId));setSiteId("");setDepartment("");return;}setSiteId('');setDepartment('');setTargetLocations([]);void listTransferLocations(sourceCompanyId,companyId).then(setTargetLocations).catch(error=>setError(error instanceof Error?error.message:String(error)));},[companyId,employee?.id,sourceCompanyId]);
  const submit=async(event:React.FormEvent)=>{event.preventDefault();if(companyId===sourceCompanyId&&siteId===employee?.siteId&&department.trim()===employee?.department){setError('Choose a different department, location, or company.');return;}setBusy(true);setError('');try{await onTransfer({targetCompanyId:companyId,targetSiteId:siteId,targetDepartment:department.trim(),reason:reason.trim()});onClose();}catch(err){setError(err instanceof Error?err.message:String(err));setBusy(false);}};
  return <Dialog open={!!employee} onOpenChange={open=>!open&&onClose()}><DialogContent><form onSubmit={submit}><DialogHeader><DialogTitle>Transfer employee</DialogTitle><DialogDescription>{['super_admin','admin'].includes(currentUser.role)?'The employee record will be moved immediately. Assigned assets stay where they are.':'Your request will be sent to Super Admin for approval. Assigned assets stay where they are.'}</DialogDescription></DialogHeader><div className="space-y-4 py-5"><div className="rounded-lg border bg-muted/30 p-3 text-sm"><p className="font-medium">{employee?.name}</p><p className="font-mono text-xs text-muted-foreground">{employee?.employeeId || employee?.id} · {employee?.department}</p></div><label className="block space-y-1.5 text-sm">Target company<select required className="h-10 w-full rounded-md border bg-background px-3" value={companyId} onChange={event=>setCompanyId(event.target.value)}>{companies.map(company=><option key={company.id} value={company.id}>{company.name}{company.id===sourceCompanyId?" (current company)":""}</option>)}</select></label><label className="block space-y-1.5 text-sm">Target site<select required className="h-10 w-full rounded-md border bg-background px-3" value={siteId} onChange={event=>{setSiteId(event.target.value);setDepartment('');}}><option value="">Select target site</option>{targetLocations.map(location=><option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label className="block space-y-1.5 text-sm">Target department{sameCompany?<select required className="h-10 w-full rounded-md border bg-background px-3" value={department} onChange={event=>setDepartment(event.target.value)} disabled={!siteId}><option value="">{siteId?"Select department":"Choose a site first"}</option>{(departmentRecords.length?departmentRecords.filter(r=>r.siteId===siteId).map(r=>r.name):departments).map(item=><option key={item} value={item}>{item}</option>)}</select>:<Input required value={department} onChange={event=>setDepartment(event.target.value)} placeholder="Department in the target company" />}</label><label className="block space-y-1.5 text-sm">Transfer reason<Input required value={reason} onChange={event=>setReason(event.target.value)} /></label>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}</div><DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy||!companyId||!siteId||!department.trim()}>{busy?'Submitting…':(['super_admin','admin'].includes(currentUser.role)?'Transfer employee':'Submit request')}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function UserForm({ user, onSubmit, onCancel, departmentsList, departmentRecords, sitesList }: {
  user: User | null; 
  onSubmit: (data: Omit<User, 'id'>) => void;
  onCancel: () => void;
  departmentsList: string[];
  departmentRecords: Array<{ id: string; name: string; siteId?: string }>;
  sitesList: Location[];
}) {
  const [formData, setFormData] = useState<Omit<User, 'id'>>({
    name: user?.name || '',
    employeeId: user?.employeeId || '',
    email: user?.email || '',
    department: user?.department || '',
    siteId: user?.siteId || '',
    role: 'user',
    phone: user?.phone || '',
    joinDate: user?.joinDate || new Date().toISOString().split('T')[0],
    status: user?.status || 'active'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };
  const availableDepartments = formData.siteId ? departmentRecords.filter(department => department.siteId === formData.siteId).map(department => department.name) : [];

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
          <label className="text-sm font-medium">Employee ID</label>
          <Input required value={formData.employeeId || ''} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} placeholder="e.g. EMP-1024" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Assigned Site</label>
          <select
            value={formData.siteId}
            onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 text-sm"
            required
          >
            <option value="">Select site</option>
            {sitesList.map(location => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Email <span className="font-normal text-muted-foreground">(optional)</span></label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Phone <span className="font-normal text-muted-foreground">(optional)</span></label>
          <Input
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Department</label>
          <select
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 text-sm"
            required
          >
            <option value="">Select department</option>
            {(availableDepartments.length ? availableDepartments : departmentsList).map(department => (
              <option key={department} value={department}>{department}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Employee Status</label>
          <select
            value={formData.status}
            disabled={formData.status === 'left'}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as UserStatus })}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 text-sm disabled:opacity-60"
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
        <Button type="submit">{user ? 'Update' : 'Create'} Employee</Button>
      </DialogFooter>
    </form>
  );
}
