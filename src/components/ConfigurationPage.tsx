import { useMemo, useState } from 'react';
import { Building2, Check, Hash, Plus, Save, Trash2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  loadConfig,
  saveConfig,
  createEmptyConfig,
  type AssetFlowConfig,
  type ConfigEntity,
  type NumberingComponentType,
} from '@/lib/assetflowConfig';
import type { Location, User } from '@/data/models';


const CURRENCY_OPTIONS = [
  ['INR', 'INR — Indian Rupee (₹)'],
  ['USD', 'USD — US Dollar ($)'],
  ['EUR', 'EUR — Euro (€)'],
  ['GBP', 'GBP — British Pound (£)'],
  ['AED', 'AED — UAE Dirham'],
  ['SAR', 'SAR — Saudi Riyal'],
  ['JPY', 'JPY — Japanese Yen (¥)'],
  ['CNY', 'CNY — Chinese Yuan (¥)'],
  ['AUD', 'AUD — Australian Dollar (A$)'],
  ['CAD', 'CAD — Canadian Dollar (C$)'],
  ['SGD', 'SGD — Singapore Dollar (S$)'],
] as const;

const TIMEZONE_OPTIONS = [
  ['UTC', 'UTC'],
  ['Asia/Kolkata', 'Asia/Kolkata — India Standard Time'],
  ['Asia/Dubai', 'Asia/Dubai — Gulf Standard Time'],
  ['Asia/Singapore', 'Asia/Singapore — Singapore Time'],
  ['Asia/Tokyo', 'Asia/Tokyo — Japan Standard Time'],
  ['Asia/Shanghai', 'Asia/Shanghai — China Standard Time'],
  ['Europe/London', 'Europe/London — United Kingdom'],
  ['Europe/Paris', 'Europe/Paris — Central European Time'],
  ['America/New_York', 'America/New_York — Eastern Time'],
  ['America/Los_Angeles', 'America/Los_Angeles — Pacific Time'],
] as const;


interface ConfigurationPageProps {
  usersList: User[];
  onUsersChange: (users: User[]) => void;
  locationsList: Location[];
  onLocationsChange: (locations: Location[]) => void;
}

const inputClass =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

const componentLabels: Record<NumberingComponentType, string> = {
  'company-prefix': 'Company Prefix',
  'category-prefix': 'Category Prefix',
  'asset-type-code': 'Asset Type Code',
  'location-code': 'Location Code',
  sequence: 'Sequence',
};

function newEntity(): ConfigEntity {
  return {
    id: crypto.randomUUID(),
    name: '',
    code: '',
    active: true,
  };
}

