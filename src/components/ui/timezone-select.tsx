import { useMemo } from 'react';
import { cn } from '@/lib/utils';

const fallbackZones=['UTC','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Europe/London','Europe/Paris','Europe/Berlin','Asia/Dubai','Asia/Kolkata','Asia/Singapore','Asia/Tokyo','Australia/Sydney'];

function offsetLabel(zone:string) {
  try {
    const part=new Intl.DateTimeFormat('en',{timeZone:zone,timeZoneName:'shortOffset'}).formatToParts(new Date()).find(value=>value.type==='timeZoneName')?.value||'GMT';
    return part.replace('GMT','UTC');
  } catch { return 'UTC'; }
}

export function TimeZoneSelect({value,onChange,className,id,required=true}:{value:string;onChange:(value:string)=>void;className?:string;id?:string;required?:boolean}) {
  const zones=useMemo(()=>{
    const supported=(Intl as unknown as {supportedValuesOf?:(key:string)=>string[]}).supportedValuesOf?.('timeZone')||fallbackZones;
    return [...new Set(value&&!supported.includes(value)?[value,...supported]:supported)].sort((a,b)=>a.localeCompare(b));
  },[value]);
  return <select id={id} required={required} value={value} onChange={event=>onChange(event.target.value)} className={cn('h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',className)}>
    <option value="" disabled>Select timezone</option>
    {zones.map(zone=><option key={zone} value={zone}>({offsetLabel(zone)}) {zone.replaceAll('_',' ')}</option>)}
  </select>;
}
