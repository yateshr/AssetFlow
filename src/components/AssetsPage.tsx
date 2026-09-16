import { useState } from 'react';
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
  Mouse
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
}

export function AssetsPage({
  assetsList,
  onAssetsChange,
  usersList,
  locationsList,
  history,
  onHistoryChange,
  currentUser,
}: AssetsPageProps) {
  const assets = assetsList;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<AssetType | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  const [historyAsset, setHistoryAsset] = useState<Asset | null>(null);

  // Filter assets
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = searchQuery === '' || 
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.assetTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.manufacturer.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;
    const matchesType = typeFilter === 'all' || asset.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

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

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this asset?')) {
      onAssetsChange(assets.filter(a => a.id !== id));
    }
  };

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
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Asset
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
                <TableHead>Location</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
            onSubmit={(data) => {
              const normalizedData: Omit<Asset, 'id'> = {
                ...data,
                assignedTo: data.assignedTo || undefined,
                status: data.assignedTo ? 'assigned' : data.status
              };

              if (editingAsset) {
                const previous = assets.find(a => a.id === editingAsset.id);
                onAssetsChange(assets.map(a => a.id === editingAsset.id ? { ...a, ...normalizedData } : a));
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
                  if (events.length) onHistoryChange([...history, ...events]);
                }
              } else {
                const newAsset: Asset = {
                  id: `AST-${String(assets.length + 1).padStart(3, '0')}`,
                  ...normalizedData
                };
                onAssetsChange([...assets, newAsset]);
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

function AssetForm({ asset, usersList, locationsList, onSubmit, onCancel }: { 
  asset: Asset | null;
  usersList: User[];
  locationsList: Location[];
  onSubmit: (data: Omit<Asset, 'id'>) => void;
  onCancel: () => void;
}) {
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
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
