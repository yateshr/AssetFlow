import { createTaggedAssets, getActiveCompanyId, kv, loadAssetTagSiteSeries, requestTransfer, reverseInvoiceReceipt, transferAsset, type AssetTagSiteSeries } from '@/lib/db';
import { currentHolder, defaultHolder, type Holder } from '@/lib/holders';
import { AssetRequestDialog } from './AssetRequestDialog';
import { AssetRequestsPanel } from './AssetRequestsPanel';
import { AssetDetailPage } from './AssetDetailPage';
import { getDeviceSpec, saveDeviceSpec } from '@/lib/deviceSpecs';
import { masterLabel } from '@/lib/masterLabel';
import { confirmDialog } from '@/components/ConfirmHost';
import { toast } from 'sonner';
import { ExportMenu } from '@/components/ExportMenu';
import { StockPanel } from '@/components/StockPanel';
import { isEmployee } from '@/lib/people';
import { DeployDialog } from '@/components/DeployDialog';
import { deployAsset, deployedPlaces, returnToStock } from '@/lib/stock';
import { useCollection } from '@/lib/db';
const LabelPrintDialog = lazy(() => import('./LabelPrintDialog').then(m => ({ default: m.LabelPrintDialog })));
import type { MasterDataOption } from '@/data/masterData';
import { Suspense, lazy, useEffect, useState } from 'react';
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
  RotateCcw,
  MoreHorizontal,
  Building2
} from 'lucide-react';
import { AssetHistoryDialog } from './AssetHistoryDialog';
import { custodianName } from './assetLifecycle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  type Asset, 
  type AssetType, 
  type AssetStatus,
  type AssetHistoryEvent,
  type User,
  type Location,
  type AssetCategory,
  type Invoice,
  type Company,
  formatDate,
  formatCurrency
} from '@/data/models';

interface AssetsPageProps {
  assetsList: Asset[];
  archivedAssets: Asset[];
  onAssetsChange: (assets: Asset[]) => void;
  usersList: User[];
  sitesList: Location[];
  history: AssetHistoryEvent[];
  onHistoryChange: (events: AssetHistoryEvent[]) => void;
  currentUser: User;
  initialFilter?: { status?: AssetStatus; warranty?: 'expired' | '30' | '60' | '90'; type?: AssetType } | null;
  onInitialFilterConsumed?: () => void;
  initialSearch?: string | null;
  onInitialSearchConsumed?: () => void;
  assetCategories: AssetCategory[];
  invoices: Invoice[];
  companies: Company[];
}

