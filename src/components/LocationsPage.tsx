import { getCollection } from '@/lib/db';
import { HolderEditor } from './HolderEditor';
import { renameStockHolders, stockHolderName, type Holder } from '@/lib/holders';
import { masterLabel } from '@/lib/masterLabel';
import { confirmDialog } from '@/components/ConfirmHost';
import { toast } from 'sonner';
import { ExportMenu } from '@/components/ExportMenu';
import { useCollection } from '@/lib/db';
import type { MasterDataOption } from '@/data/masterData';
import { useState } from 'react';
import { Plus, Search, Edit, Trash2, MapPin, Users, Building2, Network, UserRound, Layers, Package, Hash } from 'lucide-react';
import { isEmployee } from '@/lib/people';
import type { User } from '@/data/models';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { TimeZoneSelect } from '@/components/ui/timezone-select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { City, Country, State } from 'country-state-city';
import { 

  type Asset,
  type Location, type SiteArea,
  formatDate 
} from '@/data/models';

interface LocationsPageProps {
  sitesList: Location[];
  onSitesChange: (locations: Location[]) => void;
  /** Super Admin only: add and delete sites. A site IT admin can still edit their own site. */
  canManage?: boolean;
}

export function LocationsPage({ sitesList, onSitesChange, canManage = true }: LocationsPageProps) {
  const [locationTypes]=useCollection<MasterDataOption>('location-types');
  const [siteAreas,setSiteAreas]=useCollection<SiteArea>('site-areas');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'office' | 'warehouse' | 'remote'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [holders, setHolders] = useCollection<Holder>('holders');
  const [spacesLocation,setSpacesLocation]=useState<Location|null>(null);
  const [allAssets] = useCollection<Asset>('assets');
  const [allUsers] = useCollection<User>('users');
  const [allDepartments] = useCollection<{ id: string; name: string; siteId?: string }>('departments');

  const filteredLocations = sitesList.filter(location => {
    const matchesSearch = searchQuery === '' || 
      location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      location.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      location.manager.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter === 'all' || location.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const getTypeBadge = (type: string) => {
    const variants = {
      office: 'bg-primary/10 text-primary border-primary/20',
      warehouse: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
      remote: 'bg-muted text-muted-foreground border-muted'
    };
    return variants[type as keyof typeof variants] || 'bg-muted text-muted-foreground border-muted';
  };

  const getAssetCount = (siteId: string) => {
    return allAssets.filter(a => a.siteId === siteId && !a.archivedAt).length;
  };

  const handleDelete = async (id: string) => {
    const assetCount = getAssetCount(id);
    if (assetCount > 0) {
      toast.error(`Cannot delete location. ${assetCount} asset(s) are assigned to this location.`);
      return;
    }
    if (await confirmDialog({ title: 'Delete site?', message: 'Are you sure you want to delete this site?', destructive: true })) {
      onSitesChange(sitesList.filter(l => l.id !== id));
    }
  };

  return (
    <div className="af-stagger space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Sites</h1>
          <p className="text-muted-foreground">Manage offices, plants, warehouses and facilities</p>
        </div>
        <div className="flex flex-wrap gap-2">
        <ExportMenu disabled={filteredLocations.length === 0} build={() => ({
          name: 'sites', sheet: 'Sites',
          headers: ['Site Code', 'Name', 'Type', 'Address', 'Building', 'City', 'State', 'Country', 'Timezone', 'Site Contact Person', 'Capacity'],
          rows: filteredLocations.map(l => [l.siteCode || '', l.name, masterLabel('location-types', l.type), l.address, l.building || '', l.city || '', l.state || '', l.country || '', l.timezone || '', l.manager, l.capacity]),
        })} />
        {canManage && <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Site
        </Button>}
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
                placeholder="Search by name, address, or contact person..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-2 border border-input rounded-lg bg-background shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 text-sm"
            >
              <option value="all">All Types</option>
              {locationTypes.filter(option=>option.active).map(option=><option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Locations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLocations.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No sites found
          </div>
        ) : (
          filteredLocations.map((location) => {
            const assetCount = getAssetCount(location.id);
            const employeeCount = allUsers.filter(u => isEmployee(u) && u.siteId === location.id && u.status === 'active').length;
            const departmentCount = allDepartments.filter(d => d.siteId === location.id).length;
            const holder = holders.find(h => h.siteId === location.id && h.active !== false);
            const place = [location.city, location.state, location.country].filter(Boolean).join(', ');
            const stats: Array<[string, number | string, typeof Layers]> = [['Departments', departmentCount, Layers], ['Employees', employeeCount, Users], ['Assets', assetCount, Package], ['Capacity', location.capacity || '—', Hash]];
            return (
              <Card key={location.id} className="overflow-hidden transition-shadow hover:shadow-md">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold leading-tight text-foreground">{location.name}</h3>
                        <Badge variant="outline" className={`${getTypeBadge(location.type)} text-[11px]`}>{masterLabel('location-types', location.type)}</Badge>
                      </div>
                      {(place || location.address) && <p className="mt-1 flex items-start gap-1.5 text-xs leading-snug text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{place || location.address}</span></p>}
                    </div>
                    <div className="-mr-1 -mt-1 flex shrink-0 gap-0.5">
                      <Button variant="ghost" size="icon-sm" title="Edit site" onClick={() => setEditingLocation(location)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon-sm" title="Manage building, floor, room and rack hierarchy" onClick={()=>setSpacesLocation(location)}><Network className="h-4 w-4"/></Button>
                      {canManage && <Button variant="ghost" size="icon-sm" title="Delete site" onClick={() => handleDelete(location.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {stats.map(([label, value, Icon]) => (
                      <div key={label} className="rounded-lg border bg-muted/30 px-2 py-2 text-center">
                        <Icon className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
                        <p className="mt-1 text-lg font-semibold leading-none tabular-nums text-foreground">{value}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>

                  <dl className="space-y-1.5 border-t pt-3 text-sm">
                    <div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2 text-muted-foreground"><UserRound className="h-4 w-4" /> IT Assets Manager</dt><dd className="min-w-0 truncate text-right font-medium text-foreground" title={holder?.name}>{holder?.name || <span className="font-normal text-amber-600 dark:text-amber-400">Not set up</span>}</dd></div>
                    <div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /> Site Contact Person</dt><dd className="min-w-0 truncate text-right text-foreground">{location.manager || '—'}</dd></div>
                    {location.siteCode && <div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2 text-muted-foreground"><Hash className="h-4 w-4" /> Site Code</dt><dd className="text-right tabular-nums text-foreground">{location.siteCode}</dd></div>}
                  </dl>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal || !!editingLocation} onOpenChange={(open) => {
        if (!open) {
          setShowCreateModal(false);
          setEditingLocation(null);
        }
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Edit Site' : 'Add New Site'}</DialogTitle>
            <DialogDescription>
              {editingLocation ? 'Update site information below.' : 'Fill in the details to add a new site.'}
            </DialogDescription>
          </DialogHeader>
          {editingLocation && canManage && <HolderEditor siteId={editingLocation.id} siteName={editingLocation.name} assets={getCollection<Asset>('assets')} />}
          <LocationForm 
            location={editingLocation}
            locationTypes={locationTypes}
            onSubmit={(data, options) => {
              if (editingLocation) {
                onSitesChange(sitesList.map(l => l.id === editingLocation.id ? { ...l, ...data } : l));
                // A holder still carrying the automatic name follows the site's new name; a name someone chose is left alone.
                const renamed = renameStockHolders(holders, editingLocation.id, editingLocation.name, data.name);
                if (renamed !== holders) setHolders(renamed);
              } else {
                const newLocation: Location = {
                  id: `LOC-${String(sitesList.length + 1).padStart(3, '0')}`,
                  ...data
                };
                onSitesChange([...sitesList, newLocation]);
                if (options.createStockHolder) {
                  setHolders([...holders, { id: `HLD-${crypto.randomUUID().slice(0, 8)}`, siteId: newLocation.id, kind: 'stock', name: stockHolderName(data.name), active: true }]);
                }
              }
              setShowCreateModal(false);
              setEditingLocation(null);
            }}
            onCancel={() => {
              setShowCreateModal(false);
              setEditingLocation(null);
            }}
          />
        </DialogContent>
      </Dialog>
      <SiteAreasDialog location={spacesLocation} areas={siteAreas.filter(a=>a.siteId===spacesLocation?.id)} onChange={next=>setSiteAreas([...siteAreas.filter(a=>a.siteId!==spacesLocation?.id),...next])} onClose={()=>setSpacesLocation(null)}/>
    </div>
  );
}

function SiteAreasDialog({location,areas,onChange,onClose}:{location:Location|null;areas:SiteArea[];onChange:(areas:SiteArea[])=>void;onClose:()=>void}) {
  const [name,setName]=useState(''); const [type,setType]=useState<SiteArea['type']>('building'); const [parentId,setParentId]=useState(''); const [code,setCode]=useState('');
  const add=(e:React.FormEvent)=>{e.preventDefault();if(!location)return;onChange([...areas,{id:crypto.randomUUID(),siteId:location.id,parentId:parentId||undefined,name:name.trim(),type,code:code.trim()}]);setName('');setCode('');};
  const depth=(area:SiteArea):number=>area.parentId?1+depth(areas.find(a=>a.id===area.parentId)??{...area,parentId:undefined}):0;
  return <Dialog open={!!location} onOpenChange={open=>!open&&onClose()}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{location?.name} spaces</DialogTitle><DialogDescription>Build the operational hierarchy used to locate assets precisely: building, floor, room, zone or rack.</DialogDescription></DialogHeader><form onSubmit={add} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_130px_1fr_110px_auto]"><Input required placeholder="Name" value={name} onChange={e=>setName(e.target.value)}/><select className="h-9 rounded-md border bg-background px-2 text-sm" value={type} onChange={e=>setType(e.target.value as SiteArea['type'])}><option value="building">Building</option><option value="floor">Floor</option><option value="room">Room</option><option value="zone">Zone</option><option value="rack">Rack</option></select><select className="h-9 rounded-md border bg-background px-2 text-sm" value={parentId} onChange={e=>setParentId(e.target.value)}><option value="">Top level</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><Input placeholder="Code" value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/><Button>Add</Button></form><div className="max-h-80 overflow-y-auto rounded-lg border">{areas.length===0?<p className="p-5 text-sm text-muted-foreground">No spaces configured for this site.</p>:areas.map(area=><div key={area.id} className="flex items-center gap-3 border-b p-3 last:border-0" style={{paddingLeft:12+depth(area)*24}}><Building2 className="h-4 w-4 text-muted-foreground"/><div className="flex-1"><p className="text-sm font-medium">{area.name}</p><p className="text-xs capitalize text-muted-foreground">{area.type}{area.code?` · ${area.code}`:''}</p></div><Button variant="ghost" size="icon-sm" title="Delete space" onClick={()=>onChange(areas.filter(a=>a.id!==area.id&&a.parentId!==area.id))}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>)}</div><DialogFooter><Button variant="outline" onClick={onClose}>Done</Button></DialogFooter></DialogContent></Dialog>;
}

function LocationForm({ location, locationTypes, onSubmit, onCancel }: {
  location: Location | null; 
  locationTypes: MasterDataOption[];
  onSubmit: (data: Omit<Location, 'id'>, options: { createStockHolder: boolean }) => void;
  onCancel: () => void;
}) {
  const [createStockHolder, setCreateStockHolder] = useState(true);
  const [formData, setFormData] = useState<Omit<Location, 'id'>>({
    name: location?.name || '',
    address: location?.address || '',
    type: location?.type || 'office',
    capacity: location?.capacity || 0,
    manager: location?.manager || '',
    country: location?.country || '',
    state: location?.state || '',
    city: location?.city || '',
    siteCode: location?.siteCode || '',
    timezone: location?.timezone || ''
  });

  const countries=Country.getAllCountries();
  const selectedCountry=countries.find(country=>country.name===formData.country);
  const states=selectedCountry?State.getStatesOfCountry(selectedCountry.isoCode):[];
  const selectedState=states.find(state=>state.name===formData.state);
  const cities=selectedCountry&&selectedState?City.getCitiesOfState(selectedCountry.isoCode,selectedState.isoCode):[];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData, { createStockHolder });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <label className="text-sm font-medium">Site name</label>
        <Input
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>
      <div className="space-y-2"><label className="text-sm font-medium">Site Code</label><Input required placeholder="MUM-01" value={formData.siteCode} onChange={e=>setFormData({...formData,siteCode:e.target.value.toUpperCase()})}/></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2"><label className="text-sm font-medium">Country</label><SearchableSelect value={formData.country||''} options={countries.map(country=>({value:country.name,label:country.name,keywords:country.isoCode}))} onChange={country=>setFormData({...formData,country,state:'',city:''})} placeholder="Select country" searchPlaceholder="Type country name..."/></div>
        <div className="space-y-2"><label className="text-sm font-medium">State / province</label><SearchableSelect disabled={!selectedCountry} value={formData.state||''} options={states.map(state=>({value:state.name,label:state.name,keywords:state.isoCode}))} onChange={state=>setFormData({...formData,state,city:''})} placeholder={selectedCountry?'Select state / province':'Select country first'} searchPlaceholder="Type state or province..."/></div>
        <div className="space-y-2"><label className="text-sm font-medium">City</label><SearchableSelect disabled={!selectedState} value={formData.city||''} options={cities.map(city=>({value:city.name,label:city.name}))} onChange={city=>setFormData({...formData,city})} placeholder={selectedState?'Select city':'Select state first'} searchPlaceholder="Type city name..."/></div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Address</label>
        <Input
          required
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        />
      </div>
      <div className="space-y-2"><label className="text-sm font-medium">Timezone</label><TimeZoneSelect required={false} value={formData.timezone||''} onChange={timezone=>setFormData({...formData,timezone})}/></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 text-sm"
          >
            {locationTypes.filter(option=>option.active||option.id===formData.type).map(option=><option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Capacity</label>
          <Input
            type="number"
            required
            value={formData.capacity}
            onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Site Contact Person</label>
        <Input
          required
          value={formData.manager}
          onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
        />
      </div>
      {!location && (
        <label className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={createStockHolder} onChange={e => setCreateStockHolder(e.target.checked)} />
          <span><b>Create the IT Assets Manager “{stockHolderName(formData.name || 'this site')}”</b><br /><span className="text-xs text-muted-foreground">It holds everything at this site that is not given to an employee: new and spare assets in stock, and equipment deployed on site.</span></span>
        </label>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{location ? 'Update' : 'Create'} Site</Button>
      </DialogFooter>
    </form>
  );
}
