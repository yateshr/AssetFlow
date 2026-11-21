import { useEffect, useMemo, useState } from 'react';
import { loadAssetTagSiteSeries, saveAssetTagSiteSeries, type AssetTagSiteSeries } from '@/lib/db';
import { Check, Hash, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  loadConfig,
  saveConfig,
  createEmptyConfig,
  type AssetFlowConfig,
  type NumberingComponentType,
} from '@/lib/assetflowConfig';
import type { AssetCategory, Location, User } from '@/data/models';
import { TimeZoneSelect } from '@/components/ui/timezone-select';


interface ConfigurationPageProps {
  usersList: User[];
  onUsersChange: (users: User[]) => void;
  sitesList: Location[];
  onSitesChange: (locations: Location[]) => void;
  assetCategories: AssetCategory[];
  onAssetCategoriesChange: (categories: AssetCategory[]) => void;
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

export function ConfigurationPage({
  usersList,
  onUsersChange,
  sitesList,
  onSitesChange,
  assetCategories,
  onAssetCategoriesChange,
}: ConfigurationPageProps) {
  const [tagRules,setTagRules]=useState<AssetTagSiteSeries[]>([]);
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

  const addEntity = () => {
    onAssetCategoriesChange([...assetCategories, { id: crypto.randomUUID(), name: '', code: '', active: true }]);
  };

  const updateEntity = (id: string, patch: Partial<AssetCategory>) => {
    onAssetCategoriesChange(assetCategories.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const removeAssetType = (id: string) => {
    const category=assetCategories.find(item=>item.id===id);
    if(!category||!window.confirm(`Delete asset category "${category.name||'Unnamed category'}"? Existing records will retain their stored category value.`))return;
    onAssetCategoriesChange(assetCategories.filter(item => item.id !== id));
  };
  useEffect(()=>{void loadAssetTagSiteSeries().then(setTagRules).catch(error=>console.error('Could not load Site Series',error));},[]);
  const addTagRule=()=>setTagRules([...tagRules,{id:crypto.randomUUID(),siteId:sitesList[0]?.id||'',companyPrefix:'NP',functionPrefix:'IT',series:'',nextNumber:1,digits:4,active:true}]);
  const updateTagRule=(id:string,patch:Partial<AssetTagSiteSeries>)=>setTagRules(tagRules.map(rule=>rule.id===id?{...rule,...patch}:rule));
  const persistTagRule=async(rule:AssetTagSiteSeries)=>{try{const id=await saveAssetTagSiteSeries(rule);setTagRules(current=>current.map(item=>item.id===rule.id?{...item,id}:item));}catch(error){window.alert(error instanceof Error?error.message:'Could not save Site Series');}};

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
          <h2 className="text-xl font-semibold">Asset structure and numbering</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure asset categories and the numbering rules used by the selected company.
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
        <CardHeader><CardTitle>Site Series</CardTitle></CardHeader>
        <CardContent className="space-y-3"><p className="text-sm text-muted-foreground">One shared counter per issuing Site. The asset type code changes, but every physical asset at that Site uses the same next number.</p><Button size="sm" onClick={addTagRule}><Plus className="mr-2 h-4 w-4"/>Add Site Series</Button>{tagRules.map(rule=>{const preview=[rule.companyPrefix,rule.functionPrefix,'TYPE',`${rule.series}${String(rule.nextNumber).padStart(rule.digits,'0')}`].filter(Boolean).join('-');return <div key={rule.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-4"><select className={inputClass} value={rule.siteId} onChange={e=>updateTagRule(rule.id,{siteId:e.target.value})}><option value="">Issuing site</option>{sitesList.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select><div className="grid grid-cols-3 gap-2"><input className={inputClass} placeholder="Company" value={rule.companyPrefix} onChange={e=>updateTagRule(rule.id,{companyPrefix:e.target.value.toUpperCase()})}/><input className={inputClass} placeholder="Function" value={rule.functionPrefix} onChange={e=>updateTagRule(rule.id,{functionPrefix:e.target.value.toUpperCase()})}/><input className={inputClass} placeholder="Series" value={rule.series} onChange={e=>updateTagRule(rule.id,{series:e.target.value.toUpperCase()})}/></div><div className="flex gap-2"><input className={inputClass} type="number" min={1} value={rule.nextNumber} onChange={e=>updateTagRule(rule.id,{nextNumber:Math.max(1,Number(e.target.value)||1)})}/><input className="h-10 w-20 rounded-md border border-input bg-background px-3 text-sm" type="number" min={1} max={8} value={rule.digits} onChange={e=>updateTagRule(rule.id,{digits:Math.max(1,Number(e.target.value)||1)})}/><Button size="sm" onClick={()=>void persistTagRule(rule)}>Save</Button></div><p className="text-xs text-muted-foreground md:col-span-4">Next tag example: <span className="font-mono text-foreground">{preview || 'Complete this Site Series'}</span></p></div>})}{tagRules.length===0&&<p className="text-sm text-muted-foreground">No Site Series configured yet.</p>}</CardContent>
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
            <span>Asset Types</span>
            <Button size="sm" onClick={addEntity}><Plus className="mr-2 h-4 w-4" />Add Asset Type</Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {assetCategories.map(type => (
            <div key={type.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_180px_120px_auto]">
              <input className={inputClass} placeholder="Asset type name" value={type.name}
                onChange={e => updateEntity(type.id, { name: e.target.value })} />
              <input className={inputClass} placeholder="Code (optional)" value={type.code || ''}
                onChange={e => updateEntity(type.id, { code: e.target.value })} />
              <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" checked={type.active} onChange={e=>updateEntity(type.id,{active:e.target.checked})}/>{type.active?'Active':'Inactive'}</label>
              <Button variant="ghost" size="icon" onClick={() => removeAssetType(type.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {assetCategories.length === 0 && <p className="text-sm text-muted-foreground">No asset categories configured yet.</p>}
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