export function AssetsPage({
  assetsList,
  archivedAssets,
  onAssetsChange,
  usersList,
  sitesList,
  history,
  onHistoryChange,
  currentUser,
  initialFilter,
  onInitialFilterConsumed,
  initialSearch,
  onInitialSearchConsumed,
  assetCategories,
  invoices,
  companies,
}: AssetsPageProps) {
  const assets = assetsList;
  const [searchQuery, setSearchQuery] = useState('');
  const [labelAssets, setLabelAssets] = useState<Asset[] | null>(null);
  useEffect(() => {
    if (initialSearch) {
      // A scanned label link carries the exact tag: open that asset's page straight away.
      const exact = [...assetsList, ...archivedAssets].find(item => item.assetTag.toLowerCase() === initialSearch.trim().toLowerCase());
      if (exact) setViewingAsset(exact); else setSearchQuery(initialSearch);
      onInitialSearchConsumed?.();
    }
  }, [initialSearch]);
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<AssetType | 'all'>('all');
  const [warrantyFilter, setWarrantyFilter] = useState<'all' | 'expired' | '30' | '60' | '90'>('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [holderFilter, setHolderFilter] = useState('all');
  const [holders] = useCollection<Holder>('holders');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [undoAsset, setUndoAsset] = useState<Asset | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showAssetRequest, setShowAssetRequest] = useState(false);
  const [showMyRequests, setShowMyRequests] = useState(false);
  const [requestsRefresh, setRequestsRefresh] = useState(0);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  const [historyAsset, setHistoryAsset] = useState<Asset | null>(null);
  const [transferringAsset,setTransferringAsset]=useState<Asset|null>(null);
  const [movingAsset,setMovingAsset]=useState<Asset|null>(null);
  const [deployingAsset,setDeployingAsset]=useState<Asset|null>(null);
  const [reversingReceipt,setReversingReceipt]=useState<Asset|null>(null);
  const [assetTagRules,setAssetTagRules]=useState<AssetTagSiteSeries[]>([]);
  const isSuperAdmin=['super_admin','admin'].includes(currentUser.role);
  const companyAccessRole=companies.find(company=>company.id===getActiveCompanyId())?.accessRole;
  const canCreateInvoiceAssets=isSuperAdmin||['admin','manager','technician'].includes(companyAccessRole||'');
  useEffect(()=>{void loadAssetTagSiteSeries().then(setAssetTagRules).catch(error=>console.error('Could not load Site Series',error));},[]);

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
    const assignedName = asset.assignedTo ? usersList.find(u => u.id === asset.assignedTo)?.name || '' : currentHolder(asset, holders)?.name || '';
    const searchTerms = q.split(/\s+/).filter(Boolean);
    const searchHaystack = [asset.name, asset.assetTag, asset.serialNumber, asset.manufacturer, asset.model, asset.siteId, assignedName, asset.deployedAt || '', asset.status, asset.type]
      .join(' ').toLowerCase();
    const matchesSearch = searchTerms.length === 0 || searchTerms.every(term => searchHaystack.includes(term));
    const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;
    const matchesType = typeFilter === 'all' || asset.type === typeFilter;
    const matchesLocation = locationFilter === 'all' || asset.siteId === locationFilter;
    const matchesHolder = holderFilter === 'all' || (holderFilter === 'employees' ? !!asset.assignedTo : !asset.assignedTo && currentHolder(asset, holders)?.id === holderFilter);
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
    return matchesSearch && matchesStatus && matchesType && matchesWarranty && matchesLocation && matchesHolder && matchesDepartment && matchesMinPrice && matchesMaxPrice;
  });

  useEffect(() => {
    if (!initialFilter) return;
    if (initialFilter.status) setStatusFilter(initialFilter.status);
    if (initialFilter.type) setTypeFilter(initialFilter.type);
    if (initialFilter.warranty) setWarrantyFilter(initialFilter.warranty);
    onInitialFilterConsumed?.();
  }, [initialFilter?.status, initialFilter?.type, initialFilter?.warranty]);

  const departments = [...new Set(usersList.filter(isEmployee).map(user => user.department).filter(Boolean))].sort();

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
      deployed: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
      maintenance: 'bg-chart-5/10 text-chart-5 border-chart-5/20',
      retired: 'bg-muted text-muted-foreground border-muted',
      disposed: 'bg-muted text-muted-foreground border-muted',
      lost: 'bg-destructive/10 text-destructive border-destructive/20'
    };
    return variants[status];
  };

  const returnAssetToStock = (asset: Asset) => {
    const r = returnToStock(asset, currentUser.id);
    onAssetsChange(assets.map(a => (a.id === asset.id ? r.asset : a)));
    onHistoryChange([...history, r.history]);
    toast.success(`${asset.assetTag} is back in stock`);
  };

  // The detail page always shows the current version of the asset (edits, archive).
  const liveViewing = viewingAsset ? (assets.find(a => a.id === viewingAsset.id) ?? archivedAssets.find(a => a.id === viewingAsset.id) ?? viewingAsset) : null;

  // Opening an asset starts at the top of the page, not where the list was scrolled to.
  useEffect(() => {
    if (!liveViewing?.id) return;
    document.querySelector('main')?.scrollTo?.({ top: 0 });
    window.scrollTo?.({ top: 0 });
  }, [liveViewing?.id]);

  const handleDelete = async (id: string): Promise<boolean> => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return false;
    if (!(await confirmDialog({ title: 'Archive asset?', message: `Archive ${asset.name} (${asset.assetTag})? The asset will be removed from active lists but can be restored.`, confirmLabel: 'Archive' }))) return false;

    const archived: Asset = { ...asset, archivedAt: new Date().toISOString(), archivedBy: currentUser.id };
    // One write: the asset keeps its row and is marked archived.
    onAssetsChange(assets.map(a => (a.id === id ? archived : a)));
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
    return true;
  };

  const restoreAsset = async (archived: Asset) => {
    const conflict = assets.find(a => a.id !== archived.id && (
      a.assetTag.trim().toLowerCase() === archived.assetTag.trim().toLowerCase() ||
      a.serialNumber.trim().toLowerCase() === archived.serialNumber.trim().toLowerCase()
    ));
    if (conflict) {
      toast.error(`Cannot restore ${archived.name}. Asset Tag or Serial Number is already in use by ${conflict.name} (${conflict.assetTag}).`);
      return;
    }
    if (!(await confirmDialog({ title: 'Restore asset?', message: `Restore ${archived.name} (${archived.assetTag}) to active assets?`, confirmLabel: 'Restore' }))) return;
    const { archivedAt: _a, archivedBy: _b, ...active } = archived;
    onAssetsChange([...assets, active as Asset]);
    setUndoAsset(current => (current?.id === archived.id ? null : current));
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
    setHolderFilter('all');
    setMinPrice('');
    setMaxPrice('');
  };

  const activeFilterCount = [
    searchQuery.trim(), statusFilter !== 'all' ? statusFilter : '', typeFilter !== 'all' ? typeFilter : '',
    warrantyFilter !== 'all' ? warrantyFilter : '', locationFilter !== 'all' ? locationFilter : '',
    departmentFilter !== 'all' ? departmentFilter : '', holderFilter !== 'all' ? holderFilter : '', minPrice, maxPrice
  ].filter(Boolean).length;

  const buildExport = () => ({
    name: 'assets',
    sheet: 'Assets',
    headers: ['Asset Tag', 'Name', 'Type', 'Manufacturer', 'Model', 'Serial Number', 'Status', 'Where installed', 'Condition', 'Site', 'Assigned To', 'Purchase Date', 'Purchase Price', 'Warranty Expiry', 'AMC Provider', 'AMC Expiry', 'Insurance Provider', 'Insurance Expiry', 'Notes'],
    rows: filteredAssets.map(a => [
      a.assetTag, a.name, masterLabel('asset-categories', a.type), a.manufacturer, a.model, a.serialNumber, a.status, a.deployedAt || '', a.condition || '',
      sitesList.find(l => l.id === a.siteId)?.name || a.siteId,
      a.assignedTo ? usersList.find(u => u.id === a.assignedTo)?.name || a.assignedTo : '',
      a.purchaseDate, a.purchasePrice, a.warrantyExpiry, a.amcProvider || '', a.amcExpiry || '', a.insuranceProvider || '', a.insuranceExpiry || '', a.notes || '',
    ]),
  });

  return (
    <div className="af-stagger space-y-6">
      {liveViewing ? (
        <AssetDetailPage
          asset={liveViewing}
          users={usersList}
          sites={sitesList}
          invoices={invoices}
          history={history}
          onBack={() => setViewingAsset(null)}
          onEdit={() => setEditingAsset(liveViewing)}
          onLabel={() => setLabelAssets([liveViewing])}
          menu={
            <AssetActionMenu
              asset={liveViewing}
              hideView
              onView={() => {}}
              onHistory={() => setHistoryAsset(liveViewing)}
              onEdit={() => setEditingAsset(liveViewing)}
              onMove={() => setMovingAsset(liveViewing)}
              onDeploy={['available', 'deployed'].includes(liveViewing.status) ? () => setDeployingAsset(liveViewing) : undefined}
              onReturnToStock={liveViewing.status === 'deployed' ? () => returnAssetToStock(liveViewing) : undefined}
              onTransfer={() => setTransferringAsset(liveViewing)}
              onLabel={() => setLabelAssets([liveViewing])}
              onArchive={() => { void handleDelete(liveViewing.id).then(done => { if (done) setViewingAsset(null); }); }}
            />
          }
        />
      ) : (<>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Assets</h1>
          <p className="text-muted-foreground">Manage your IT assets and inventory</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportMenu build={buildExport} disabled={filteredAssets.length === 0} />
          <Button variant="outline" onClick={() => setLabelAssets(filteredAssets)} disabled={filteredAssets.length === 0}>
            <Printer className="h-4 w-4 mr-2" />
            Print labels
          </Button>
          <Button variant="outline" onClick={() => setShowArchived(true)}>
            <Archive className="h-4 w-4 mr-2" />
            Archived ({archivedAssets.length})
          </Button>
          {isSuperAdmin && <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Asset
          </Button>}
          {!isSuperAdmin && canCreateInvoiceAssets && (
            <>
              <Button variant="outline" onClick={() => setShowAssetRequest(true)}>Request asset (no invoice)</Button>
              <Button variant="ghost" onClick={() => { setRequestsRefresh(n => n + 1); setShowMyRequests(true); }}>My requests</Button>
            </>
          )}
          {canCreateInvoiceAssets && <Button variant="outline" onClick={() => setShowBatchModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {isSuperAdmin ? 'Add Batch' : 'Add from invoice'}
          </Button>}
        </div>
      </div>

      {/* Warranty Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button type="button" onClick={() => setWarrantyFilter('expired')} className="text-left rounded-xl border bg-card p-3 af-lift">
          <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /><span className="text-xs font-medium">Expired</span></div>
          <p className="mt-1 text-xl font-semibold">{warrantyCounts.expired}</p>
        </button>
        <button type="button" onClick={() => setWarrantyFilter('30')} className="text-left rounded-xl border bg-card p-3 af-lift">
          <div className="flex items-center gap-2 text-chart-5"><ShieldAlert className="h-4 w-4" /><span className="text-xs font-medium">Next 30 Days</span></div>
          <p className="mt-1 text-xl font-semibold">{warrantyCounts.next30}</p>
        </button>
        <button type="button" onClick={() => setWarrantyFilter('60')} className="text-left rounded-xl border bg-card p-3 af-lift">
          <div className="flex items-center gap-2 text-primary"><ShieldAlert className="h-4 w-4" /><span className="text-xs font-medium">Next 60 Days</span></div>
          <p className="mt-1 text-xl font-semibold">{warrantyCounts.next60}</p>
        </button>
        <button type="button" onClick={() => setWarrantyFilter('90')} className="text-left rounded-xl border bg-card p-3 af-lift">
          <div className="flex items-center gap-2 text-chart-2"><CheckCircle2 className="h-4 w-4" /><span className="text-xs font-medium">Next 90 Days</span></div>
          <p className="mt-1 text-xl font-semibold">{warrantyCounts.next90}</p>
        </button>
      </div>

      <StockPanel
        assets={assets} onAssetsChange={onAssetsChange} history={history} onHistoryChange={onHistoryChange}
        users={usersList.filter(isEmployee)} sites={sitesList} categories={assetCategories} currentUser={currentUser}
        onShow={(siteId, type, holderId) => {
          setStatusFilter('available'); setTypeFilter(type); setLocationFilter(siteId); setHolderFilter(holderId || 'all'); setSearchQuery('');
          setTimeout(() => document.getElementById('asset-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        }}
      />

      {/* Filters */}
      <Card className="sticky top-0 z-20 shadow-sm">
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
              className="px-3 py-2 border border-input rounded-lg bg-background shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 text-sm"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="assigned">Assigned</option>
              <option value="deployed">Deployed</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retired</option>
            </select>
            <select
              value={warrantyFilter}
              onChange={(e) => setWarrantyFilter(e.target.value as 'all' | 'expired' | '30' | '60' | '90')}
              className="px-3 py-2 border border-input rounded-lg bg-background shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 text-sm"
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
              className="px-3 py-2 border border-input rounded-lg bg-background shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 text-sm"
            >
              <option value="all">All Types</option>
              {assetCategories.filter(category=>category.active&&category.name.trim()).map(category=><option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-3 py-2 border border-input rounded-lg bg-background shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 text-sm"
            >
              <option value="all">All Sites</option>
              {sitesList.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 border border-input rounded-lg bg-background shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 text-sm"
            >
              <option value="all">All Departments</option>
              {departments.map(department => <option key={department} value={department}>{department}</option>)}
            </select>
            <select
              value={holderFilter}
              onChange={(e) => setHolderFilter(e.target.value)}
              aria-label="Held by"
              className="px-3 py-2 border border-input rounded-lg bg-background shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="all">Held by: anyone</option>
              <option value="employees">Employees</option>
              {holders.filter(h => h.active !== false && (locationFilter === 'all' || h.siteId === locationFilter)).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
            <Input type="number" min="0" placeholder="Min price" value={minPrice} onChange={e => setMinPrice(e.target.value)} />
            <Input type="number" min="0" placeholder="Max price" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
            <div className="flex items-center justify-between gap-2 sm:col-span-2 lg:col-span-4">
              <span className="text-xs text-muted-foreground">{filteredAssets.length} result{filteredAssets.length === 1 ? '' : 's'} • {activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}</span>
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters} disabled={activeFilterCount === 0}>Clear filters</Button>
            </div>
          </div>
          {activeFilterCount > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
              {searchQuery.trim() && <FilterChip label={`Search: ${searchQuery.trim()}`} onRemove={() => setSearchQuery('')} />}
              {statusFilter !== 'all' && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('all')} />}
              {warrantyFilter !== 'all' && <FilterChip label={`Warranty: ${warrantyFilter === 'expired' ? 'Expired' : `${warrantyFilter} days`}`} onRemove={() => setWarrantyFilter('all')} />}
              {typeFilter !== 'all' && <FilterChip label={`Type: ${typeFilter}`} onRemove={() => setTypeFilter('all')} />}
              {locationFilter !== 'all' && <FilterChip label={`Site: ${sitesList.find(item => item.id === locationFilter)?.name || locationFilter}`} onRemove={() => setLocationFilter('all')} />}
              {departmentFilter !== 'all' && <FilterChip label={`Department: ${departmentFilter}`} onRemove={() => setDepartmentFilter('all')} />}
              {minPrice && <FilterChip label={`Min: ${formatCurrency(Number(minPrice))}`} onRemove={() => setMinPrice('')} />}
              {maxPrice && <FilterChip label={`Max: ${formatCurrency(Number(maxPrice))}`} onRemove={() => setMaxPrice('')} />}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile asset cards */}
      <div className="space-y-3 md:hidden">
        {filteredAssets.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No assets found</CardContent></Card>
        ) : filteredAssets.map(asset => {
          const Icon = getAssetIcon(asset.type);
          const location = sitesList.find(item => item.id === asset.siteId);
          const assignedUser = asset.assignedTo ? usersList.find(item => item.id === asset.assignedTo) : null;
          const days = warrantyDays(asset);
          return (
            <Card key={asset.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="h-5 w-5 text-muted-foreground" /></div>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setViewingAsset(asset)}>
                    <p className="truncate font-semibold">{asset.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{asset.assetTag} · {asset.manufacturer} {asset.model}</p>
                  </button>
                  <AssetActionMenu asset={asset} onLabel={() => setLabelAssets([asset])} onView={() => setViewingAsset(asset)} onHistory={() => setHistoryAsset(asset)} onEdit={() => setEditingAsset(asset)} onMove={()=>setMovingAsset(asset)} onDeploy={['available','deployed'].includes(asset.status)?()=>setDeployingAsset(asset):undefined} onReturnToStock={asset.status==='deployed'?()=>returnAssetToStock(asset):undefined} onTransfer={()=>setTransferringAsset(asset)} onReverseReceipt={isSuperAdmin&&asset.invoiceItemId?()=>setReversingReceipt(asset):undefined} onArchive={() => handleDelete(asset.id)} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className={getStatusBadge(asset.status)}>{asset.status === 'maintenance' ? 'Under Repair' : asset.status === 'deployed' && asset.deployedAt ? `Deployed · ${asset.deployedAt}` : asset.status}</Badge>
                  {days !== null && <Badge variant={days < 0 ? 'destructive' : 'outline'}>{days < 0 ? 'Warranty expired' : `${days}d warranty`}</Badge>}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs text-muted-foreground">{asset.status === 'deployed' ? 'Installed at' : 'Assigned to'}</dt><dd className="mt-0.5 truncate">{asset.status === 'deployed' ? asset.deployedAt || '—' : assignedUser?.name || currentHolder(asset, holders)?.name || 'Unassigned'}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Site</dt><dd className="mt-0.5 truncate">{location?.name || 'Not set'}</dd></div>
                </dl>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop assets table */}
      <Card id="asset-table" className="hidden scroll-mt-40 md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Asset Tag</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Warranty</TableHead>
                <TableHead>Site</TableHead>
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
                  const location = sitesList.find(l => l.id === asset.siteId);
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
                      <TableCell>{masterLabel('asset-categories', asset.type)}</TableCell>
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
                        {assignedUser?.name || (() => { const h = currentHolder(asset, holders); return h ? <span className="italic" title="Held by the site's IT Assets Manager, not assigned to an employee">{h.name}</span> : '-'; })()}
                        {asset.status === 'deployed' && <span className="block text-xs not-italic text-muted-foreground">at {asset.deployedAt || '—'}</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setViewingAsset(asset)}><Eye className="mr-1.5 h-4 w-4" />View</Button>
                          <AssetActionMenu asset={asset} onLabel={() => setLabelAssets([asset])} onView={() => setViewingAsset(asset)} onHistory={() => setHistoryAsset(asset)} onEdit={() => setEditingAsset(asset)} onMove={()=>setMovingAsset(asset)} onDeploy={['available','deployed'].includes(asset.status)?()=>setDeployingAsset(asset):undefined} onReturnToStock={asset.status==='deployed'?()=>returnAssetToStock(asset):undefined} onTransfer={()=>setTransferringAsset(asset)} onReverseReceipt={isSuperAdmin&&asset.invoiceItemId?()=>setReversingReceipt(asset):undefined} onArchive={() => handleDelete(asset.id)} hideView />
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

      </>)}

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
                  <p className="text-xs text-muted-foreground">Archived {asset.archivedAt ? new Date(asset.archivedAt).toLocaleString() : ''}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => restoreAsset(asset)}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Restore
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AssetTransferDialog asset={transferringAsset} companies={companies.filter(c=>c.active&&c.id!==getActiveCompanyId())} onClose={()=>setTransferringAsset(null)} onTransfer={async(targetCompanyId,newAssetTag,reason)=>{if(!transferringAsset)return;try{await transferAsset({sourceCompanyId:getActiveCompanyId()!,targetCompanyId,assetId:transferringAsset.id,newAssetTag,reason});window.location.reload();}catch(error){if(!(error instanceof Error)||!error.message.includes('Only the Super Admin'))throw error;await requestTransfer({requestType:'asset',sourceCompanyId:getActiveCompanyId()!,sourceSiteId:transferringAsset.siteId,targetCompanyId,entityId:transferringAsset.id,newAssetTag,reason});}}} />
      <DeployDialog asset={deployingAsset} places={deployingAsset ? deployedPlaces(assets, deployingAsset.siteId) : []} onClose={() => setDeployingAsset(null)} onConfirm={(where, note) => { if (!deployingAsset) return; const r = deployAsset(deployingAsset, where, currentUser.id, note); onAssetsChange(assets.map(a => (a.id === deployingAsset.id ? r.asset : a))); onHistoryChange([...history, r.history]); toast.success(`${deployingAsset.assetTag} is deployed at ${where}`); setDeployingAsset(null); }} />
      <MoveAssetDialog asset={movingAsset} locations={sitesList} onClose={()=>setMovingAsset(null)} onMove={async(targetSiteId,reason)=>{const companyId=getActiveCompanyId();if(!movingAsset||!companyId)return;if(movingAsset.assignedTo)throw new Error('Return this assigned asset before moving it to another site.');if(['super_admin','admin'].includes(currentUser.role)){onAssetsChange(assets.map(asset=>asset.id===movingAsset.id?{...asset,siteId:targetSiteId,status:'available',deployedAt:undefined,heldBy:defaultHolder(holders,targetSiteId)?.id}:asset));onHistoryChange([...history,{id:`H-${Date.now()}-MOVE`,assetId:movingAsset.id,timestamp:new Date().toISOString(),action:'Moved',performedBy:currentUser.id,from:movingAsset.siteId,to:targetSiteId,siteId:targetSiteId,reason,notes:'Asset moved by Super Admin.'}]);}else{await requestTransfer({requestType:'asset',sourceCompanyId:companyId,sourceSiteId:movingAsset.siteId,targetCompanyId:companyId,targetSiteId,entityId:movingAsset.id,newAssetTag:movingAsset.assetTag,reason});}}} />
      <ReverseReceiptDialog asset={reversingReceipt} onClose={()=>setReversingReceipt(null)} onReverse={async(reason)=>{if(!reversingReceipt)return;const updated=await reverseInvoiceReceipt(reversingReceipt.id,reason) as Asset;onAssetsChange(assets.map(asset=>asset.id===updated.id?updated:asset));onHistoryChange([...history,{id:`H-${Date.now()}-RECEIPT-REVERSED`,assetId:updated.id,timestamp:new Date().toISOString(),action:'Updated',performedBy:currentUser.id,reason,notes:'Invoice receipt reversed by Super Admin.'}]);}} />
      {labelAssets && <Suspense fallback={null}><LabelPrintDialog assets={assets} initialSelection={labelAssets} users={usersList} onClose={() => setLabelAssets(null)} /></Suspense>}

      {/* Create/Edit workspace */}
      <Dialog open={showCreateModal || !!editingAsset} onOpenChange={(open) => {
        if (!open) {
          setShowCreateModal(false);
          setEditingAsset(null);
        }
      }}>
        <DialogContent className="!left-1/2 !top-1/2 !h-auto !max-h-[calc(100dvh-2rem)] !w-[calc(100vw-2rem)] !max-w-[1100px] !-translate-x-1/2 !-translate-y-1/2 overflow-y-auto gap-0 p-0 sm:!p-0">
          <DialogHeader className="sticky top-0 z-10 border-b bg-background/95 px-5 py-5 pr-14 backdrop-blur sm:px-7">
            <DialogTitle>{editingAsset ? 'Edit Asset' : 'Create New Asset'}</DialogTitle>
            <DialogDescription>
              {editingAsset ? 'Update the asset information below.' : 'Fill in the details to add a new asset to your inventory.'}
            </DialogDescription>
          </DialogHeader>
          <AssetForm 
            asset={editingAsset}
            usersList={usersList}
            sitesList={sitesList}
            assetCategories={assetCategories}
            assetTagRules={assetTagRules}
            defaultSiteId={['super_admin','admin'].includes(currentUser.role) ? '' : currentUser.siteId}
            canChooseLocation={['super_admin','admin'].includes(currentUser.role)}
            onSubmit={async (data, detailedProfile) => {
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

                toast.error(
                  `Duplicate asset detected.\n\n${duplicateFields.join(' and ')} already belongs to "${duplicateAsset.name}" (${duplicateAsset.assetTag}).\n\nPlease use a unique Asset Tag and Serial Number.`
                );
                return;
              }

              const normalizedData: Omit<Asset, 'id'> = {
                ...data,
                assignedTo: data.assignedTo || undefined,
                heldBy: data.assignedTo ? undefined : (editingAsset?.heldBy || defaultHolder(holders, data.siteId)?.id),
                status: data.assignedTo ? 'assigned' : data.status,
                deployedAt: !data.assignedTo && data.status === 'deployed' ? (data.deployedAt || '').trim() || undefined : undefined,
              };
              if (normalizedData.status === 'deployed' && !normalizedData.deployedAt) { toast.error('Say where this asset is installed (for example “Server room”).'); return; }

              if (editingAsset) {
                const previous = assets.find(a => a.id === editingAsset.id);
                onAssetsChange(assets.map(a => a.id === editingAsset.id ? { ...a, ...normalizedData } : a));
                void saveDeviceSpec(editingAsset.id, { ...detailedProfile, enabled: detailedProfile.enabled });
                if (previous) {
                  const events = [];
                  if (previous.assignedTo !== normalizedData.assignedTo) {
                    events.push({
                      id: `H-${Date.now()}-ASSIGN`,
                      assetId: previous.id,
                      timestamp: new Date().toISOString(),
                      action: normalizedData.assignedTo ? 'Assigned' as const : 'Returned' as const,
                      performedBy: currentUser.id,
                      from: previous.assignedTo ? usersList.find(u => u.id === previous.assignedTo)?.name : custodianName(),
                      to: normalizedData.assignedTo ? usersList.find(u => u.id === normalizedData.assignedTo)?.name : custodianName(),
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
                    from: JSON.stringify({ name: previous.name, type: previous.type, manufacturer: previous.manufacturer, model: previous.model, serialNumber: previous.serialNumber, assetTag: previous.assetTag, purchaseDate: previous.purchaseDate, purchasePrice: previous.purchasePrice, warrantyExpiry: previous.warrantyExpiry, condition: previous.condition, accessories: previous.accessories, amcProvider: previous.amcProvider, amcExpiry: previous.amcExpiry, insuranceProvider: previous.insuranceProvider, insuranceExpiry: previous.insuranceExpiry, siteId: previous.siteId, notes: previous.notes }),
                    to: JSON.stringify({ name: normalizedData.name, type: normalizedData.type, manufacturer: normalizedData.manufacturer, model: normalizedData.model, serialNumber: normalizedData.serialNumber, assetTag: normalizedData.assetTag, purchaseDate: normalizedData.purchaseDate, purchasePrice: normalizedData.purchasePrice, warrantyExpiry: normalizedData.warrantyExpiry, condition: normalizedData.condition, accessories: normalizedData.accessories, amcProvider: normalizedData.amcProvider, amcExpiry: normalizedData.amcExpiry, insuranceProvider: normalizedData.insuranceProvider, insuranceExpiry: normalizedData.insuranceExpiry, siteId: normalizedData.siteId, notes: normalizedData.notes }),
                    reason: 'Asset details updated.',
                    source: 'assets',
                    entityType: 'Asset',
                    beforeValue: JSON.stringify(previous),
                    afterValue: JSON.stringify({ ...previous, ...normalizedData })
                  });
                  if (events.length) onHistoryChange([...history, ...events]);
                }
              } else {
                const category=assetCategories.find(item=>item.id===normalizedData.type);
                const existingNumbers = [...assets, ...archivedAssets]
                  .map(a => Number(a.id.match(/(\d+)$/)?.[1] || 0))
                  .filter(Number.isFinite);
                const nextNumber = Math.max(0, ...existingNumbers) + 1;
                const draftAsset: Asset = {
                  id: `AST-${String(nextNumber).padStart(3, '0')}`,
                  ...normalizedData
                };
                let newAsset: Asset;
                try {
                  const [created]=await createTaggedAssets(draftAsset.siteId,category?.code||category?.name||draftAsset.type,[draftAsset]);
                  newAsset=created as Asset;
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Could not create the asset.');
                  return;
                }
                onAssetsChange([...assets, newAsset]);
                void loadAssetTagSiteSeries().then(setAssetTagRules);
                void saveDeviceSpec(newAsset.id, { ...detailedProfile, enabled: detailedProfile.enabled });
                onHistoryChange([
                  ...history,
                  {
                    id: `H-${Date.now()}-PURCHASE`,
                    assetId: newAsset.id,
                    timestamp: new Date().toISOString(),
                    action: 'Purchased',
                    performedBy: currentUser.id,
                    to: custodianName(),
                    siteId: newAsset.siteId,
                    cost: newAsset.purchasePrice,
                    notes: 'Asset created in inventory.'
                  },
                  {
                    id: `H-${Date.now()}-RECEIVED`,
                    assetId: newAsset.id,
                    timestamp: new Date().toISOString(),
                    action: 'Received',
                    performedBy: currentUser.id,
                    to: custodianName(),
                    siteId: newAsset.siteId
                  },
                  ...(newAsset.assignedTo ? [{
                    id: `H-${Date.now()}-ASSIGN`,
                    assetId: newAsset.id,
                    timestamp: new Date().toISOString(),
                    action: 'Assigned' as const,
                    performedBy: currentUser.id,
                    from: custodianName(),
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

      <AssetRequestDialog open={showAssetRequest} onClose={() => setShowAssetRequest(false)} sites={sitesList} categories={assetCategories} defaultSiteId={currentUser.siteId} onSent={() => setRequestsRefresh(n => n + 1)} />
      <Dialog open={showMyRequests} onOpenChange={setShowMyRequests}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>My asset requests</DialogTitle><DialogDescription>Requests for assets without an invoice, and what the Super Admin decided.</DialogDescription></DialogHeader>
          <AssetRequestsPanel canDecide={false} refreshKey={requestsRefresh} />
        </DialogContent>
      </Dialog>
      <BatchAssetDialog open={showBatchModal} onClose={()=>setShowBatchModal(false)} sitesList={sitesList} assetCategories={assetCategories} invoices={invoices} isSuperAdmin={isSuperAdmin} defaultSiteId={isSuperAdmin?'':currentUser.siteId} canChooseSite={isSuperAdmin} existingAssets={[...assets,...archivedAssets]} onCreated={created=>{onAssetsChange([...assets,...created]);setShowBatchModal(false);}} />


      <AssetHistoryDialog
        asset={historyAsset}
        users={usersList}
        locations={sitesList}
        history={history}
        open={!!historyAsset}
        onOpenChange={(open) => !open && setHistoryAsset(null)}
      />
    </div>
  );
}

function BatchAssetDialog({open,onClose,sitesList,assetCategories,invoices,isSuperAdmin,defaultSiteId,canChooseSite,existingAssets,onCreated}:{open:boolean;onClose:()=>void;sitesList:Location[];assetCategories:AssetCategory[];invoices:Invoice[];isSuperAdmin:boolean;defaultSiteId:string;canChooseSite:boolean;existingAssets:Asset[];onCreated:(assets:Asset[])=>void}) {
  const [siteId,setSiteId]=useState(defaultSiteId); const [type,setType]=useState(''); const [name,setName]=useState(''); const [manufacturer,setManufacturer]=useState(''); const [model,setModel]=useState(''); const [serials,setSerials]=useState(''); const [invoiceId,setInvoiceId]=useState(''); const [invoiceItemId,setInvoiceItemId]=useState(''); const [purchaseDate,setPurchaseDate]=useState(new Date().toISOString().slice(0,10)); const [purchasePrice,setPurchasePrice]=useState('0'); const [warrantyExpiry,setWarrantyExpiry]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  useEffect(()=>{if(open){setSiteId(defaultSiteId);setType(assetCategories.find(x=>x.active)?.id||'');setName('');setManufacturer('');setModel('');setSerials('');setInvoiceId('');setInvoiceItemId('');setPurchaseDate(new Date().toISOString().slice(0,10));setPurchasePrice('0');setWarrantyExpiry('');setError('');}},[open,defaultSiteId]);
  const invoice=invoices.find(x=>x.id===invoiceId); const lines=(invoice?.lineItems||[]).filter(line=>!line.assetType||line.assetType===type); const selectedLine=lines.find(line=>line.id===invoiceItemId); const remaining=selectedLine?Math.max(0,selectedLine.quantity-selectedLine.receivedQuantity):0;
  const submit=async(e:React.FormEvent)=>{e.preventDefault();const list=serials.split(/[\n,]+/).map(x=>x.trim()).filter(Boolean);const category=assetCategories.find(x=>x.id===type);if(!siteId||!category||!name||!manufacturer||!model||!list.length||(!isSuperAdmin&&(!invoiceId||!invoiceItemId))){setError('Complete all fields and select an invoice line.');return;}if(invoiceId&&(!invoiceItemId||list.length>remaining)){setError(`This invoice line has only ${remaining} item(s) remaining.`);return;}if(new Set(list.map(x=>x.toLowerCase())).size!==list.length){setError('Each serial number must be unique.');return;}setBusy(true);setError('');try{const highest=Math.max(0,...existingAssets.map(a=>Number(a.id.match(/(\d+)$/)?.[1]||0)));const drafts=list.map((serial,index)=>({id:`AST-${String(highest+index+1).padStart(3,'0')}`,name:list.length===1?name:`${name} ${index+1}`,type,manufacturer,model,serialNumber:serial,assetTag:'',status:'available',purchaseDate,purchasePrice:Number(purchasePrice)||0,warrantyExpiry,siteId,invoiceId:invoice?.id||undefined,invoiceItemId:invoiceItemId||undefined,vendorId:invoice?.vendorId||undefined,notes:''}));const created=await createTaggedAssets(siteId,category.code||category.name,drafts,invoiceId,invoiceItemId) as Asset[];onCreated(created);}catch(err){setError(err instanceof Error?err.message:'Could not create the batch.');}finally{setBusy(false);}};
  return <Dialog open={open} onOpenChange={value=>!value&&onClose()}><DialogContent className="max-w-xl"><form onSubmit={submit}><DialogHeader><DialogTitle>Create asset batch</DialogTitle><DialogDescription>{isSuperAdmin?'Select an invoice line or create a direct purchase.':'Select an approved invoice line for your Site.'}</DialogDescription></DialogHeader><div className="grid gap-4 py-5 sm:grid-cols-2"><label className="space-y-1 text-sm">Site {canChooseSite?<select required className="h-10 w-full rounded-md border bg-background px-3" value={siteId} onChange={e=>{setSiteId(e.target.value);setInvoiceId('');setInvoiceItemId('')}}><option value="">Select site</option>{sitesList.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select>:<Input value={sitesList.find(s=>s.id===siteId)?.name||'Your assigned site'} disabled/>}</label><label className="space-y-1 text-sm">Asset type<select required className="h-10 w-full rounded-md border bg-background px-3" value={type} onChange={e=>{setType(e.target.value);setInvoiceItemId('')}}>{assetCategories.filter(x=>x.active).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label className="space-y-1 text-sm sm:col-span-2">Vendor invoice<select required={!isSuperAdmin} className="h-10 w-full rounded-md border bg-background px-3" value={invoiceId} onChange={e=>{setInvoiceId(e.target.value);setInvoiceItemId('')}}>{isSuperAdmin&&<option value="">Direct purchase — no invoice</option>}{invoices.filter(x=>x.siteId===siteId).map(x=><option key={x.id} value={x.id}>{x.invoiceNumber} · {x.invoiceDate}</option>)}</select></label>{invoice&&<label className="space-y-1 text-sm sm:col-span-2">Invoice line<select required className="h-10 w-full rounded-md border bg-background px-3" value={invoiceItemId} onChange={e=>{const id=e.target.value;setInvoiceItemId(id);const line=lines.find(l=>l.id===id);if(line){setName(line.description||'');setManufacturer(line.manufacturer||'');setModel(line.model||'');setPurchasePrice(String(line.unitPrice||0));if(invoice?.invoiceDate)setPurchaseDate(invoice.invoiceDate.slice(0,10));}}}><option value="">Select line item</option>{lines.map(line=><option key={line.id} value={line.id}>{line.description} · remaining {Math.max(0,line.quantity-line.receivedQuantity)} of {line.quantity}</option>)}</select></label>}<label className="space-y-1 text-sm">Item name<Input required value={name} onChange={e=>setName(e.target.value)} placeholder="Keyboard"/></label><label className="space-y-1 text-sm">Manufacturer<Input required value={manufacturer} onChange={e=>setManufacturer(e.target.value)}/></label><label className="space-y-1 text-sm sm:col-span-2">Model<Input required value={model} onChange={e=>setModel(e.target.value)}/></label><label className="space-y-1 text-sm">Purchase date<Input type="date" value={purchaseDate} onChange={e=>setPurchaseDate(e.target.value)}/></label><label className="space-y-1 text-sm">Unit price<Input type="number" min="0" step="0.01" value={purchasePrice} onChange={e=>setPurchasePrice(e.target.value)}/></label><label className="space-y-1 text-sm sm:col-span-2">Warranty expiry (optional)<Input type="date" value={warrantyExpiry} onChange={e=>setWarrantyExpiry(e.target.value)}/></label><label className="space-y-1 text-sm sm:col-span-2">Serial numbers<textarea required className="min-h-24 w-full rounded-md border bg-background p-3 text-sm" value={serials} onChange={e=>setSerials(e.target.value)} placeholder={'One serial per line\nKBD-001\nKBD-002'}/></label>{error&&<p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}</div><DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy}>{busy?'Creating…':'Create batch'}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium capitalize">
      {label}
      <button type="button" onClick={onRemove} className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Remove ${label} filter`}>
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function AssetActionMenu({
  asset,
  onView,
  onHistory,
  onEdit,
  onMove,
  onDeploy,
  onReturnToStock,
  onTransfer,
  onReverseReceipt,
  onLabel,
  onArchive,
  hideView = false,
}: {
  asset: Asset;
  onView: () => void;
  onHistory: () => void;
  onEdit: () => void;
  onMove: () => void;
  /** Offered for available assets (mark as deployed) and deployed ones (change where). */
  onDeploy?: () => void;
  onReturnToStock?: () => void;
  onTransfer: () => void;
  onReverseReceipt?: () => void;
  onLabel?: () => void;
  onArchive: () => void;
  hideView?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${asset.name}`}><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {!hideView && <DropdownMenuItem onSelect={onView}><Eye />View details</DropdownMenuItem>}
        <DropdownMenuItem onSelect={onEdit}><Edit />Edit asset</DropdownMenuItem>
        <DropdownMenuItem onSelect={onHistory}><History />View history</DropdownMenuItem>
        {onLabel&&<DropdownMenuItem onSelect={onLabel}><Printer />Print label</DropdownMenuItem>}
        {onDeploy && <DropdownMenuItem onSelect={onDeploy}><Server />{asset.status === 'deployed' ? 'Change where installed' : 'Mark as deployed'}</DropdownMenuItem>}
        {onReturnToStock && <DropdownMenuItem onSelect={onReturnToStock}><Package />Return to stock</DropdownMenuItem>}
        <DropdownMenuItem onSelect={onMove}><History />Move to site</DropdownMenuItem>
        <DropdownMenuItem onSelect={onTransfer}><Building2 />Transfer to another company</DropdownMenuItem>
        {onReverseReceipt&&<DropdownMenuItem onSelect={onReverseReceipt}>Reverse invoice receipt</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onArchive}><Trash2 />Archive asset</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ReverseReceiptDialog({asset,onClose,onReverse}:{asset:Asset|null;onClose:()=>void;onReverse:(reason:string)=>Promise<void>}) { const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');useEffect(()=>{setReason('');setError('');},[asset?.id]);const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);try{await onReverse(reason);onClose();}catch(err){setError(err instanceof Error?err.message:'Could not reverse receipt.');setBusy(false);}};return <Dialog open={!!asset} onOpenChange={open=>!open&&onClose()}><DialogContent><form onSubmit={submit}><DialogHeader><DialogTitle>Reverse invoice receipt</DialogTitle><DialogDescription>This removes the invoice-line link and reduces its received quantity by one. The asset remains in inventory.</DialogDescription></DialogHeader><label className="block space-y-2 py-5 text-sm">Correction reason<Input required minLength={3} value={reason} onChange={e=>setReason(e.target.value)} /></label>{error&&<p className="text-sm text-destructive">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy} variant="destructive">{busy?'Reversing…':'Reverse receipt'}</Button></DialogFooter></form></DialogContent></Dialog>}

function AssetTransferDialog({asset,companies,onClose,onTransfer}:{asset:Asset|null;companies:Company[];onClose:()=>void;onTransfer:(companyId:string,newTag:string,reason:string)=>Promise<void>}) {
  const [companyId,setCompanyId]=useState(''); const [tag,setTag]=useState(''); const [reason,setReason]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  useEffect(()=>{if(asset){setCompanyId(companies[0]?.id||'');setTag(asset.assetTag);setReason('');setError('');setBusy(false);}},[asset?.id]);
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{await onTransfer(companyId,tag.trim(),reason.trim());}catch(err){setError(err instanceof Error?err.message:String(err));setBusy(false);}};
  return <Dialog open={!!asset} onOpenChange={open=>!open&&onClose()}><DialogContent><form onSubmit={submit}><DialogHeader><DialogTitle>Transfer asset to another company</DialogTitle><DialogDescription>Super Admin completes the transfer immediately. Site IT Admins submit this as a transfer request for Super Admin approval.</DialogDescription></DialogHeader><div className="space-y-4 py-5"><div className="rounded-lg border bg-muted/30 p-3 text-sm"><span className="font-medium">{asset?.name}</span><span className="ml-2 font-mono text-xs text-muted-foreground">{asset?.assetTag}</span></div>{companies.length===0&&<p className="rounded-md border border-chart-5/30 bg-chart-5/10 p-3 text-sm">Create another active company in Settings before transferring this asset.</p>}<label className="block space-y-1.5 text-sm">Target company<select required className="h-10 w-full rounded-md border bg-background px-3" value={companyId} onChange={e=>setCompanyId(e.target.value)}><option value="">Select company</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="block space-y-1.5 text-sm">Asset tag in target company<Input required value={tag} onChange={e=>setTag(e.target.value)}/></label><label className="block space-y-1.5 text-sm">Transfer reason<Input required value={reason} onChange={e=>setReason(e.target.value)}/></label>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}</div><DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy||!companyId}>{busy?'Submitting…':'Submit transfer'}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function MoveAssetDialog({asset,locations,onClose,onMove}:{asset:Asset|null;locations:Location[];onClose:()=>void;onMove:(siteId:string,reason:string)=>Promise<void>}) {
  const [siteId,setSiteId]=useState(''); const [reason,setReason]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const destinations=locations.filter(location=>location.id!==asset?.siteId);
  useEffect(()=>{if(asset){setSiteId(destinations[0]?.id||'');setReason('');setError('');setBusy(false);}},[asset?.id]);
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{await onMove(siteId,reason.trim());onClose();}catch(err){setError(err instanceof Error?err.message:String(err));setBusy(false);}};
  return <Dialog open={!!asset} onOpenChange={open=>!open&&onClose()}><DialogContent><form onSubmit={submit}><DialogHeader><DialogTitle>Move asset to another site</DialogTitle><DialogDescription>This keeps the asset in the same company. Site IT Admins submit the move for Super Admin approval.</DialogDescription></DialogHeader><div className="space-y-4 py-5"><div className="rounded-lg border bg-muted/30 p-3 text-sm"><span className="font-medium">{asset?.name}</span><span className="ml-2 font-mono text-xs text-muted-foreground">{asset?.assetTag}</span></div><label className="block space-y-1.5 text-sm">Target site<select required className="h-10 w-full rounded-md border bg-background px-3" value={siteId} onChange={e=>setSiteId(e.target.value)}><option value="">Select site</option>{destinations.map(location=><option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label className="block space-y-1.5 text-sm">Move reason<Input required value={reason} onChange={e=>setReason(e.target.value)}/></label>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}</div><DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy||!siteId}>{busy?'Submitting…':'Move asset'}</Button></DialogFooter></form></DialogContent></Dialog>;
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

function AssetForm({ asset, usersList, sitesList, assetCategories, assetTagRules, defaultSiteId, canChooseLocation, onSubmit, onCancel }: {
  asset: Asset | null;
  usersList: User[];
  sitesList: Location[];
  assetCategories: AssetCategory[];
  assetTagRules: AssetTagSiteSeries[];
  defaultSiteId: string;
  canChooseLocation: boolean;
  onSubmit: (data: Omit<Asset, 'id'>, profile: DetailedProfileDraft) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [conditionOptions]=useCollection<MasterDataOption>('asset-conditions');
  const [detailedProfileEnabled, setDetailedProfileEnabled] = useState(true);
  const [profile, setProfile] = useState<DetailedProfileDraft>(() => {
    if (!asset) return emptyDetailedProfile();
    return { ...emptyDetailedProfile(), ...(getDeviceSpec(asset.id) || {}), enabled: true } as DetailedProfileDraft;
  });

  useEffect(() => {
    setDetailedProfileEnabled(true);
    if (asset) {
      setProfile({ ...emptyDetailedProfile(), ...(getDeviceSpec(asset.id) || {}), enabled: true } as DetailedProfileDraft);
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
    condition: asset?.condition || 'good',
    accessories: asset?.accessories || '',
    amcProvider: asset?.amcProvider || '',
    amcExpiry: asset?.amcExpiry || '',
    insuranceProvider: asset?.insuranceProvider || '',
    insuranceExpiry: asset?.insuranceExpiry || '',
    siteId: asset?.siteId || defaultSiteId,
    assignedTo: asset?.assignedTo || '',
    deployedAt: asset?.deployedAt || '',
    notes: asset?.notes || ''
  });
  const [activeSection, setActiveSection] = useState<'general' | 'lifecycle' | 'technical'>('general');
  const isCreating = !asset;
  const selectedLocationName = sitesList.find(location => location.id === formData.siteId)?.name || 'Your assigned site';
  const tagRule=assetTagRules.find(rule=>rule.active&&rule.siteId===formData.siteId);
  useEffect(()=>{if(!isCreating||!tagRule)return;const typeCode=assetCategories.find(item=>item.id===formData.type)?.code||assetCategories.find(item=>item.id===formData.type)?.name||'';setFormData(current=>({...current,assetTag:[tagRule.companyPrefix,tagRule.useFunctionPrefix===false?'':tagRule.functionPrefix,typeCode,`${tagRule.series}${String(tagRule.nextNumber).padStart(tagRule.digits,'0')}`].filter(Boolean).join(tagRule.separator??'-')}));},[formData.siteId,formData.type,tagRule?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSubmit(formData, { ...profile, enabled: detailedProfileEnabled });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-0">
      {!isCreating && <div className="border-b bg-muted/20 px-5 py-3 sm:px-7" role="tablist" aria-label="Asset form sections">
      <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
        {([
          ['general', 'Core details'],
          ['lifecycle', 'Coverage'],
          ['technical', 'Technical profile'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={activeSection === value}
            onClick={() => setActiveSection(value)}
            className={`rounded px-2 py-2 text-xs font-medium transition-colors sm:text-sm ${activeSection === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {label}
          </button>
        ))}
      </div>
      </div>
      }

      {!isCreating && activeSection === 'technical' && <div className="space-y-5 px-5 py-6 sm:px-7">
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
      </div>}

      {activeSection === 'general' && <div className="grid grid-cols-1 gap-x-5 gap-y-4 px-5 py-6 sm:grid-cols-2 sm:px-7 xl:grid-cols-3">
        <div className="sm:col-span-2 xl:col-span-3">
          <p className="text-sm font-semibold">Asset identity</p>
          <p className="mt-1 text-xs text-muted-foreground">Use the name, tag and serial number that identify this item in your inventory.</p>
        </div>
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
          <p className="text-[11px] leading-4 text-muted-foreground">
            Must be unique. AssetFlow will check for duplicates before saving.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as AssetType })}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 text-sm"
          >
            {!assetCategories.some(category=>category.id===formData.type)&&<option value={formData.type}>{formData.type}</option>}
            {assetCategories.filter(category=>(category.active&&category.name.trim())||category.id===formData.type).map(category=><option key={category.id} value={category.id}>{category.name||'Unnamed category'}</option>)}
          </select>
        </div>
        {!isCreating && <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <select
            value={formData.status}
            onChange={(e) => {
              const status = e.target.value as AssetStatus;
              setFormData({
                ...formData,
                status,
                assignedTo: status === 'assigned' ? formData.assignedTo : '',
                deployedAt: status === 'deployed' ? formData.deployedAt : ''
              });
            }}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 text-sm"
          >
            <option value="available">Available</option>
            <option value="assigned">Assigned</option>
            <option value="deployed">Deployed (installed on site)</option>
            <option value="maintenance">Under Repair</option>
            <option value="retired">Retired</option>
            <option value="disposed">Disposed</option>
            <option value="lost">Lost</option>
          </select>
        </div>}
        {!isCreating && formData.status === 'deployed' && <div className="space-y-2">
          <label className="text-sm font-medium">Where is it installed?</label>
          <Input required value={formData.deployedAt || ''} onChange={(e) => setFormData({ ...formData, deployedAt: e.target.value })} placeholder="Server room, Gate 1, Reception…" />
        </div>}
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
          <p className="text-[11px] leading-4 text-muted-foreground">
            Must be unique. Duplicate serial numbers cannot be saved.
          </p>
        </div>
        <div className="mt-2 border-t pt-5 sm:col-span-2 xl:col-span-3">
          <p className="text-sm font-semibold">Placement & assignment</p>
          <p className="mt-1 text-xs text-muted-foreground">{isCreating ? 'New assets start as Available and Unassigned.' : 'Choose where the asset belongs. Assignment is optional and can be changed later.'}</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Site</label>
          {canChooseLocation || !isCreating ? <select
            value={formData.siteId}
            onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 text-sm"
          >
            <option value="">Select site</option>
            {sitesList.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select> : <Input value={selectedLocationName} disabled aria-label="Assigned site" />}
        </div>
        {!isCreating && <div className="space-y-2">
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
            className="w-full px-3 py-2 border border-input rounded-lg bg-background shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 text-sm"
          >
            <option value="">Unassigned</option>
            {usersList.filter(user => user.status !== 'left' && (isEmployee(user) || user.id === formData.assignedTo)).map(user => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.department})
              </option>
            ))}
          </select>
          <p className="text-[11px] leading-4 text-muted-foreground">
            Selecting a user marks this asset as assigned.
          </p>
        </div>}
        {!isCreating && <><div className="mt-2 border-t pt-5 sm:col-span-2 xl:col-span-3">
          <p className="text-sm font-semibold">Purchase & warranty</p>
          <p className="mt-1 text-xs text-muted-foreground">Keep the commercial record here; service and insurance coverage stay in the next tab.</p>
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
        <div className="mt-2 space-y-2 border-t pt-5 sm:col-span-2 xl:col-span-3">
          <label className="text-sm font-medium">Notes</label>
          <textarea
            className="w-full px-3 py-2 border border-input rounded-lg bg-background shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 text-sm min-h-[80px]"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </div></>}
      </div>}

      {!isCreating && activeSection === 'lifecycle' && (
        <div className="space-y-5 px-5 py-6 sm:px-7">
          <div>
            <p className="text-sm font-semibold">Coverage & condition</p>
            <p className="text-xs text-muted-foreground">Optional details for handover items, AMC and insurance. Purchase warranty is recorded under Core details.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Condition</label>
              <select value={formData.condition || 'good'} onChange={(e) => setFormData({ ...formData, condition: e.target.value as Asset['condition'] })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                {conditionOptions.filter(option=>option.active&&option.id!=='missing').map(option=><option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Accessories / Handover Items</label>
              <Input value={formData.accessories || ''} onChange={(e) => setFormData({ ...formData, accessories: e.target.value })} placeholder="Charger, dock, bag, keyboard, adapter..." />
            </div>
            <div className="space-y-2"><label className="text-sm font-medium">AMC Provider</label><Input value={formData.amcProvider || ''} onChange={(e) => setFormData({ ...formData, amcProvider: e.target.value })} /></div>
            <div className="space-y-2"><label className="text-sm font-medium">AMC Expiry</label><Input type="date" value={formData.amcExpiry || ''} onChange={(e) => setFormData({ ...formData, amcExpiry: e.target.value })} /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Insurance Provider</label><Input value={formData.insuranceProvider || ''} onChange={(e) => setFormData({ ...formData, insuranceProvider: e.target.value })} /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Insurance Expiry</label><Input type="date" value={formData.insuranceExpiry || ''} onChange={(e) => setFormData({ ...formData, insuranceExpiry: e.target.value })} /></div>
          </div>
        </div>
      )}
      <DialogFooter className="sticky bottom-0 z-10 border-t bg-background/95 px-5 py-4 backdrop-blur sm:px-7">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{asset ? 'Update' : 'Create'} Asset</Button>
      </DialogFooter>
    </form>
  );
}