export function ConfigurationPage({
  usersList,
  onUsersChange,
  locationsList,
  onLocationsChange,
}: ConfigurationPageProps) {
  const [config, setConfig] = useState<AssetFlowConfig>(() => loadConfig());
  const [saved, setSaved] = useState(false);

  const activeRule = useMemo(
    () => config.numbering.rules.find(r => r.id === config.numbering.activeRuleId),
    [config.numbering.rules, config.numbering.activeRuleId],
  );

  const update = (patch: Partial<AssetFlowConfig>) =>
    setConfig(current => ({ ...current, ...patch }));

  const save = () => {
    saveConfig(config);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const reset = () => {
    if (!window.confirm('Clear the local AssetFlow configuration and start a new organization setup?')) return;
    const empty = createEmptyConfig();
    setConfig(empty);
    saveConfig(empty);
  };

  const addLocation = () => {
    const name = window.prompt('Location name');
    if (!name?.trim()) return;

    const value = name.trim();
    if (locationsList.some(l => l.name.trim().toLowerCase() === value.toLowerCase())) return;

    onLocationsChange([
      ...locationsList,
      {
        id: crypto.randomUUID(),
        name: value,
      } as Location,
    ]);
  };

  const deleteLocation = (location: Location) => {
    const affectedUsers = usersList.filter(user => user.locationId === location.id).length;

    const confirmed = window.confirm(
      affectedUsers
        ? `Delete "${location.name}"? ${affectedUsers} user${affectedUsers === 1 ? '' : 's'} will become without location.`
        : `Delete "${location.name}"?`
    );
    if (!confirmed) return;

    onLocationsChange(locationsList.filter(item => item.id !== location.id));

    if (affectedUsers) {
      onUsersChange(
        usersList.map(user =>
          user.locationId === location.id
            ? { ...user, locationId: '' }
            : user
        )
      );
    }
  };

  const addEntity = () => {
    const entity = newEntity();
    setConfig(current => ({
      ...current,
      assetTypes: [...current.assetTypes, entity],
    }));
  };

  const updateEntity = (id: string, patch: Partial<ConfigEntity>) => {
    setConfig(current => ({
      ...current,
      assetTypes: current.assetTypes.map(item => item.id === id ? { ...item, ...patch } : item),
    }));
  };

  const removeAssetType = (id: string) => {
    setConfig(current => ({
      ...current,
      assetTypes: current.assetTypes.filter(item => item.id !== id),
    }));
  };

  const addRule = () => {
    const rule = {
      id: crypto.randomUUID(),
      name: '',
      separator: '',
      sequenceDigits: 1,
      components: [] as NumberingComponentType[],
      active: true,
    };

    setConfig(current => ({
      ...current,
      numbering: {
        ...current.numbering,
        rules: [...current.numbering.rules, rule],
        activeRuleId: rule.id,
      },
    }));
  };

  const updateRule = (id: string, patch: Record<string, unknown>) => {
    setConfig(current => ({
      ...current,
      numbering: {
        ...current.numbering,
        rules: current.numbering.rules.map(rule =>
          rule.id === id ? { ...rule, ...patch } : rule,
        ),
      },
    }));
  };

  const removeRule = (id: string) => {
    setConfig(current => ({
      ...current,
      numbering: {
        ...current.numbering,
        rules: current.numbering.rules.filter(rule => rule.id !== id),
        activeRuleId: current.numbering.activeRuleId === id ? null : current.numbering.activeRuleId,
      },
    }));
  };

  const toggleComponent = (ruleId: string, component: NumberingComponentType) => {
    const rule = config.numbering.rules.find(r => r.id === ruleId);
    if (!rule) return;

    const components = rule.components.includes(component)
      ? rule.components.filter(item => item !== component)
      : [...rule.components, component];

    updateRule(ruleId, { components });
  };

  return (
    <div className="af-stagger space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Organization Setup</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure the organization, locations, and numbering rules used throughout AssetFlow.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset}>Clear Setup</Button>
          <Button onClick={save}>
            <Save className="mr-2 h-4 w-4" />
            {saved ? 'Saved' : 'Save Configuration'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Organization</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            Company Name
            <input className={inputClass} value={config.organization.companyName}
              onChange={e => update({ organization: { ...config.organization, companyName: e.target.value } })} />
          </label>
          <label className="space-y-1 text-sm">
            Legal Name
            <input className={inputClass} value={config.organization.legalName}
              onChange={e => update({ organization: { ...config.organization, legalName: e.target.value } })} />
          </label>
          <label className="space-y-1 text-sm">
            Currency
            <input className={inputClass} value={config.organization.currency}
              onChange={e => update({ organization: { ...config.organization, currency: e.target.value } })} placeholder="Administrator decides" />
          </label>
          <label className="space-y-1 text-sm">
            Timezone
            <input className={inputClass} value={config.organization.timezone}
              onChange={e => update({ organization: { ...config.organization, timezone: e.target.value } })} placeholder="Administrator decides" />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Asset Numbering Prefixes</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            Company Prefix
            <input className={inputClass} value={config.numbering.companyPrefix}
              onChange={e => setConfig(current => ({ ...current, numbering: { ...current.numbering, companyPrefix: e.target.value } }))} placeholder="Administrator decides" />
          </label>
          <label className="space-y-1 text-sm">
            Category Prefix
            <input className={inputClass} value={config.numbering.categoryPrefix}
              onChange={e => setConfig(current => ({ ...current, numbering: { ...current.numbering, categoryPrefix: e.target.value } }))} placeholder="Administrator decides" />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2"><MapPin className="h-5 w-5" />Locations</span>
            <Button size="sm" onClick={addLocation}><Plus className="mr-2 h-4 w-4" />Add Location</Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {locationsList.length === 0 && <p className="text-sm text-muted-foreground">No locations configured yet.</p>}
          {locationsList.map(location => (
            <div key={location.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex-1">
                <p className="font-medium">{location.name}</p>
                <p className="text-xs text-muted-foreground">{usersList.filter(user => user.locationId === location.id).length} user(s)</p>
              </div>
              <Button variant="ghost" size="icon" title="Delete location" onClick={() => deleteLocation(location)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>Asset Types</span>
            <Button size="sm" onClick={addEntity}><Plus className="mr-2 h-4 w-4" />Add Asset Type</Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {config.assetTypes.map(type => (
            <div key={type.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_180px_auto]">
              <input className={inputClass} placeholder="Asset type name" value={type.name}
                onChange={e => updateEntity(type.id, { name: e.target.value })} />
              <input className={inputClass} placeholder="Code (optional)" value={type.code || ''}
                onChange={e => updateEntity(type.id, { code: e.target.value })} />
              <Button variant="ghost" size="icon" onClick={() => removeAssetType(type.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {config.assetTypes.length === 0 && <p className="text-sm text-muted-foreground">No asset types configured yet.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2"><Hash className="h-5 w-5" />Asset Numbering Rules</span>
            <Button size="sm" onClick={addRule}><Plus className="mr-2 h-4 w-4" />Create Rule</Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {config.numbering.rules.length === 0 && (
            <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              No numbering rule exists. Create one and choose every component yourself.
            </div>
          )}

          {config.numbering.rules.map(rule => (
            <div key={rule.id} className="space-y-4 rounded-lg border p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <input className={inputClass} placeholder="Rule name" value={rule.name}
                  onChange={e => updateRule(rule.id, { name: e.target.value })} />
                <input className={inputClass} placeholder="Separator (optional)" value={rule.separator}
                  onChange={e => updateRule(rule.id, { separator: e.target.value })} />
                <input className={inputClass} type="number" min={1} max={50} placeholder="Sequence length"
                  value={rule.sequenceDigits}
                  onChange={e => updateRule(rule.id, { sequenceDigits: Math.max(1, Number(e.target.value) || 1) })} />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Choose numbering components</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(componentLabels) as NumberingComponentType[]).map(component => {
                    const selected = rule.components.includes(component);
                    return (
                      <Button key={component} type="button" size="sm" variant={selected ? 'default' : 'outline'}
                        onClick={() => toggleComponent(rule.id, component)}>
                        {selected && <Check className="mr-1 h-3 w-3" />}
                        {componentLabels[component]}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant={config.numbering.activeRuleId === rule.id ? 'default' : 'outline'}
                  onClick={() => setConfig(current => ({ ...current, numbering: { ...current.numbering, activeRuleId: rule.id } }))}>
                  {config.numbering.activeRuleId === rule.id ? 'Active Rule' : 'Use This Rule'}
                </Button>
                <Button variant="ghost" onClick={() => removeRule(rule.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />Delete Rule
                </Button>
              </div>
            </div>
          ))}

          {activeRule && (
            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-medium">Current rule</p>
              <p className="mt-1 text-muted-foreground">
                {activeRule.components.length ? activeRule.components.map(component => componentLabels[component]).join(` ${activeRule.separator} `) : 'No components selected'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Values and codes are administrator-defined; AssetFlow does not assume company-specific numbering values.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
