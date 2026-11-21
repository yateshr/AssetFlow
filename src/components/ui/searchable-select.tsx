import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from './button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export type SearchableOption={value:string;label:string;keywords?:string};
export function SearchableSelect({value,options,onChange,placeholder,searchPlaceholder='Type to search...',emptyText='No matching option.',disabled=false}:{value:string;options:SearchableOption[];onChange:(value:string)=>void;placeholder:string;searchPlaceholder?:string;emptyText?:string;disabled?:boolean}) {
  const [open,setOpen]=useState(false); const selected=options.find(option=>option.value===value);
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="h-10 w-full justify-between px-3 font-normal"><span className={`truncate ${selected?'':'text-muted-foreground'}`}>{selected?.label||placeholder}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground"/></Button></PopoverTrigger><PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0"><Command><CommandInput placeholder={searchPlaceholder}/><CommandList className="max-h-64"><CommandEmpty>{emptyText}</CommandEmpty><CommandGroup>{options.map(option=><CommandItem key={option.value} value={`${option.label} ${option.keywords||''}`} onSelect={()=>{onChange(option.value);setOpen(false)}}><Check className={`h-4 w-4 ${option.value===value?'opacity-100':'opacity-0'}`}/><span>{option.label}</span></CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover>;
}
