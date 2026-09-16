import { useState } from 'react';
import { Plus, Search, Edit, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type Vendor } from '@/data/sampleData';

const VENDOR_CATEGORIES = [
  'Hardware',
  'Software',
  'Services',
  'Cloud',
  'Telecom',
  'Consulting',
  'Other'
];

const CURRENCIES = [
  'USD - US Dollar',
  'INR - Indian Rupee',
  'EUR - Euro',
  'GBP - British Pound',
  'AED - UAE Dirham',
  'SGD - Singapore Dollar',
  'AUD - Australian Dollar',
  'CAD - Canadian Dollar',
  'JPY - Japanese Yen'
];

interface VendorsPageProps {
  vendorsList: Vendor[];
  onVendorsChange: (vendors: Vendor[]) => void;
}

export function VendorsPage({ vendorsList, onVendorsChange }: VendorsPageProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const categories = [...new Set(vendorsList.map(v => v.category))];

  const filteredVendors = vendorsList.filter(vendor => {
    const matchesSearch = searchQuery === '' || 
      vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || vendor.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this vendor?')) {
      onVendorsChange(vendorsList.filter(v => v.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendors</h1>
          <p className="text-muted-foreground">Manage suppliers and service providers</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Vendor
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
                placeholder="Search by name, contact, or email..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Vendors Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No vendors found
                  </TableCell>
                </TableRow>
              ) : (
                filteredVendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{vendor.name}</p>
                        <a 
                          href={vendor.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Website
                        </a>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{vendor.contactPerson}</TableCell>
                    <TableCell>
                      <a href={`mailto:${vendor.email}`} className="text-sm text-primary hover:underline">
                        {vendor.email}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{vendor.category}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {vendor.currency || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditingVendor(vendor)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(vendor.id)}>
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

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal || !!editingVendor} onOpenChange={(open) => {
        if (!open) {
          setShowCreateModal(false);
          setEditingVendor(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
            <DialogDescription>
              {editingVendor ? 'Update vendor information below.' : 'Fill in the details to add a new vendor.'}
            </DialogDescription>
          </DialogHeader>
          <VendorForm 
            vendor={editingVendor}
            onSubmit={(data) => {
              if (editingVendor) {
                onVendorsChange(vendorsList.map(v => v.id === editingVendor.id ? { ...v, ...data } : v));
              } else {
                const newVendor: Vendor = {
                  id: `VND-${String(vendorsList.length + 1).padStart(3, '0')}`,
                  ...data
                };
                onVendorsChange([...vendorsList, newVendor]);
              }
              setShowCreateModal(false);
              setEditingVendor(null);
            }}
            onCancel={() => {
              setShowCreateModal(false);
              setEditingVendor(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VendorForm({
  vendor,
  onSubmit,
  onCancel
}: {
  vendor: Vendor | null;
  onSubmit: (data: Omit<Vendor, 'id'>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Omit<VendorRecord, 'id'>>({
    name: vendor?.name || '',
    contactPerson: vendor?.contactPerson || '',
    email: vendor?.email || '',
    phone: vendor?.phone || '',
    website: vendor?.website || '',
    category: vendor?.category || VENDOR_CATEGORIES[0],
    address: vendor?.address || '',
    taxId: vendor?.taxId || '',
    currency: vendor?.currency || CURRENCIES[0]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      name: formData.name.trim(),
      contactPerson: formData.contactPerson.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      website: formData.website.trim(),
      address: formData.address?.trim() || '',
      taxId: formData.taxId?.trim() || ''
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium">Vendor Name</label>
          <Input
            required
            value={formData.name}
            placeholder="e.g. Dell Technologies"
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Contact Person</label>
          <Input
            required
            value={formData.contactPerson}
            placeholder="Primary contact name"
            onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Phone</label>
          <Input
            required
            value={formData.phone}
            placeholder="Contact phone number"
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Email</label>
          <Input
            type="email"
            required
            value={formData.email}
            placeholder="contact@vendor.com"
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Website</label>
          <Input
            type="url"
            required
            value={formData.website}
            placeholder="https://www.vendor.com"
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Category</label>
          <select
            required
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {VENDOR_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Select a standard category to keep vendor records consistent.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Currency</label>
          <select
            required
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium">Address</label>
          <textarea
            required
            value={formData.address}
            placeholder="Vendor street address, city, state, postal code, country"
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium">Tax ID / GSTIN</label>
          <Input
            value={formData.taxId}
            placeholder="e.g. GSTIN / Tax Identification Number"
            onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {vendor ? 'Update' : 'Create'} Vendor
        </Button>
      </DialogFooter>
    </form>
  );
}

