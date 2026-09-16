import { useState } from 'react';
import { Plus, Search, Edit, Trash2, Key, Calendar, Users, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  softwareLicenses as initialLicenses, 
  type SoftwareLicense, 
  formatDate, 
  formatCurrency 
} from '@/data/sampleData';

export function LicensesPage() {
  const [licensesList, setLicensesList] = useState<SoftwareLicense[]>(initialLicenses);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLicense, setEditingLicense] = useState<SoftwareLicense | null>(null);

  const filteredLicenses = licensesList.filter(license => {
    const matchesSearch = searchQuery === '' || 
      license.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      license.vendor.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter === 'all' || license.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const totalCost = licensesList.reduce((sum, l) => sum + l.cost, 0);
  const totalSeats = licensesList.reduce((sum, l) => sum + l.totalSeats, 0);
  const usedSeats = licensesList.reduce((sum, l) => sum + l.usedSeats, 0);
  const avgUtilization = totalSeats > 0 ? Math.round((usedSeats / totalSeats) * 100) : 0;

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this license?')) {
      setLicensesList(licensesList.filter(l => l.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Software Licenses</h1>
          <p className="text-muted-foreground">Manage software licenses and subscriptions</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add License
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Key className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{licensesList.length}</p>
              <p className="text-sm text-muted-foreground">Total Licenses</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-12 w-12 rounded-lg bg-chart-2/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{avgUtilization}%</p>
              <p className="text-sm text-muted-foreground">Avg. Utilization</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-12 w-12 rounded-lg bg-chart-3/10 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-chart-3" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalCost)}</p>
              <p className="text-sm text-muted-foreground">Total Cost</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-12 w-12 rounded-lg bg-chart-5/10 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-chart-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {licensesList.filter(l => {
                  const expiry = new Date(l.expiryDate);
                  const now = new Date();
                  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  return diffDays <= 90 && diffDays > 0;
                }).length}
              </p>
              <p className="text-sm text-muted-foreground">Expiring Soon</p>
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
                placeholder="Search by name or vendor..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="all">All Types</option>
              <option value="subscription">Subscription</option>
              <option value="perpetual">Perpetual</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Licenses Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Software</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Utilization</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLicenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No licenses found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLicenses.map((license) => {
                  const utilization = Math.round((license.usedSeats / license.totalSeats) * 100);
                  const expiry = new Date(license.expiryDate);
                  const now = new Date();
                  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  const isExpired = daysUntilExpiry <= 0;
                  const isExpiringSoon = daysUntilExpiry <= 90 && daysUntilExpiry > 0;
                  
                  return (
                    <TableRow key={license.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{license.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{license.licenseKey}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{license.vendor}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {license.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {license.usedSeats} / {license.totalSeats}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[100px]">
                            <div 
                              className={`h-full rounded-full ${
                                utilization > 90 ? 'bg-destructive' : 
                                utilization > 70 ? 'bg-chart-5' : 'bg-primary'
                              }`}
                              style={{ width: `${utilization}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{utilization}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className={isExpired ? 'text-destructive font-medium' : isExpiringSoon ? 'text-chart-5 font-medium' : 'text-muted-foreground'}>
                            {formatDate(license.expiryDate)}
                          </p>
                          {isExpired && <p className="text-xs text-destructive">Expired</p>}
                          {isExpiringSoon && <p className="text-xs text-chart-5">{daysUntilExpiry} days left</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatCurrency(license.cost)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditingLicense(license)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(license.id)}>
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

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal || !!editingLicense} onOpenChange={(open) => {
        if (!open) {
          setShowCreateModal(false);
          setEditingLicense(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLicense ? 'Edit License' : 'Add New License'}</DialogTitle>
            <DialogDescription>
              {editingLicense ? 'Update license information below.' : 'Fill in the details to add a new license.'}
            </DialogDescription>
          </DialogHeader>
          <LicenseForm 
            license={editingLicense}
            onSubmit={(data) => {
              if (editingLicense) {
                setLicensesList(licensesList.map(l => l.id === editingLicense.id ? { ...l, ...data } : l));
              } else {
                const newLicense: SoftwareLicense = {
                  id: `LIC-${String(licensesList.length + 1).padStart(3, '0')}`,
                  ...data
                };
                setLicensesList([...licensesList, newLicense]);
              }
              setShowCreateModal(false);
              setEditingLicense(null);
            }}
            onCancel={() => {
              setShowCreateModal(false);
              setEditingLicense(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LicenseForm({ license, onSubmit, onCancel }: { 
  license: SoftwareLicense | null; 
  onSubmit: (data: Omit<SoftwareLicense, 'id'>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Omit<SoftwareLicense, 'id'>>({
    name: license?.name || '',
    vendor: license?.vendor || '',
    licenseKey: license?.licenseKey || '',
    type: license?.type || 'subscription',
    totalSeats: license?.totalSeats || 0,
    usedSeats: license?.usedSeats || 0,
    expiryDate: license?.expiryDate || '',
    cost: license?.cost || 0
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium">Software Name</label>
          <Input
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Vendor</label>
          <Input
            required
            value={formData.vendor}
            onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">License Key</label>
          <Input
            required
            value={formData.licenseKey}
            onChange={(e) => setFormData({ ...formData, licenseKey: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
          >
            <option value="subscription">Subscription</option>
            <option value="perpetual">Perpetual</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Expiry Date</label>
          <Input
            type="date"
            required
            value={formData.expiryDate}
            onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Total Seats</label>
          <Input
            type="number"
            required
            value={formData.totalSeats}
            onChange={(e) => setFormData({ ...formData, totalSeats: parseInt(e.target.value) })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Used Seats</label>
          <Input
            type="number"
            required
            value={formData.usedSeats}
            onChange={(e) => setFormData({ ...formData, usedSeats: parseInt(e.target.value) })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium">Annual Cost ($)</label>
          <Input
            type="number"
            step="0.01"
            required
            value={formData.cost}
            onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{license ? 'Update' : 'Create'} License</Button>
      </DialogFooter>
    </form>
  );
}
