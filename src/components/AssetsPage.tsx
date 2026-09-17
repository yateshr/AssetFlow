import { useEffect, useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  Edit, 
  History, 
  Trash2, 
  Eye,
  X,
  Laptop,
  Monitor,
  Smartphone,
  Tablet,
  Printer,
  Server,
  Package,
  Mouse,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Archive,
  RotateCcw
} from 'lucide-react';
import { AssetHistoryDialog } from './AssetHistoryDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  type Asset, 
  type AssetType, 
  type AssetStatus,
  type AssetHistoryEvent,
  type User,
  type Location,
  formatDate,
  formatCurrency
} from '@/data/sampleData';

interface AssetsPageProps {
  assetsList: Asset[];
  onAssetsChange: (assets: Asset[]) => void;
  usersList: User[];
  locationsList: Location[];
  history: AssetHistoryEvent[];
  onHistoryChange: (events: AssetHistoryEvent[]) => void;
  currentUser: User;
  initialFilter?: { status?: AssetStatus; warranty?: 'expired' | '30' | '60' | '90'; type?: AssetType } | null;
  onInitialFilterConsumed?: () => void;
}

export function AssetsPage({
  assetsList,
  onAssetsChange,
  usersList,
  locationsList,
  history,
  onHistoryChange,
  currentUser,
  initialFilter,
  onInitialFilterConsumed,
}: AssetsPageProps) {
  const assets = assetsList;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<AssetType | 'all'>('all');
  const [warrantyFilter, setWarrantyFilter] = useState<'all' | 'expired' | '30' | '60' | '90'>('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [archivedAssets, setArchivedAssets] = useState<(Asset & { deletedAt: string; deletedBy?: string })[]>(() => {
    try {
      if (typeof window === 'undefined') return [];
      return JSON.parse(localStorage.getItem('assetflow-archived-assets') || '[]');
    } catch { return []; }
  });
  const [undoAsset, setUndoAsset] = useState<(Asset & { deletedAt: string; deletedBy?: string }) | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  const [historyAsset, setHistoryAsset] = useState<Asset | null>(null);

  const warrantyDays = (asset: Asset) => {
    const expiry = new Date(asset.warrantyExpiry).getTime();
    if (!Number.isFinite(expiry)) return null;
    return Math.ceil((expiry - Date.now()) / 86400000);
  };

  const warrantyCounts = {
    expired: assets.filter(a => { const d = warrantyDays(a); return d !== null && d < 0; }).length,
    next30: assets.filter(a => { const d = warrantyDays(a); return d !== null && d >= 0 && d <= 30; }).length,
    next60: assets.filter(a => { const d = warrantyDays(a); return d !== null && d >= 0 && d <= 60; }).length,
    next90: assets.filter(a => { const d = warrantyDays(a); return d !== null && d >= 0 && d <= 90; }).length,
  };

  // Filter assets
  const filteredAssets = assets.filter(asset => {
    const q = searchQuery.toLowerCase();
    const assignedName = asset.assignedTo ? usersList.find(u => u.id === asset.assignedTo)?.name || '' : '';
    const searchTerms = q.split(/\s+/).filter(Boolean);
    const searchHaystack = [asset.name, asset.assetTag, asset.serialNumber, asset.manufacturer, asset.model, asset.location, assignedName, asset.status, asset.type]
      .join(' ').toLowerCase();
    const matchesSearch = searchTerms.length === 0 || searchTerms.every(term => searchHaystack.includes(term));
    const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;
    const matchesType = typeFilter === 'all' || asset.type === typeFilter;
    const matchesLocation = locationFilter === 'all' || asset.location === locationFilter;
    const assignedUser = asset.assignedTo ? usersList.find(u => u.id === asset.assignedTo) : undefined;
    const matchesDepartment = departmentFilter === 'all' || assignedUser?.department === departmentFilter;
    const matchesMinPrice = minPrice === '' || asset.purchasePrice >= Number(minPrice);
    const matchesMaxPrice = maxPrice === '' || asset.purchasePrice <= Number(maxPrice);
    const d = warrantyDays(asset);
    const matchesWarranty = warrantyFilter === 'all' ||
      (warrantyFilter === 'expired' && d !== null && d < 0) ||
      (warrantyFilter === '30' && d !== null && d >= 0 && d <= 30) ||
      (warrantyFilter === '60' && d !== null && d >= 0 && d <= 60) ||
      (warrantyFilter === '90' && d !== null && d >= 0 && d <= 90);
    return matchesSearch && matchesStatus && matchesType && matchesWarranty && matchesLocation && matchesDepartment && matchesMinPrice && matchesMaxPrice;
  });

  useEffect(() => {
    if (!initialFilter) return;
    if (initialFilter.status) setStatusFilter(initialFilter.status);
    if (initialFilter.type) setTypeFilter(initialFilter.type);
    if (initialFilter.warranty) setWarrantyFilter(initialFilter.warranty);
    onInitialFilterConsumed?.();
  }, [initialFilter?.status, initialFilter?.type, initialFilter?.warranty]);

  const departments = [...new Set(usersList.map(user => user.department).filter(Boolean))].sort();

  const getAssetIcon = (type: AssetType) => {
    switch (type) {
      case 'laptop': return Laptop;
      case 'desktop': return Monitor;
      case 'monitor': return Monitor;
      case 'phone': return Smartphone;
      case 'tablet': return Tablet;
      case 'printer': return Printer;
      case 'server': return Server;
      case 'accessory': return Mouse;
      default: return Package;
    }
  };

  const getStatusBadge = (status: AssetStatus) => {
    const variants = {
      available: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
      assigned: 'bg-primary/10 text-primary border-primary/20',
      maintenance: 'bg-chart-5/10 text-chart-5 border-chart-5/20',
      retired: 'bg-muted text-muted-foreground border-muted',
      disposed: 'bg-muted text-muted-foreground border-muted',
      lost: 'bg-destructive/10 text-destructive border-destructive/20'
    };
    return variants[status];
  };

  const persistArchived = (items: (Asset & { deletedAt: string; deletedBy?: string })[]) => {
    setArchivedAssets(items);
    localStorage.setItem('assetflow-archived-assets', JSON.stringify(items));
  };

  const handleDelete = (id: string) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;
    if (!window.confirm(`Archive ${asset.name} (${asset.assetTag})? The asset will be removed from active lists but can be restored.`)) return;

    const archived = { ...asset, deletedAt: new Date().toISOString(), deletedBy: currentUser.id };
    const nextArchived = [archived, ...archivedAssets.filter(a => a.id !== id)];
    persistArchived(nextArchived);
    onAssetsChange(assets.filter(a => a.id !== id));
    onHistoryChange([
      ...history,
      {
        id: `H-${Date.now()}-ARCHIVED`,
        assetId: asset.id,
        timestamp: new Date().toISOString(),
        action: 'Archived',
        performedBy: currentUser.id,
        from: 'Active',
        to: 'Archived',
        reason: 'Asset archived from Assets list.',
        beforeValue: JSON.stringify({ status: asset.status, assetTag: asset.assetTag }),
        afterValue: JSON.stringify({ archived: true }),
        source: 'assets',
        entityType: 'Asset'
      }
    ]);
    setUndoAsset(archived);
    window.setTimeout(() => setUndoAsset(current => current?.id === id ? null : current), 8000);
  };

  const restoreAsset = (archived: Asset & { deletedAt: string; deletedBy?: string }) => {
    const conflict = assets.find(a => a.id !== archived.id && (
      a.assetTag.trim().toLowerCase() === archived.assetTag.trim().toLowerCase() ||
      a.serialNumber.trim().toLowerCase() === archived.serialNumber.trim().toLowerCase()
    ));
    if (conflict) {
      window.alert(`Cannot restore ${archived.name}. Asset Tag or Serial Number is already in use by ${conflict.name} (${conflict.assetTag}).`);
      return;
    }
    if (!window.confirm(`Restore ${archived.name} (${archived.assetTag}) to active assets?`)) return;
    const restored = archivedAssets.filter(a => a.id !== archived.id);
    persistArchived(restored);
    onAssetsChange([...assets, { ...archived }]);
    onHistoryChange([
      ...history,
      {
        id: `H-${Date.now()}-RESTORED`,
        assetId: archived.id,
        timestamp: new Date().toISOString(),
        action: 'Restored',
        performedBy: currentUser.id,
        from: 'Archived',
        to: 'Active',
        reason: 'Asset restored from archive.',
        beforeValue: JSON.stringify({ archived: true }),
        afterValue: JSON.stringify({ status: archived.status, assetTag: archived.assetTag }),
        source: 'assets',
        entityType: 'Asset'
      }
    ]);
    setUndoAsset(null);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
    setWarrantyFilter('all');
    setLocationFilter('all');
    setDepartmentFilter('all');
    setMinPrice('');
    setMaxPrice('');
  };

  const activeFilterCount = [
    searchQuery.trim(), statusFilter !== 'all' ? statusFilter : '', typeFilter !== 'all' ? typeFilter : '',
    warrantyFilter !== 'all' ? warrantyFilter : '', locationFilter !== 'all' ? locationFilter : '',
    departmentFilter !== 'all' ? departmentFilter : '', minPrice, maxPrice
  ].filter(Boolean).length;

  const handleExport = () => {
    const csvContent = [
      ['ID', 'Name', 'Type', 'Manufacturer', 'Model', 'Serial Number', 'Asset Tag', 'Status', 'Purchase Date', 'Purchase Price', 'Warranty Expiry', 'Location', 'Assigned To'].join(','),
      ...filteredAssets.map(a => [
        a.id,
        a.name,
        a.type,
        a.manufacturer,
        a.model,
        a.serialNumber,
        a.assetTag,
        a.status,
        a.purchaseDate,
        a.purchasePrice,
        a.warrantyExpiry,
        a.location,
        a.assignedTo ? usersList.find(u => u.id === a.assignedTo)?.name || a.assignedTo : ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'assets-export.csv';
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assets</h1>
          <p className="text-muted-foreground">Manage your IT assets and inventory</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => setShowArchived(true)}>
            <Archive className="h-4 w-4 mr-2" />
            Archived ({archivedAssets.length})
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Asset
          </Button>
        </div>
      </div>

      {/* Warranty Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button type="button" onClick={() => setWarrantyFilter('expired')} className="text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /><span className="text-xs font-medium">Expired</span></div>
          <p className="mt-1 text-xl font-semibold">{warrantyCounts.expired}</p>
        </button>
        <button type="button" onClick={() => setWarrantyFilter('30')} className="text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2 text-chart-5"><ShieldAlert className="h-4 w-4" /><span className="text-xs font-medium">Next 30 Days</span></div>
          <p className="mt-1 text-xl font-semibold">{warrantyCounts.next30}</p>
        </button>
        <button type="button" onClick={() => setWarrantyFilter('60')} className="text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2 text-primary"><ShieldAlert className="h-4 w-4" /><span className="text-xs font-medium">Next 60 Days</span></div>
          <p className="mt-1 text-xl font-semibold">{warrantyCounts.next60}</p>
        </button>
        <button type="button" onClick={() => setWarrantyFilter('90')} className="text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2 text-chart-2"><CheckCircle2 className="h-4 w-4" /><span className="text-xs font-medium">Next 90 Days</span></div>
          <p className="mt-1 text-xl font-semibold">{warrantyCounts.next90}</p>
        </button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by name, tag, serial number, or manufacturer..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AssetStatus | 'all')}
              className="px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="assigned">Assigned</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retired</option>
            </select>
            <select
              value={warrantyFilter}
              onChange={(e) => setWarrantyFilter(e.target.value as 'all' | 'expired' | '30' | '60' | '90')}
              className="px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="all">All Warranty</option>
              <option value="expired">Expired ({warrantyCounts.expired})</option>
              <option value="30">Expires in 30 days ({warrantyCounts.next30})</option>
              <option value="60">Expires in 60 days ({warrantyCounts.next60})</option>
              <option value="90">Expires in 90 days ({warrantyCounts.next90})</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as AssetType | 'all')}
              className="px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="all">All Types</option>
              <option value="laptop">Laptop</option>
              <option value="desktop">Desktop</option>
              <option value="monitor">Monitor</option>
              <option value="phone">Phone</option>
              <option value="tablet">Tablet</option>
              <option value="printer">Printer</option>
              <option value="server">Server</option>
              <option value="accessory">Accessory</option>
            </select>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="all">All Locations</option>
              {locationsList.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="all">All Departments</option>
              {departments.map(department => <option key={department} value={department}>{department}</option>)}
            </select>
            <Input type="number" min="0" placeholder="Min price" value={minPrice} onChange={e => setMinPrice(e.target.value)} />
            <Input type="number" min="0" placeholder="Max price" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
            <div className="flex items-center justify-between gap-2 sm:col-span-2 lg:col-span-4">
              <span className="text-xs text-muted-foreground">{filteredAssets.length} result{filteredAssets.length === 1 ? '' : 's'} • {activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}</span>
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters} disabled={activeFilterCount === 0}>Clear filters</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assets Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Asset Tag</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Warranty</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No assets found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAssets.map((asset) => {
                  const Icon = getAssetIcon(asset.type);
                  const location = locationsList.find(l => l.id === asset.location);
                  const assignedUser = asset.assignedTo ? usersList.find(u => u.id === asset.assignedTo) : null;
                  
                  return (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{asset.name}</p>
                            <p className="text-xs text-muted-foreground">{asset.manufacturer} {asset.model}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{asset.type}</TableCell>
                      <TableCell className="font-mono text-xs">{asset.assetTag}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusBadge(asset.status)}>
                          {asset.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {(() => {
                          const d = warrantyDays(asset);
                          if (d === null) return <span className="text-muted-foreground">-</span>;
                          if (d < 0) return <Badge variant="destructive">Expired</Badge>;
                          if (d <= 30) return <Badge variant="outline" className="text-destructive border-destructive/30">{d}d left</Badge>;
                          if (d <= 90) return <Badge variant="outline">{d}d left</Badge>;
                          return <span className="text-muted-foreground">{d}d</span>;
                        })()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {location?.name || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {assignedUser?.name || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => setViewingAsset(asset)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" title="View History" onClick={() => setHistoryAsset(asset)}>
                            <History className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditingAsset(asset)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(asset.id)}>
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

      {undoAsset && (
        <div className="fixed bottom-5 right-5 z-[120] w-[min(92vw,420px)] rounded-lg border bg-card p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <Archive className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">{undoAsset.name} archived</p>
              <p className="text-xs text-muted-foreground mt-1">You can undo this action for a few seconds.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => restoreAsset(undoAsset)}>
                <RotateCcw className="h-4 w-4 mr-2" /> Undo
              </Button>
            </div>
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setUndoAsset(null)} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <Dialog open={showArchived} onOpenChange={setShowArchived}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Archived Assets</DialogTitle>
            <DialogDescription>Soft-deleted assets remain here and can be restored.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {archivedAssets.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No archived assets.</div>
            ) : archivedAssets.map(asset => (
              <div key={asset.id} className="flex items-center gap-3 rounded-lg border p-3">
                <Archive className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{asset.name} <span className="font-mono text-xs text-muted-foreground">({asset.assetTag})</span></p>
                  <p className="text-xs text-muted-foreground">Archived {new Date(asset.deletedAt).toLocaleString()}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => restoreAsset(asset)}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Restore
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal || !!editingAsset} onOpenChange={(open) => {
        if (!open) {
          setShowCreateModal(false);
          setEditingAsset(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAsset ? 'Edit Asset' : 'Create New Asset'}</DialogTitle>
            <DialogDescription>
              {editingAsset ? 'Update the asset information below.' : 'Fill in the details to add a new asset to your inventory.'}
            </DialogDescription>
          </DialogHeader>
          <AssetForm 
            asset={editingAsset}
            usersList={usersList}
            locationsList={locationsList}
            onSubmit={(data, detailedProfile) => {
              // Prevent duplicate assets. Asset Tag and Serial Number must be unique
              // across the inventory (case-insensitive, ignoring surrounding spaces).
              const normalizeUniqueValue = (value: string) => value.trim().toLowerCase();
              const enteredAssetTag = normalizeUniqueValue(data.assetTag);
              const enteredSerialNumber = normalizeUniqueValue(data.serialNumber);

              const duplicateAsset = assets.find(existing => {
                if (editingAsset && existing.id === editingAsset.id) return false;
                const sameAssetTag = enteredAssetTag !== '' && normalizeUniqueValue(existing.assetTag) === enteredAssetTag;
                const sameSerialNumber = enteredSerialNumber !== '' && normalizeUniqueValue(existing.serialNumber) === enteredSerialNumber;
                return sameAssetTag || sameSerialNumber;
              }) || archivedAssets.find(existing => {
                const sameAssetTag = enteredAssetTag !== '' && normalizeUniqueValue(existing.assetTag) === enteredAssetTag;
                const sameSerialNumber = enteredSerialNumber !== '' && normalizeUniqueValue(existing.serialNumber) === enteredSerialNumber;
                return sameAssetTag || sameSerialNumber;
              });

              if (duplicateAsset) {
                const duplicateFields: string[] = [];
                if (
                  enteredAssetTag !== '' &&
                  normalizeUniqueValue(duplicateAsset.assetTag) === enteredAssetTag
                ) {
                  duplicateFields.push(`Asset Tag "${data.assetTag.trim()}"`);
                }
                if (
                  enteredSerialNumber !== '' &&
                  normalizeUniqueValue(duplicateAsset.serialNumber) === enteredSerialNumber
                ) {
                  duplicateFields.push(`Serial Number "${data.serialNumber.trim()}"`);
                }

                window.alert(
                  `Duplicate asset detected.\n\n${duplicateFields.join(' and ')} already belongs to "${duplicateAsset.name}" (${duplicateAsset.assetTag}).\n\nPlease use a unique Asset Tag and Serial Number.`
                );
                return;
              }

              const normalizedData: Omit<Asset, 'id'> = {
                ...data,
                assignedTo: data.assignedTo || undefined,
                status: data.assignedTo ? 'assigned' : data.status
              };

              if (editingAsset) {
                const previous = assets.find(a => a.id === editingAsset.id);
                onAssetsChange(assets.map(a => a.id === editingAsset.id ? { ...a, ...normalizedData } : a));
                try {
                  const saved = JSON.parse(localStorage.getItem('assetflow-device-specs') || '{}');
                  saved[editingAsset.id] = { ...detailedProfile, assetId: editingAsset.id, enabled: detailedProfile.enabled };
                  localStorage.setItem('assetflow-device-specs', JSON.stringify(saved));
                } catch {}
                if (previous) {
                  const events = [];
                  if (previous.assignedTo !== normalizedData.assignedTo) {
                    events.push({
                      id: `H-${Date.now()}-ASSIGN`,
                      assetId: previous.id,
                      timestamp: new Date().toISOString(),
                      action: normalizedData.assignedTo ? 'Assigned' as const : 'Returned' as const,
                      performedBy: currentUser.id,
                      from: previous.assignedTo ? usersList.find(u => u.id === previous.assignedTo)?.name : 'IT Asset Manager',
                      to: normalizedData.assignedTo ? usersList.find(u => u.id === normalizedData.assignedTo)?.name : 'IT Asset Manager',
                      userId: normalizedData.assignedTo || previous.assignedTo,
                      notes: 'Asset assignment changed from Asset Details.'
                    });
                  }
                  if (previous.status !== normalizedData.status) {
                    events.push({
                      id: `H-${Date.now()}-STATUS`,
                      assetId: previous.id,
                      timestamp: new Date().toISOString(),
                      action: normalizedData.status === 'maintenance' ? 'Under Repair' as const :
                        normalizedData.status === 'retired' ? 'Retired' as const :
                        normalizedData.status === 'disposed' ? 'Disposed' as const :
                        normalizedData.status === 'lost' ? 'Lost' as const : 'Status Changed' as const,
                      performedBy: currentUser.id,
                      from: previous.status,
                      to: normalizedData.status,
                      notes: 'Asset status changed.'
                    });
                  }
                  events.push({
                    id: `H-${Date.now()}-UPDATED`,
                    assetId: previous.id,
                    timestamp: new Date().toISOString(),
                    action: 'Updated',
                    performedBy: currentUser.id,
                    from: JSON.stringify({ name: previous.name, type: previous.type, manufacturer: previous.manufacturer, model: previous.model, serialNumber: previous.serialNumber, assetTag: previous.assetTag, purchaseDate: previous.purchaseDate, purchasePrice: previous.purchasePrice, warrantyExpiry: previous.warrantyExpiry, location: previous.location, notes: previous.notes }),
                    to: JSON.stringify({ name: normalizedData.name, type: normalizedData.type, manufacturer: normalizedData.manufacturer, model: normalizedData.model, serialNumber: normalizedData.serialNumber, assetTag: normalizedData.assetTag, purchaseDate: normalizedData.purchaseDate, purchasePrice: normalizedData.purchasePrice, warrantyExpiry: normalizedData.warrantyExpiry, location: normalizedData.location, notes: normalizedData.notes }),
                    reason: 'Asset details updated.',
                    source: 'assets',
                    entityType: 'Asset',
                    beforeValue: JSON.stringify(previous),
                    afterValue: JSON.stringify({ ...previous, ...normalizedData })
                  });
                  if (events.length) onHistoryChange([...history, ...events]);
                }
              } else {
                const existingNumbers = [...assets, ...archivedAssets]
                  .map(a => Number(a.id.match(/(\d+)$/)?.[1] || 0))
                  .filter(Number.isFinite);
                const nextNumber = Math.max(0, ...existingNumbers) + 1;
                const newAsset: Asset = {
                  id: `AST-${String(nextNumber).padStart(3, '0')}`,
                  ...normalizedData
                };
                onAssetsChange([...assets, newAsset]);
                try {
                  const saved = JSON.parse(localStorage.getItem('assetflow-device-specs') || '{}');
                  saved[newAsset.id] = { ...detailedProfile, assetId: newAsset.id, enabled: detailedProfile.enabled };
                  localStorage.setItem('assetflow-device-specs', JSON.stringify(saved));
                } catch {}
                onHistoryChange([
                  ...history,
                  {
                    id: `H-${Date.now()}-PURCHASE`,
                    assetId: newAsset.id,
                    timestamp: new Date().toISOString(),
                    action: 'Purchased',
                    performedBy: currentUser.id,
                    to: 'IT Asset Manager',
                    locationId: newAsset.location,
                    cost: newAsset.purchasePrice,
                    notes: 'Asset created in inventory.'
                  },
                  {
                    id: `H-${Date.now()}-RECEIVED`,
                    assetId: newAsset.id,
                    timestamp: new Date().toISOString(),
                    action: 'Received',
                    performedBy: currentUser.id,
                    to: 'IT Asset Manager',
                    locationId: newAsset.location
                  },
                  ...(newAsset.assignedTo ? [{
                    id: `H-${Date.now()}-ASSIGN`,
                    assetId: newAsset.id,
                    timestamp: new Date().toISOString(),
                    action: 'Assigned' as const,
                    performedBy: currentUser.id,
                    from: 'IT Asset Manager',
                    to: usersList.find(u => u.id === newAsset.assignedTo)?.name,
                    userId: newAsset.assignedTo
                  }] : [])
                ]);
              }
              setShowCreateModal(false);
              setEditingAsset(null);
            }}
            onCancel={() => {
              setShowCreateModal(false);
              setEditingAsset(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* View Detail Modal */}
      <Dialog open={!!viewingAsset} onOpenChange={(open) => !open && setViewingAsset(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Asset Details</DialogTitle>
            <DialogDescription>Complete information about this asset</DialogDescription>
          </DialogHeader>
          {viewingAsset && <AssetDetail asset={viewingAsset} usersList={usersList} locationsList={locationsList} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingAsset(null)}>Close</Button>
            <Button onClick={() => {
              setEditingAsset(viewingAsset);
              setViewingAsset(null);
            }}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssetHistoryDialog
        asset={historyAsset}
        users={usersList}
        locations={locationsList}
        history={history}
        open={!!historyAsset}
        onOpenChange={(open) => !open && setHistoryAsset(null)}
      />
    </div>
  );
}

type DetailedProfileDraft = {
  enabled: boolean;
  hostname: string;
  os: string;
  osVersion: string;
  cpu: string;
  ram: string;
  storage: string;
  gpu: string;
  macAddress: string;
  ipAddress: string;
  biosVersion: string;
  encryption: boolean;
  antivirus: boolean;
  edr: boolean;
  lastCheckIn: string;
};

const emptyDetailedProfile = (): DetailedProfileDraft => ({
  enabled: true,
  hostname: '',
  os: '',
  osVersion: '',
  cpu: '',
  ram: '',
  storage: '',
  gpu: '',
  macAddress: '',
  ipAddress: '',
  biosVersion: '',
  encryption: false,
  antivirus: false,
  edr: false,
  lastCheckIn: '',
});

function AssetForm({ asset, usersList, locationsList, onSubmit, onCancel }: { 
  asset: Asset | null;
  usersList: User[];
  locationsList: Location[];
  onSubmit: (data: Omit<Asset, 'id'>, profile: DetailedProfileDraft) => void;
  onCancel: () => void;
}) {
  const [detailedProfileEnabled, setDetailedProfileEnabled] = useState(true);
  const [profile, setProfile] = useState<DetailedProfileDraft>(() => {
    if (!asset) return emptyDetailedProfile();
    try {
      const saved = JSON.parse(localStorage.getItem('assetflow-device-specs') || '{}');
      return { ...emptyDetailedProfile(), ...(saved[asset.id] || {}), enabled: true };
    } catch {
      return emptyDetailedProfile();
    }
  });

  useEffect(() => {
    setDetailedProfileEnabled(true);
    if (asset) {
      try {
        const saved = JSON.parse(localStorage.getItem('assetflow-device-specs') || '{}');
        setProfile({ ...emptyDetailedProfile(), ...(saved[asset.id] || {}), enabled: true });
      } catch {
        setProfile(emptyDetailedProfile());
      }
    } else {
      setProfile(emptyDetailedProfile());
    }
  }, [asset?.id]);

  const updateProfile = <K extends keyof DetailedProfileDraft>(key: K, value: DetailedProfileDraft[K]) => {
    setProfile(prev => ({ ...prev, [key]: value }));
  };

  const [formData, setFormData] = useState<Omit<Asset, 'id'>>({
    name: asset?.name || '',
    type: asset?.type || 'laptop',
    manufacturer: asset?.manufacturer || '',
    model: asset?.model || '',
    serialNumber: asset?.serialNumber || '',
    assetTag: asset?.assetTag || '',
    status: asset?.status || 'available',
    purchaseDate: asset?.purchaseDate || new Date().toISOString().split('T')[0],
    purchasePrice: asset?.purchasePrice || 0,
    warrantyExpiry: asset?.warrantyExpiry || '',
    location: asset?.location || '',
    assignedTo: asset?.assignedTo || '',
    notes: asset?.notes || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData, { ...profile, enabled: detailedProfileEnabled });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
        <div>
          <p className="text-sm font-medium">Detailed Profile</p>
          <p className="text-xs text-muted-foreground">
            Enable technical device details for this asset. This is ON by default.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={detailedProfileEnabled}
          onClick={() => setDetailedProfileEnabled(value => !value)}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
            detailedProfileEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
          }`}
          aria-label="Toggle Detailed Profile"
        >
          <span
            className={`pointer-events-none block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
              detailedProfileEnabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {detailedProfileEnabled && (
        <div className="rounded-lg border bg-background p-4 space-y-4">
          <div>
            <p className="text-sm font-semibold">Detailed Profile Information</p>
            <p className="text-xs text-muted-foreground">
              Add technical information now, or leave any field blank and complete it later.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              ['hostname', 'Hostname'],
              ['os', 'Operating System'],
              ['osVersion', 'OS Version'],
              ['cpu', 'CPU / Processor'],
              ['ram', 'RAM'],
              ['storage', 'Storage'],
              ['gpu', 'GPU / Graphics'],
              ['macAddress', 'MAC Address'],
              ['ipAddress', 'IP Address'],
              ['biosVersion', 'BIOS Version'],
              ['lastCheckIn', 'Last Check-in'],
            ] as const).map(([key, label]) => (
              <div className="space-y-2" key={key}>
                <label className="text-sm font-medium">{label}</label>
                <Input
                  value={profile[key]}
                  onChange={(e) => updateProfile(key, e.target.value)}
                  placeholder={`Enter ${label.toLowerCase()}`}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-5 pt-1">
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={profile.encryption}
                onChange={(e) => updateProfile('encryption', e.target.checked)}
              />
              Encryption
            </label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={profile.antivirus}
                onChange={(e) => updateProfile('antivirus', e.target.checked)}
              />
              Antivirus
            </label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={profile.edr}
                onChange={(e) => updateProfile('edr', e.target.checked)}
              />
              EDR
            </label>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Asset Name</label>
          <Input
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Asset Tag</label>
          <Input
            required
            value={formData.assetTag}
            onChange={(e) => setFormData({ ...formData, assetTag: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Must be unique. AssetFlow will check for duplicates before saving.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as AssetType })}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
          >
            <option value="laptop">Laptop</option>
            <option value="desktop">Desktop</option>
            <option value="monitor">Monitor</option>
            <option value="phone">Phone</option>
            <option value="tablet">Tablet</option>
            <option value="printer">Printer</option>
            <option value="server">Server</option>
            <option value="accessory">Accessory</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <select
            value={formData.status}
            onChange={(e) => {
              const status = e.target.value as AssetStatus;
              setFormData({
                ...formData,
                status,
                assignedTo: status === 'assigned' ? formData.assignedTo : ''
              });
            }}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
          >
            <option value="available">Available</option>
            <option value="assigned">Assigned</option>
            <option value="maintenance">Under Repair</option>
            <option value="retired">Retired</option>
            <option value="disposed">Disposed</option>
            <option value="lost">Lost</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Manufacturer</label>
          <Input
            required
            value={formData.manufacturer}
            onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Model</label>
          <Input
            required
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Serial Number</label>
          <Input
            required
            value={formData.serialNumber}
            onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Must be unique. Duplicate serial numbers cannot be saved.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Location</label>
          <select
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
          >
            <option value="">Select location</option>
            {locationsList.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Assign To</label>
          <select
            value={formData.assignedTo || ''}
            onChange={(e) => {
              const assignedTo = e.target.value;
              setFormData({
                ...formData,
                assignedTo,
                status: assignedTo ? 'assigned' : formData.status === 'assigned' ? 'available' : formData.status
              });
            }}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
          >
            <option value="">Unassigned</option>
            {usersList.filter(user => user.status !== 'left').map(user => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.department})
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Selecting a user marks this asset as assigned.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Purchase Date</label>
          <Input
            type="date"
            required
            value={formData.purchaseDate}
            onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Purchase Price ($)</label>
          <Input
            type="number"
            step="0.01"
            required
            value={formData.purchasePrice}
            onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Warranty Expiry</label>
          <Input
            type="date"
            required
            value={formData.warrantyExpiry}
            onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium">Notes</label>
          <textarea
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm min-h-[80px]"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{asset ? 'Update' : 'Create'} Asset</Button>
      </DialogFooter>
    </form>
  );
}

function AssetDetail({ asset, usersList, locationsList }: { asset: Asset; usersList: User[]; locationsList: Location[] }) {
  const location = locationsList.find(l => l.id === asset.location);
  const assignedUser = asset.assignedTo ? usersList.find(u => u.id === asset.assignedTo) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Asset Name</p>
          <p className="text-sm text-foreground">{asset.name}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Asset Tag</p>
          <p className="text-sm font-mono text-foreground">{asset.assetTag}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Type</p>
          <p className="text-sm text-foreground capitalize">{asset.type}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Status</p>
          <Badge variant="outline" className="capitalize">{asset.status === 'maintenance' ? 'Under Repair' : asset.status}</Badge>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Manufacturer</p>
          <p className="text-sm text-foreground">{asset.manufacturer}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Model</p>
          <p className="text-sm text-foreground">{asset.model}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Serial Number</p>
          <p className="text-sm font-mono text-foreground">{asset.serialNumber}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Location</p>
          <p className="text-sm text-foreground">{location?.name || '-'}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Purchase Date</p>
          <p className="text-sm text-foreground">{formatDate(asset.purchaseDate)}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Purchase Price</p>
          <p className="text-sm text-foreground">{formatCurrency(asset.purchasePrice)}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Warranty Expiry</p>
          <p className="text-sm text-foreground">{formatDate(asset.warrantyExpiry)}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Custody</p>
          <p className="text-sm text-foreground">
            {assignedUser?.name || 'IT Asset Manager'}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Assigned To</p>
          <p className="text-sm text-foreground">{assignedUser?.name || 'Not assigned'}</p>
        </div>
        {asset.notes && (
          <div className="col-span-2">
            <p className="text-sm font-medium text-muted-foreground">Notes</p>
            <p className="text-sm text-foreground">{asset.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
