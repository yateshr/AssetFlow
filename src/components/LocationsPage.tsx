import { useState } from 'react';
import { Plus, Search, Edit, Trash2, MapPin, Users, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  assets,
  type Location, 
  formatDate 
} from '@/data/sampleData';

interface LocationsPageProps {
  locationsList: Location[];
  onLocationsChange: (locations: Location[]) => void;
}

export function LocationsPage({ locationsList, onLocationsChange }: LocationsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'office' | 'warehouse' | 'remote'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  const filteredLocations = locationsList.filter(location => {
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
    return variants[type as keyof typeof variants];
  };

  const getAssetCount = (locationId: string) => {
    return assets.filter(a => a.location === locationId).length;
  };

  const handleDelete = (id: string) => {
    const assetCount = getAssetCount(id);
    if (assetCount > 0) {
      alert(`Cannot delete location. ${assetCount} asset(s) are assigned to this location.`);
      return;
    }
    if (confirm('Are you sure you want to delete this location?')) {
      onLocationsChange(locationsList.filter(l => l.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Locations</h1>
          <p className="text-muted-foreground">Manage office locations and facilities</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Location
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
                placeholder="Search by name, address, or manager..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="all">All Types</option>
              <option value="office">Office</option>
              <option value="warehouse">Warehouse</option>
              <option value="remote">Remote</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Locations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLocations.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No locations found
          </div>
        ) : (
          filteredLocations.map((location) => {
            const assetCount = getAssetCount(location.id);
            return (
              <Card key={location.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{location.name}</h3>
                        <Badge variant="outline" className={getTypeBadge(location.type)}>
                          {location.type}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditingLocation(location)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(location.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-muted-foreground">{location.address}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Manager: {location.manager}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div>
                        <p className="text-xs text-muted-foreground">Capacity</p>
                        <p className="font-medium text-foreground">{location.capacity}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Assets</p>
                        <p className="font-medium text-foreground">{assetCount}</p>
                      </div>
                    </div>
                  </div>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Edit Location' : 'Add New Location'}</DialogTitle>
            <DialogDescription>
              {editingLocation ? 'Update location information below.' : 'Fill in the details to add a new location.'}
            </DialogDescription>
          </DialogHeader>
          <LocationForm 
            location={editingLocation}
            onSubmit={(data) => {
              if (editingLocation) {
                onLocationsChange(locationsList.map(l => l.id === editingLocation.id ? { ...l, ...data } : l));
              } else {
                const newLocation: Location = {
                  id: `LOC-${String(locationsList.length + 1).padStart(3, '0')}`,
                  ...data
                };
                onLocationsChange([...locationsList, newLocation]);
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
    </div>
  );
}

function LocationForm({ location, onSubmit, onCancel }: { 
  location: Location | null; 
  onSubmit: (data: Omit<Location, 'id'>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Omit<Location, 'id'>>({
    name: location?.name || '',
    address: location?.address || '',
    type: location?.type || 'office',
    capacity: location?.capacity || 0,
    manager: location?.manager || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Location Name</label>
        <Input
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Address</label>
        <Input
          required
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
          >
            <option value="office">Office</option>
            <option value="warehouse">Warehouse</option>
            <option value="remote">Remote</option>
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
        <label className="text-sm font-medium">Manager</label>
        <Input
          required
          value={formData.manager}
          onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{location ? 'Update' : 'Create'} Location</Button>
      </DialogFooter>
    </form>
  );
}
