import { useState } from 'react';
import { confirmDialog } from '@/components/ConfirmHost';
import { ExportMenu } from '@/components/ExportMenu';
import { Plus, Edit, Trash2, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { isEmployee } from '@/lib/people';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { User } from '@/data/models';
import type { Location } from '@/data/models';

type DepartmentRecord = { id: string; name: string; siteId?: string };

interface DepartmentsPageProps {
  departmentsList: string[];
  onDepartmentsChange: (departments: string[]) => void;
  departmentRecords?: DepartmentRecord[];
  onDepartmentRecordsChange?: (departments: DepartmentRecord[]) => void;
  sitesList?: Location[];
  usersList: User[];
  onUsersChange: (users: User[]) => void;
  /** The site chosen at the top of the Employees page, or 'all'. This section follows it. */
  siteId: string;
}

export function DepartmentsPage({
  departmentRecords = [],
  onDepartmentRecordsChange,
  sitesList = [],
  usersList,
  onUsersChange,
  siteId,
}: DepartmentsPageProps) {
  const [newDepartment, setNewDepartment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [departmentError, setDepartmentError] = useState('');
  const [viewing, setViewing] = useState<DepartmentRecord | null>(null);
  const all = siteId === 'all';
  const siteName = (id?: string) => sitesList.find(l => l.id === id)?.name || '';
  const shown = departmentRecords.filter(d => all || d.siteId === siteId).sort((a, b) => a.name.localeCompare(b.name) || siteName(a.siteId).localeCompare(siteName(b.siteId)));
  const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const normalizeDepartment = (value: string) => value.trim().replace(/\s+/g, ' ');
  const members = (d: DepartmentRecord) => usersList.filter(u => isEmployee(u) && u.siteId === d.siteId && u.department === d.name);

  const handleAddDepartment = () => {
    const department = normalizeDepartment(newDepartment);
    setDepartmentError('');
    if (all) { setDepartmentError('Choose a site at the top of the page first. A department belongs to one site.'); return; }
    if (!department) { setDepartmentError('Enter a department name.'); return; }
    if (shown.some(item => sameName(item.name, department))) { setDepartmentError('That department already exists.'); return; }
    onDepartmentRecordsChange?.([...departmentRecords, { id: crypto.randomUUID(), name: department, siteId }]);
    setNewDepartment('');
  };

  const handleSaveDepartment = () => {
    const current = departmentRecords.find(d => d.id === editingId);
    if (!current) return;
    const department = normalizeDepartment(editingValue);
    setDepartmentError('');
    if (!department) { setDepartmentError('Enter a department name.'); return; }
    if (!sameName(department, current.name) && departmentRecords.some(d => d.siteId === current.siteId && sameName(d.name, department))) { setDepartmentError('That department already exists.'); return; }
    onDepartmentRecordsChange?.(departmentRecords.map(d => d.id === current.id ? { ...d, name: department } : d));
    onUsersChange(usersList.map(user => user.siteId === current.siteId && user.department === current.name ? { ...user, department } : user));
    setEditingId(null);
    setEditingValue('');
  };

  const handleDeleteDepartment = async (d: DepartmentRecord) => {
    const usedByCount = usersList.filter(user => user.siteId === d.siteId && user.department === d.name).length;
    setDepartmentError('');
    if (usedByCount > 0) { setDepartmentError(`Move ${usedByCount} user${usedByCount === 1 ? '' : 's'} out of ${d.name} before deleting it.`); return; }
    if (await confirmDialog({ title: 'Delete department?', message: `Delete ${d.name}${all && siteName(d.siteId) ? ` at ${siteName(d.siteId)}` : ''}?`, destructive: true })) {
      onDepartmentRecordsChange?.(departmentRecords.filter(item => item.id !== d.id));
    }
  };

  return (
    <div className="af-stagger space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Departments</h1>
          <p className="text-muted-foreground">
            Each office, plant and warehouse maintains its own department list.
          </p>
        </div>
        <ExportMenu label="Export all" disabled={departmentRecords.length === 0 && departmentsList.length === 0} build={() => ({
          name: 'departments', sheet: 'Departments',
          headers: ['Department', 'Site'],
          rows: departmentRecords.length
            ? departmentRecords.map(d => [d.name, sitesList.find(l => l.id === d.siteId)?.name || ''])
            : departmentsList.map(name => [name, '']),
        })} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Departments{all ? ' · all sites' : siteName(siteId) ? ` · ${siteName(siteId)}` : ''}</CardTitle>
          <CardDescription>
            {all ? 'Showing every site. To add a department, choose a site in the filter at the top of the page.' : 'Add, edit or remove the departments used at this site. Change the site in the filter at the top of the page.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input
              value={newDepartment}
              disabled={all}
              onChange={(event) => setNewDepartment(event.target.value)}
              placeholder={all ? 'Choose a site first' : 'Department name'}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleAddDepartment(); } }}
            />
            <Button type="button" onClick={handleAddDepartment} disabled={all}>
              <Plus className="h-4 w-4 mr-2" />
              Add Department
            </Button>
          </div>

          {departmentError && <p className="text-sm text-destructive">{departmentError}</p>}

          <div className="rounded-md border border-border">
            {shown.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No departments created yet.</div>
            ) : (
              shown.map((d) => {
                const count = members(d).length;
                const isEditing = editingId === d.id;
                return (
                  <div key={d.id} className="flex flex-col gap-3 border-b border-border p-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      {isEditing ? (
                        <Input value={editingValue} onChange={(event) => setEditingValue(event.target.value)}
                          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleSaveDepartment(); } }} />
                      ) : (
                        <>
                          <p className="font-medium text-foreground">{d.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {all && siteName(d.siteId) ? `${siteName(d.siteId)} · ` : ''}{count} assigned employee{count === 1 ? '' : 's'}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <Button size="sm" onClick={handleSaveDepartment}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditingValue(''); setDepartmentError(''); }}>Cancel</Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon-sm" variant="ghost" title={`See who is in ${d.name}`} aria-label={`Employees in ${d.name}`} onClick={() => setViewing(d)}><Users className="h-4 w-4" /></Button>
                          <Button size="sm" variant="outline" onClick={() => { setDepartmentError(''); setEditingId(d.id); setEditingValue(d.name); }}>
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteDepartment(d)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
      <Dialog open={viewing !== null} onOpenChange={o => { if (!o) setViewing(null); }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
            <DialogDescription>{siteName(viewing?.siteId) || 'No site'} · employees in this department</DialogDescription>
          </DialogHeader>
          {(() => {
            const list = viewing ? members(viewing).sort((a, b) => a.name.localeCompare(b.name)) : [];
            return list.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nobody is in this department yet.</p> : (
              <ul className="divide-y rounded-lg border text-sm">
                {list.map(u => (
                  <li key={u.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 truncate">{u.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{u.employeeId || '—'}{u.status !== 'active' ? ' · ' + (u.status === 'left' ? 'left' : 'inactive') : ''}</span>
                  </li>
                ))}
              </ul>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
