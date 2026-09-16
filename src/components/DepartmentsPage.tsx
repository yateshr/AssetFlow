import { useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { User } from '@/data/sampleData';

interface DepartmentsPageProps {
  departmentsList: string[];
  onDepartmentsChange: (departments: string[]) => void;
  usersList: User[];
  onUsersChange: (users: User[]) => void;
}

export function DepartmentsPage({
  departmentsList,
  onDepartmentsChange,
  usersList,
  onUsersChange
}: DepartmentsPageProps) {
  const [newDepartment, setNewDepartment] = useState('');
  const [editingDepartment, setEditingDepartment] = useState<string | null>(null);
  const [editingDepartmentValue, setEditingDepartmentValue] = useState('');
  const [departmentError, setDepartmentError] = useState('');

  const normalizeDepartment = (value: string) =>
    value.trim().replace(/\s+/g, ' ');

  const handleAddDepartment = () => {
    const department = normalizeDepartment(newDepartment);
    setDepartmentError('');

    if (!department) {
      setDepartmentError('Enter a department name.');
      return;
    }

    if (
      departmentsList.some(
        item => item.toLowerCase() === department.toLowerCase()
      )
    ) {
      setDepartmentError('That department already exists.');
      return;
    }

    onDepartmentsChange(
      [...departmentsList, department].sort((a, b) => a.localeCompare(b))
    );
    setNewDepartment('');
  };

  const handleStartEditDepartment = (department: string) => {
    setDepartmentError('');
    setEditingDepartment(department);
    setEditingDepartmentValue(department);
  };

  const handleSaveDepartment = () => {
    if (!editingDepartment) return;

    const department = normalizeDepartment(editingDepartmentValue);
    setDepartmentError('');

    if (!department) {
      setDepartmentError('Enter a department name.');
      return;
    }

    if (
      department.toLowerCase() !== editingDepartment.toLowerCase() &&
      departmentsList.some(
        item => item.toLowerCase() === department.toLowerCase()
      )
    ) {
      setDepartmentError('That department already exists.');
      return;
    }

    onDepartmentsChange(
      departmentsList
        .map(item =>
          item === editingDepartment ? department : item
        )
        .sort((a, b) => a.localeCompare(b))
    );

    onUsersChange(
      usersList.map(user =>
        user.department === editingDepartment
          ? { ...user, department }
          : user
      )
    );

    setEditingDepartment(null);
    setEditingDepartmentValue('');
  };

  const handleDeleteDepartment = (department: string) => {
    const usedByCount = usersList.filter(
      user => user.department === department
    ).length;

    setDepartmentError('');

    if (usedByCount > 0) {
      setDepartmentError(
        `Move ${usedByCount} user${usedByCount === 1 ? '' : 's'} out of ${department} before deleting it.`
      );
      return;
    }

    if (confirm(`Delete ${department}?`)) {
      onDepartmentsChange(
        departmentsList.filter(item => item !== department)
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Departments</h1>
          <p className="text-muted-foreground">
            Manage the department choices used when adding users and logging IT calls
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Departments</CardTitle>
          <CardDescription>
            Add, edit, or remove departments used throughout AssetFlow.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={newDepartment}
              onChange={(event) => setNewDepartment(event.target.value)}
              placeholder="Department name"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAddDepartment();
                }
              }}
            />
            <Button type="button" onClick={handleAddDepartment}>
              <Plus className="h-4 w-4 mr-2" />
              Add Department
            </Button>
          </div>

          {departmentError && (
            <p className="text-sm text-destructive">{departmentError}</p>
          )}

          <div className="rounded-md border border-border">
            {departmentsList.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No departments created yet.
              </div>
            ) : (
              departmentsList.map((department) => {
                const usedByCount = usersList.filter(
                  user => user.department === department
                ).length;
                const isEditing = editingDepartment === department;

                return (
                  <div
                    key={department}
                    className="flex flex-col gap-3 border-b border-border p-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex-1">
                      {isEditing ? (
                        <Input
                          value={editingDepartmentValue}
                          onChange={(event) =>
                            setEditingDepartmentValue(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              handleSaveDepartment();
                            }
                          }}
                        />
                      ) : (
                        <>
                          <p className="font-medium text-foreground">{department}</p>
                          <p className="text-sm text-muted-foreground">
                            {usedByCount} assigned user{usedByCount === 1 ? '' : 's'}
                          </p>
                        </>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <Button size="sm" onClick={handleSaveDepartment}>Save</Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingDepartment(null);
                              setEditingDepartmentValue('');
                              setDepartmentError('');
                            }}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartEditDepartment(department)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteDepartment(department)}
                          >
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
    </div>
  );
}
