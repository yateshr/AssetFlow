import { Plus, Trash2, Database, SlidersHorizontal, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCollection } from '@/lib/db';
import { DEFAULT_SYSTEM_POLICY, type MasterDataOption, type SystemPolicy } from '@/data/masterData';
import { TimeZoneSelect } from '@/components/ui/timezone-select';

const masters = [
  ['currencies','Currencies'], ['units-of-measure','Units of Measure'], ['call-categories','IT Call Categories'],
  ['call-priorities','IT Call Priorities & SLA'], ['location-types','Location Types'],
  ['vendor-categories','Vendor Categories'], ['asset-conditions','Asset Conditions'],
  ['license-types','License Types'], ['infrastructure-types','Infrastructure Types'], ['support-teams','Support Teams'],
] as const;

export function SettingsPage() {
  const [policies, setPolicies] = useCollection<SystemPolicy>('system-policies');
  const policy = policies.find(item => item.id === 'system') || DEFAULT_SYSTEM_POLICY;
  const updatePolicy = (patch: Partial<SystemPolicy>) => setPolicies([{ ...policy, ...patch, id: 'system' }]);
  return <div className="space-y-6">
    <div><h2 className="text-xl font-semibold">System configuration</h2><p className="mt-1 text-sm text-muted-foreground">Database-backed reference data and organization-wide operating policies.</p></div>
    <Tabs defaultValue="masters">
      <TabsList><TabsTrigger value="masters"><Database className="mr-2 h-4 w-4"/>Master Data</TabsTrigger><TabsTrigger value="policies"><SlidersHorizontal className="mr-2 h-4 w-4"/>Policies</TabsTrigger><TabsTrigger value="security"><ShieldCheck className="mr-2 h-4 w-4"/>Protected Workflows</TabsTrigger></TabsList>
      <TabsContent value="masters" className="mt-5 grid gap-4 xl:grid-cols-2">
        {masters.map(([collection,title])=><MasterEditor key={collection} collection={collection} title={title} showSla={collection==='call-priorities'}/>) }
      </TabsContent>
      <TabsContent value="policies" className="mt-5">
        <Card><CardHeader><CardTitle>Organization policies</CardTitle><CardDescription>These values drive calculations, alerts, formatting and operational defaults throughout AssetFlow.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PolicyText label="Default currency code" value={policy.defaultCurrency} onChange={value=>updatePolicy({defaultCurrency:value.toUpperCase()})}/><PolicyText label="Locale" value={policy.locale} onChange={value=>updatePolicy({locale:value})}/><label className="space-y-1.5 text-sm font-medium">Timezone<TimeZoneSelect value={policy.timezone} onChange={timezone=>updatePolicy({timezone})}/></label><PolicyText label="Date format" value={policy.dateFormat} onChange={value=>updatePolicy({dateFormat:value})}/>
          <PolicyNumber label="Warranty alert days" value={policy.warrantyAlertDays} onChange={value=>updatePolicy({warrantyAlertDays:value})}/><PolicyNumber label="License alert days" value={policy.licenseAlertDays} onChange={value=>updatePolicy({licenseAlertDays:value})}/><PolicyNumber label="Useful life (years)" value={policy.usefulLifeYears} onChange={value=>updatePolicy({usefulLifeYears:value})}/>
          <label className="space-y-1.5 text-sm font-medium">Depreciation method<select className="h-10 w-full rounded-md border bg-background px-3 font-normal" value={policy.depreciationMethod} onChange={event=>updatePolicy({depreciationMethod:event.target.value as SystemPolicy['depreciationMethod']})}><option value="straight-line">Straight line</option><option value="none">No depreciation</option></select></label>
          <PolicyText label="Default custodian" value={policy.defaultCustodian} onChange={value=>updatePolicy({defaultCustodian:value})}/><PolicyText label="Default stock location" value={policy.defaultStockLocation} onChange={value=>updatePolicy({defaultStockLocation:value})}/><PolicyText label="Default support team" value={policy.defaultSupportTeam} onChange={value=>updatePolicy({defaultSupportTeam:value})}/>
        </CardContent></Card>
      </TabsContent>
      <TabsContent value="security" className="mt-5"><Card><CardHeader><CardTitle>Protected workflow values</CardTitle><CardDescription>These remain controlled because they trigger permissions, accounting and lifecycle automation.</CardDescription></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-2"><p><b>User roles:</b> Admin, Manager, User</p><p><b>Invoice workflow:</b> Draft, Open, Received, Paid, Overdue, Cancelled</p><p><b>Asset lifecycle:</b> Available, Assigned, Maintenance, Retired, Disposed, Lost</p><p><b>Assignment workflow:</b> Pending, Active, Returned</p></CardContent></Card></TabsContent>
    </Tabs>
  </div>;
}

function MasterEditor({collection,title,showSla}:{collection:string;title:string;showSla:boolean}) {
  const [items,setItems]=useCollection<MasterDataOption>(collection);
  const add=()=>setItems([...items,{id:crypto.randomUUID(),name:'',code:'',active:true,...(showSla?{targetHours:24}:{})}]);
  const update=(id:string,patch:Partial<MasterDataOption>)=>setItems(items.map(item=>item.id===id?{...item,...patch}:item));
  const remove=(item:MasterDataOption)=>{if(window.confirm(`Delete "${item.name||'Unnamed item'}"? Existing records retain their saved value.`))setItems(items.filter(value=>value.id!==item.id));};
  return <Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-base">{title}</CardTitle><CardDescription>{items.filter(item=>item.active).length} active</CardDescription></div><Button size="sm" variant="outline" onClick={add}><Plus className="mr-1.5 h-4 w-4"/>Add</Button></CardHeader><CardContent className="space-y-2">
    {items.map(item=><div key={item.id} className={`grid gap-2 rounded-md border p-2 ${showSla?'grid-cols-[minmax(0,1fr)_90px_90px_36px]':'grid-cols-[minmax(0,1fr)_90px_36px]'}`}><Input value={item.name} placeholder="Name" onChange={event=>update(item.id,{name:event.target.value})}/>{showSla&&<Input type="number" min="1" title="Target resolution hours" value={item.targetHours||''} onChange={event=>update(item.id,{targetHours:Number(event.target.value)||1})}/>}<label className="flex items-center justify-center gap-1 text-xs"><input type="checkbox" checked={item.active} onChange={event=>update(item.id,{active:event.target.checked})}/>Active</label><Button variant="ghost" size="icon-sm" onClick={()=>remove(item)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>)}
    {!items.length&&<p className="py-4 text-center text-sm text-muted-foreground">No records configured.</p>}
  </CardContent></Card>;
}

function PolicyText({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}) { return <label className="space-y-1.5 text-sm font-medium">{label}<Input value={value} onChange={event=>onChange(event.target.value)}/></label>; }
function PolicyNumber({label,value,onChange}:{label:string;value:number;onChange:(value:number)=>void}) { return <label className="space-y-1.5 text-sm font-medium">{label}<Input type="number" min="0" value={value} onChange={event=>onChange(Number(event.target.value)||0)}/></label>; }
