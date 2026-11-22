import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { confirmDialog } from '@/components/ConfirmHost';
import { toast } from 'sonner';
import { ExportMenu } from '@/components/ExportMenu';
import { Plus, Search, Eye, Edit, Trash2, PackagePlus, CheckCircle2, CreditCard, X, CalendarDays, Rows3, AlertTriangle, ChevronsUpDown, Check, Paperclip, Download, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useCollection } from '@/lib/db';
import { DEFAULT_SYSTEM_POLICY, type MasterDataOption, type SystemPolicy } from '@/data/masterData';
import {
  type Invoice, type InvoiceLineItem, type InvoiceStatus, type Asset, type AssetType,
  type Vendor, type User, type Location, type AssetHistoryEvent, type AssetCategory, formatCurrency, formatDate
} from '@/data/models';

interface InvoicesPageProps {
  invoicesList: Invoice[];
  onInvoicesChange: (invoices: Invoice[]) => void;
  assetsList: Asset[];
  onAssetsChange: (assets: Asset[]) => void;
  vendorsList: Vendor[];
  onVendorsChange: (vendors: Vendor[]) => void;
  currentUser: User;
  history: AssetHistoryEvent[];
  onHistoryChange: (events: AssetHistoryEvent[]) => void;
  assetCategories: AssetCategory[];
  sitesList: Location[];
}

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: 'bg-muted text-muted-foreground border-muted',
  open: 'bg-primary/10 text-primary border-primary/20',
  received: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  'partially-received': 'bg-chart-5/10 text-chart-5 border-chart-5/20',
  paid: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  'partially-paid': 'bg-chart-5/10 text-chart-5 border-chart-5/20',
  overdue: 'bg-destructive/10 text-destructive border-destructive/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20'
};

type EditableInvoiceLineItem = InvoiceLineItem & { itemDescription?: string };

const emptyLine = (assetType: AssetType = 'accessory'): EditableInvoiceLineItem => ({
  id: `INVL-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
  description: '', quantity: 1, unitPrice: 0, taxRate: 0, assetType,
  manufacturer: '', model: '', receivedQuantity: 0
});

function money(value: number, currency: string) {
  const code = currency.split(' ')[0] || 'INR';
  try { return new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency: code }).format(value); }
  catch { return formatCurrency(value); }
}

export function InvoicesPage({
  invoicesList, onInvoicesChange, assetsList, onAssetsChange, vendorsList,
  onVendorsChange, currentUser, history, onHistoryChange, assetCategories, sitesList
}: InvoicesPageProps) {
  const [systemPolicies]=useCollection<SystemPolicy>('system-policies');
  const systemPolicy=systemPolicies[0]||DEFAULT_SYSTEM_POLICY;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);

  const vendorName = (id: string) => vendorsList.find(v => v.id === id)?.name || 'Unknown vendor';
  const isSuperAdmin = ['super_admin','admin'].includes(currentUser.role);
  const invoicesInScope = isSuperAdmin ? invoicesList : invoicesList.filter(invoice => invoice.siteId === currentUser.siteId);
  const filtered = invoicesInScope.filter(invoice => {
    const q = search.toLowerCase();
    return (!q || invoice.invoiceNumber.toLowerCase().includes(q) ||
      vendorName(invoice.vendorId).toLowerCase().includes(q) ||
      (invoice.poNumber || '').toLowerCase().includes(q)) &&
      (statusFilter === 'all' || invoice.status === statusFilter);
  });

  const createInvoice = (data: Omit<Invoice,'id'|'createdAt'>) => {
    onInvoicesChange([...invoicesList, { ...data, id:`INV-${String(invoicesList.length+1).padStart(3,'0')}`, createdAt:new Date().toISOString() }]);
    setShowCreate(false);
  };

  const updateInvoice = (data: Omit<Invoice,'id'|'createdAt'>) => {
    if (!editing) return;
    onInvoicesChange(invoicesList.map(i => i.id === editing.id ? {...editing,...data} : i));
    setEditing(null);
  };

  const deleteInvoice = async (invoice: Invoice) => {
    if (invoice.lineItems.some(i => i.receivedQuantity > 0)) {
      toast.error('This invoice has received items linked to assets and cannot be deleted.'); return;
    }
    if (await confirmDialog({ title: 'Delete invoice?', message: `Delete invoice ${invoice.invoiceNumber}?`, destructive: true }))
      onInvoicesChange(invoicesList.filter(i => i.id !== invoice.id));
  };

  const handlePayment = (data:{amount:number;date:string;reference:string;method:string}) => {
    if (!paymentInvoice) return;
    const outstanding = Math.max(0, paymentInvoice.total - paymentInvoice.amountPaid);
    if (data.amount > outstanding) {
      toast.error(`Payment cannot exceed the outstanding balance of ${money(outstanding, paymentInvoice.currency)}.`);
      return;
    }
    const amountPaid = paymentInvoice.amountPaid + data.amount;
    const updated = {...paymentInvoice, amountPaid,
      status:(amountPaid >= paymentInvoice.total ? 'paid' : 'partially-paid') as InvoiceStatus,
      paymentDate:data.date,paymentReference:data.reference,paymentMethod:data.method};
    onInvoicesChange(invoicesList.map(i => i.id===paymentInvoice.id ? updated : i));
    setPaymentInvoice(null);
  };

  if (showCreate || editing) {
    return (
      <div className="af-page -m-3 min-h-full bg-background sm:-m-4 md:-m-6 lg:-m-7">
        <InvoiceForm
          invoice={editing}
          invoices={invoicesList}
          vendors={vendorsList}
          onVendorsChange={onVendorsChange}
          onSubmit={editing ? updateInvoice : createInvoice}
          onCancel={() => { setShowCreate(false); setEditing(null); }}
          assetCategories={assetCategories}
          sitesList={sitesList}
          defaultSiteId={isSuperAdmin ? '' : currentUser.siteId}
          canChooseLocation={isSuperAdmin}
        />
      </div>
    );
  }

  return <div className="af-stagger space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-3xl font-bold tracking-tight">Invoices</h1><p className="text-muted-foreground">Record vendor invoices and link received items to assets.</p></div>
      <div className="flex flex-wrap gap-2">
      <ExportMenu disabled={filtered.length === 0} build={() => ({
        name: 'invoices', sheet: 'Invoices',
        headers: ['Invoice No.', 'Vendor', 'Site', 'Invoice Date', 'Due Date', 'PO Number', 'Currency', 'Subtotal', 'Tax', 'Total', 'Paid', 'Outstanding', 'Status', 'Payment Method', 'Payment Reference', 'Payment Date'],
        rows: filtered.map(i => [i.invoiceNumber, vendorsList.find(v => v.id === i.vendorId)?.name || '', sitesList.find(l => l.id === i.siteId)?.name || '', i.invoiceDate, i.dueDate || '', i.poNumber || '', i.currency, i.subtotal, i.taxTotal, i.total, i.amountPaid, i.total - i.amountPaid, i.status, i.paymentMethod || '', i.paymentReference || '', i.paymentDate || '']),
      })} />
      <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2"/>Add Invoice</Button>
      </div>
    </div>
    <Card><CardContent className="py-4"><div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
        <Input className="pl-9" placeholder="Search invoice, vendor or PO number..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as InvoiceStatus|'all')} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
        <option value="all">All Statuses</option>{Object.keys(STATUS_STYLES).map(s=><option key={s} value={s}>{s.replace('-',' ')}</option>)}
      </select>
    </div></CardContent></Card>
    <Card><CardContent className="p-0"><Table><TableHeader><TableRow>
      <TableHead>Invoice</TableHead><TableHead>Vendor</TableHead><TableHead>Invoice Date</TableHead><TableHead>Due Date</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
    </TableRow></TableHeader><TableBody>
      {filtered.length===0 ? <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No invoices found.</TableCell></TableRow> :
      filtered.map(invoice => <TableRow key={invoice.id}>
        <TableCell><p className="font-medium">{invoice.invoiceNumber}</p><p className="text-xs text-muted-foreground">{invoice.id} · {invoice.lineItems.reduce((s,i)=>s+i.receivedQuantity,0)}/{invoice.lineItems.reduce((s,i)=>s+i.quantity,0)} received</p></TableCell>
        <TableCell>{vendorName(invoice.vendorId)}</TableCell><TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
        <TableCell>{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</TableCell><TableCell className="font-medium">{money(invoice.total,invoice.currency)}</TableCell>
        <TableCell><Badge variant="outline" className={STATUS_STYLES[invoice.status]}>{invoice.status.replace('-',' ')}</Badge></TableCell>
        <TableCell><div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" title="View" onClick={()=>setViewing(invoice)}><Eye className="h-4 w-4"/></Button>
          <Button variant="ghost" size="icon-sm" title="Edit" onClick={()=>setEditing(invoice)}><Edit className="h-4 w-4"/></Button>
          {invoice.status!=='paid' && invoice.status!=='cancelled' && <Button variant="ghost" size="icon-sm" title="Record Payment" onClick={()=>setPaymentInvoice(invoice)}><CreditCard className="h-4 w-4"/></Button>}
          <Button variant="ghost" size="icon-sm" title="Delete" onClick={()=>deleteInvoice(invoice)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
        </div></TableCell>
      </TableRow>)}
    </TableBody></Table></CardContent></Card>

    <Dialog open={!!viewing} onOpenChange={open=>!open&&setViewing(null)}><DialogContent className="!w-fit !min-w-[min(760px,calc(100vw-32px))] !max-w-[calc(100vw-32px)] !h-auto !max-h-[calc(100vh-32px)] p-0 gap-0 overflow-hidden rounded-lg">
      {viewing&&<InvoiceDetails invoice={viewing} vendorName={vendorName(viewing.vendorId)} sitesList={sitesList} assetsList={assetsList} history={history} onClose={()=>setViewing(null)} onReceive={()=>{setViewing(null);toast.info('Create received assets from Assets → Add Batch. This preserves Site Series tags, serial numbers, and invoice-line limits.')}} onPayment={()=>{setViewing(null);setPaymentInvoice(viewing)}}/>}
    </DialogContent></Dialog>

    <Dialog open={!!paymentInvoice} onOpenChange={open=>!open&&setPaymentInvoice(null)}><DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Record Payment</DialogTitle><DialogDescription>{paymentInvoice?.invoiceNumber}</DialogDescription></DialogHeader>
      {paymentInvoice&&<PaymentForm invoice={paymentInvoice} onSubmit={handlePayment} onCancel={()=>setPaymentInvoice(null)}/>}
    </DialogContent></Dialog>
  </div>;
}

function InvoiceForm({invoice,invoices,vendors,onVendorsChange,onSubmit,onCancel,assetCategories,sitesList,defaultSiteId,canChooseLocation}:{invoice:Invoice|null;invoices:Invoice[];vendors:Vendor[];onVendorsChange:(vendors:Vendor[])=>void;onSubmit:(data:Omit<Invoice,'id'|'createdAt'>)=>void;onCancel:()=>void;assetCategories:AssetCategory[];sitesList:Location[];defaultSiteId:string;canChooseLocation:boolean}) {
  const [currencyOptions]=useCollection<MasterDataOption>('currencies');
  const [unitOptions]=useCollection<MasterDataOption>('units-of-measure');
  const [termRecords]=useCollection<MasterDataOption>('payment-terms');
  const termOptions=termRecords.filter(option=>option.active&&option.name.trim());
  const [policies]=useCollection<SystemPolicy>('system-policies');
  const policy=policies[0]||DEFAULT_SYSTEM_POLICY;
  const activeCurrencies=currencyOptions.filter(option=>option.active&&option.name.trim());
  const [vendorId,setVendorId]=useState(invoice?.vendorId||vendors[0]?.id||'');
  const [invoiceNumber,setInvoiceNumber]=useState(invoice?.invoiceNumber||'');
  const [invoiceDate,setInvoiceDate]=useState(invoice?.invoiceDate||new Date().toISOString().split('T')[0]);
  const [dueDate,setDueDate]=useState(invoice?.dueDate||'');
  const [currency,setCurrency]=useState(invoice?.currency||vendors[0]?.currency||activeCurrencies.find(option=>option.id===policy.defaultCurrency)?.name||activeCurrencies[0]?.name||policy.defaultCurrency);
  const [paymentTerms,setPaymentTerms]=useState(invoice?.paymentTerms||'');
  const [poNumber,setPoNumber]=useState(invoice?.poNumber||'');
  const [poDate,setPoDate]=useState(invoice?.poDate||'');
  const [siteId,setSiteId]=useState(invoice?.siteId||defaultSiteId);
  const [status,setStatus]=useState<InvoiceStatus>(invoice?.status||'open');
  const [notes,setNotes]=useState(invoice?.notes||'');
  const activeCategories=assetCategories.filter(category=>category.active&&category.name.trim());
  const defaultCategory=activeCategories[0]?.id||'accessory';
  const [items,setItems]=useState<EditableInvoiceLineItem[]>(invoice?.lineItems||[emptyLine(defaultCategory)]);
  const [showCreateVendor, setShowCreateVendor] = useState(false);
  const [vendorOpen, setVendorOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [attachmentName, setAttachmentName] = useState(invoice?.attachmentName || '');
  const [attachmentType, setAttachmentType] = useState(invoice?.attachmentType || '');
  const [attachmentDataUrl, setAttachmentDataUrl] = useState(invoice?.attachmentDataUrl || '');
  const submitIntent = useRef<'draft'|'final'>('final');
  const subtotal=useMemo(()=>items.reduce((s,i)=>s+i.quantity*i.unitPrice,0),[items]);
  const taxTotal=useMemo(()=>items.reduce((s,i)=>s+i.quantity*i.unitPrice*i.taxRate/100,0),[items]);
  const total=subtotal+taxTotal;
  const itemSuggestions=useMemo(()=>Array.from(new Set(invoices.flatMap(existing=>existing.lineItems.map(item=>item.description)).filter(Boolean))).sort(),[invoices]);
  const normalizedInvoiceNumber=invoiceNumber.trim().toLowerCase();
  const invoiceYear=invoiceDate ? new Date(`${invoiceDate}T00:00:00`).getFullYear() : undefined;
  const matchingInvoices=useMemo(()=>normalizedInvoiceNumber ? invoices.filter(i=>i.id!==invoice?.id&&i.vendorId===vendorId&&i.invoiceNumber.trim().toLowerCase()===normalizedInvoiceNumber) : [],[invoice?.id,invoices,normalizedInvoiceNumber,vendorId]);
  const sameYearDuplicate=useMemo(()=>matchingInvoices.find(i=>new Date(`${i.invoiceDate}T00:00:00`).getFullYear()===invoiceYear),[invoiceYear,matchingInvoices]);
  const priorYearDuplicates=useMemo(()=>matchingInvoices.filter(i=>new Date(`${i.invoiceDate}T00:00:00`).getFullYear()!==invoiceYear),[invoiceYear,matchingInvoices]);
  const duplicatePo=useMemo(()=>poNumber.trim()?invoices.find(i=>i.id!==invoice?.id&&i.poNumber?.trim().toLowerCase()===poNumber.trim().toLowerCase()):undefined,[invoice?.id,invoices,poNumber]);
  const update=(id:string,patch:Partial<EditableInvoiceLineItem>)=>{setDirty(true);setItems(a=>a.map(i=>i.id===id?{...i,...patch}:i))};
  const removeLine=(id:string)=>{setDirty(true);setItems(current=>{const remaining=current.filter(item=>item.id!==id);return remaining.length?remaining:[emptyLine(defaultCategory)]})};
  const input='h-9 rounded-md border border-input bg-background px-2.5 text-sm shadow-none focus:outline-none focus:ring-2 focus:ring-ring';
  const select='h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

  const requestClose=async()=>{if(!dirty||await confirmDialog({title:'Discard changes?',message:'Discard unsaved invoice changes?',confirmLabel:'Discard',destructive:true}))onCancel()};
  const applyPaymentTerms=(value:string)=>{
    setPaymentTerms(value);
    const known=termOptions.find(option=>option.name.trim().toLowerCase()===value.trim().toLowerCase())?.days;
    const match=value.match(/net\s*(\d+)/i);
    const days=known??(match?Number(match[1]):undefined);
    if(days!==undefined&&invoiceDate){const next=new Date(`${invoiceDate}T00:00:00`);next.setDate(next.getDate()+days);setDueDate(next.toISOString().slice(0,10));}
  };
  const attachFile=(file?:File)=>{
    if(!file)return;
    if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type)){setErrors(current=>({...current,attachment:'Use a PDF, JPG, PNG, or WebP file.'}));return;}
    if(file.size>2*1024*1024){setErrors(current=>({...current,attachment:'Attachment must be 2 MB or smaller.'}));return;}
    const reader=new FileReader();reader.onload=()=>{setAttachmentName(file.name);setAttachmentType(file.type);setAttachmentDataUrl(String(reader.result));setErrors(current=>({...current,attachment:''}));setDirty(true)};reader.readAsDataURL(file);
  };

  const submit=async(e:FormEvent)=>{e.preventDefault();
    const intent=submitIntent.current;
    const nextErrors:Record<string,string>={};
    if(!vendorId)nextErrors.vendor='Select a vendor.';
    if(canChooseLocation&&!siteId)nextErrors.location='Select the site for this invoice.';
    if(!invoiceNumber.trim())nextErrors.invoiceNumber='Invoice number is required.';
    if(!invoiceDate)nextErrors.invoiceDate='Invoice date is required to check the invoice year.';
    if(intent==='final'&&items.some(i=>!i.description.trim()||i.quantity<1))nextErrors.items='Every line needs an item description and quantity of at least 1.';
    if(sameYearDuplicate)nextErrors.invoiceNumber=sameYearDuplicate.status==='draft'
      ? `A draft with this invoice number already exists for ${invoiceYear}. Continue from ${sameYearDuplicate.invoiceNumber} instead.`
      : `Invoice ${sameYearDuplicate.invoiceNumber} already exists for ${invoiceYear}.`;
    if(duplicatePo)nextErrors.poNumber=`PO number is already used on invoice ${duplicatePo.invoiceNumber}.`;
    setErrors(nextErrors);
    if(Object.keys(nextErrors).length)return;
    if(priorYearDuplicates.length){
      const years=Array.from(new Set(priorYearDuplicates.map(existing=>new Date(`${existing.invoiceDate}T00:00:00`).getFullYear()))).sort().join(', ');
      if(!(await confirmDialog({title:'Invoice number used before',message:`Invoice number ${invoiceNumber.trim()} was previously used by this vendor in ${years}. The current invoice date is in ${invoiceYear}. Continue?`})))return;
    }
    setDirty(false);
    onSubmit({vendorId,siteId:siteId||undefined,invoiceNumber:invoiceNumber.trim(),invoiceDate,dueDate:dueDate||undefined,currency,paymentTerms:paymentTerms.trim()||undefined,poNumber:poNumber.trim()||undefined,poDate:poDate||undefined,status:intent==='draft'?'draft':(status==='draft'?'open':status),notes:notes.trim()||undefined,attachmentName:attachmentName||undefined,attachmentType:attachmentType||undefined,attachmentDataUrl:attachmentDataUrl||undefined,subtotal,taxTotal,total,amountPaid:invoice?.amountPaid||0,paymentDate:invoice?.paymentDate,paymentReference:invoice?.paymentReference,paymentMethod:invoice?.paymentMethod,lineItems:items});
  };

  return <form onSubmit={submit} onChange={()=>setDirty(true)} className="min-h-full w-full min-w-0 bg-background">
    <div className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={requestClose} aria-label="Back to invoices"><ArrowLeft className="h-5 w-5"/></Button>
        <div className="min-w-0"><h2 className="truncate text-xl font-semibold tracking-tight">{invoice?'Edit Vendor Invoice':'Add Vendor Invoice'}</h2><p className="hidden text-xs text-muted-foreground sm:block">Enter invoice details and line items. Received hardware can be created as assets.</p></div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button type="button" variant="outline" className="hidden sm:inline-flex" onClick={requestClose}>Cancel</Button>
        {(!invoice||invoice.status==='draft')&&<Button type="submit" variant="outline" className="hidden sm:inline-flex" formNoValidate onClick={()=>{submitIntent.current='draft'}}>Save Draft</Button>}
        <Button type="submit" className="hidden sm:inline-flex" onClick={()=>{submitIntent.current='final'}}>{invoice?'Update Invoice':'Create Invoice'}</Button>
      </div>
    </div>

    <div className="mx-auto my-5 w-[calc(100%-2rem)] max-w-[1440px] rounded-lg border bg-card px-4 shadow-sm sm:w-[calc(100%-3rem)] sm:px-6 lg:px-8">

    <section className="border-b py-6">
      <div className="mb-5"><h3 className="text-base font-semibold">Invoice details</h3><p className="text-xs text-muted-foreground">Vendor, document reference and payment information.</p></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Field label="Vendor *" error={errors.vendor}>
          <Popover open={vendorOpen} onOpenChange={setVendorOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" role="combobox" aria-expanded={vendorOpen} className="h-9 w-full justify-between px-2.5 font-normal">
                <span className="truncate">{vendors.find(v=>v.id===vendorId)?.name || 'Search vendor...'}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
              <Command>
                <CommandInput placeholder="Type vendor name..." />
                <CommandList>
                  <CommandEmpty>No existing vendor found.</CommandEmpty>
                  <CommandGroup heading="Existing vendors">
                    {vendors.map(v=><CommandItem key={v.id} value={`${v.name} ${v.contactPerson || ''}`} onSelect={()=>{setVendorId(v.id);if(v.currency)setCurrency(v.currency);setDirty(true);setVendorOpen(false)}}>
                      <Check className={`h-4 w-4 ${vendorId===v.id?'opacity-100':'opacity-0'}`} />
                      <div className="min-w-0"><p className="truncate">{v.name}</p>{v.contactPerson&&<p className="truncate text-xs text-muted-foreground">{v.contactPerson}</p>}</div>
                    </CommandItem>)}
                  </CommandGroup>
                  <CommandGroup>
                    <CommandItem value="create new vendor" onSelect={()=>{setVendorOpen(false);setShowCreateVendor(true)}}>
                      <Plus className="h-4 w-4" /> Create new vendor
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </Field>
        <Field label="Invoice Number *" error={errors.invoiceNumber}><Input required aria-invalid={!!errors.invoiceNumber||!!sameYearDuplicate} className={input} value={invoiceNumber} onChange={e=>setInvoiceNumber(e.target.value)} placeholder="INV-2026-001"/></Field>
        <Field label="Invoice Date *" error={errors.invoiceDate}><div className="relative"><Input type="date" required className={`${input} pr-9`} value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)}/><CalendarDays className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/></div></Field>
        <Field label="Due Date"><div className="relative"><Input type="date" className={`${input} pr-9`} value={dueDate} onChange={e=>setDueDate(e.target.value)}/><CalendarDays className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/></div></Field>
        <Field label="Currency"><select value={currency} onChange={e=>setCurrency(e.target.value)} className={select}>{activeCurrencies.map(option=><option key={option.id} value={option.name}>{option.name}</option>)}</select></Field>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Field label="Payment Terms"><Input className={input} list="payment-term-options" value={paymentTerms} onChange={e=>applyPaymentTerms(e.target.value)} placeholder="Net 30"/><datalist id="payment-term-options">{termOptions.map(option=><option key={option.id} value={option.name}/>)}</datalist></Field>
        <Field label="PO Number" error={errors.poNumber || (duplicatePo?`Already used on invoice ${duplicatePo.invoiceNumber}.`:'')}><Input aria-invalid={!!errors.poNumber||!!duplicatePo} className={input} value={poNumber} onChange={e=>setPoNumber(e.target.value)} placeholder="PO-2026-001"/></Field>
        <Field label="PO Date"><div className="relative"><Input type="date" className={`${input} pr-9`} value={poDate} onChange={e=>setPoDate(e.target.value)}/><CalendarDays className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/></div></Field>
        <Field label="Status"><select value={status} onChange={e=>setStatus(e.target.value as InvoiceStatus)} className={select}>{Object.keys(STATUS_STYLES).map(s=><option key={s} value={s}>{s.replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}</select></Field>
        <Field label="Notes"><Input className={input} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Invoice notes..."/></Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
        {canChooseLocation&&<label className="inline-flex items-center gap-2 text-xs font-medium">Invoice site<select required aria-invalid={!!errors.location} value={siteId} onChange={event=>setSiteId(event.target.value)} className={`h-8 min-w-44 rounded-md border bg-background px-2 text-xs ${errors.location?'border-destructive':''}`}><option value="">Select site</option>{sitesList.map(location=><option key={location.id} value={location.id}>{location.name}</option>)}</select>{errors.location&&<span className="text-xs text-destructive">{errors.location}</span>}</label>}
        <span className="text-xs font-medium">Original invoice</span>
        <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium hover:bg-muted">
          <Paperclip className="h-3.5 w-3.5" /> {attachmentName ? 'Replace attachment' : 'Attach PDF or image'}
          <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={event=>attachFile(event.target.files?.[0])}/>
        </label>
        {attachmentName&&<><span className="max-w-[280px] truncate text-xs text-muted-foreground">{attachmentName}</span><Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={()=>{setAttachmentName('');setAttachmentType('');setAttachmentDataUrl('');setDirty(true)}}>Remove</Button></>}
        {errors.attachment&&<span className="text-xs text-destructive">{errors.attachment}</span>}
        <span className="text-[11px] text-muted-foreground sm:ml-auto">PDF, JPG, PNG or WebP · maximum 2 MB</span>
      </div>
    </section>

    {sameYearDuplicate && (
      <div className="mt-4 flex shrink-0 items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="flex-1"><span className="font-medium">{sameYearDuplicate.status==='draft'?'Existing draft found.':'Possible duplicate invoice.'}</span> Invoice {sameYearDuplicate.invoiceNumber} already exists for this vendor in {invoiceYear}. {sameYearDuplicate.status==='draft'?'Return to the invoice list and continue editing that draft.':'Review the existing invoice before creating another.'}</div>
      </div>
    )}
    {!sameYearDuplicate&&priorYearDuplicates.length>0&&(
      <div className="mt-4 flex shrink-0 items-start gap-2 rounded-md border border-chart-5/30 bg-chart-5/5 px-3 py-2.5 text-sm text-foreground">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-chart-5" />
        <div className="flex-1"><span className="font-medium">Invoice number used in a previous year.</span> This vendor used {invoiceNumber.trim()} in {Array.from(new Set(priorYearDuplicates.map(existing=>new Date(`${existing.invoiceDate}T00:00:00`).getFullYear()))).sort().join(', ')}. The current date is in {invoiceYear}; you will be asked to confirm before saving.</div>
      </div>
    )}
    {errors.items&&<div className="mt-4 flex shrink-0 items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"><AlertTriangle className="h-4 w-4"/>{errors.items}</div>}

    <section className="py-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h3 className="text-base font-semibold">Invoice items</h3><p className="text-xs text-muted-foreground">Enter what was purchased, then add its asset and pricing information.</p></div>
        <Button type="button" variant="outline" size="sm" className="border-primary text-primary" onClick={()=>{setDirty(true);setItems(a=>[...a,emptyLine(defaultCategory)])}}><Plus className="mr-1.5 h-4 w-4"/>Add line item</Button>
      </div>
      <div className="mt-5 hidden grid-cols-[36px_minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,1fr)_64px_72px_96px_64px_104px_36px] gap-2 border-y bg-muted/40 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:grid">
        <span className="text-center">#</span><span>Item</span><span>Description</span><span>Category</span><span>Manufacturer</span><span>Model</span><span className="text-right">Qty</span><span>Unit</span><span className="text-right">Unit price</span><span className="text-right">Tax %</span><span className="text-right">Amount</span><span className="sr-only">Actions</span>
      </div>
      <div>
        {items.map((item,index)=>{const amount=item.quantity*item.unitPrice*(1+item.taxRate/100);return <div key={item.id} className="border-b py-5 last:border-b-0 xl:py-2.5">
          <div className="mb-4 flex items-start justify-between gap-4 xl:hidden"><div className="flex min-w-0 items-center gap-3"><span className="flex h-7 min-w-7 items-center justify-center rounded bg-muted px-1.5 text-xs font-semibold tabular-nums text-muted-foreground">{index+1}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.description || `New line item`}</p><p className="text-xs text-muted-foreground">Product, asset and pricing information</p></div></div><div className="flex shrink-0 items-center gap-3"><div className="text-right"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Amount</p><p className="text-sm font-semibold tabular-nums">{money(amount,currency)}</p></div><Button type="button" variant="ghost" size="icon-sm" onClick={()=>removeLine(item.id)} aria-label={`Remove line item ${index+1}`}><Trash2 className="h-4 w-4 text-destructive"/></Button></div></div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 xl:grid-cols-[36px_minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,1fr)_64px_72px_96px_64px_104px_36px] xl:items-start xl:gap-2 xl:px-2 xl:[&>div]:space-y-0">
            <div className="hidden h-9 items-center justify-center text-xs font-medium tabular-nums text-muted-foreground xl:flex">{index+1}</div>
            <Field label="Item name *" labelClassName="xl:sr-only"><Input required list="invoice-item-suggestions" className={input} value={item.description} onChange={e=>update(item.id,{description:e.target.value})} placeholder="Item name"/></Field>
            <Field label="Item description" labelClassName="xl:sr-only"><Input className={input} value={item.itemDescription||''} onChange={e=>update(item.id,{itemDescription:e.target.value})} placeholder="Description"/></Field>
            <Field label="Asset category" labelClassName="xl:sr-only"><select value={item.assetType||defaultCategory} onChange={e=>update(item.id,{assetType:e.target.value as AssetType})} className={select}>{!activeCategories.some(category=>category.id===item.assetType)&&item.assetType&&<option value={item.assetType}>{assetCategories.find(category=>category.id===item.assetType)?.name||item.assetType}</option>}{activeCategories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
            <Field label="Manufacturer" labelClassName="xl:sr-only"><Input className={input} value={item.manufacturer||''} onChange={e=>update(item.id,{manufacturer:e.target.value})} placeholder="Manufacturer"/></Field>
            <Field label="Model" labelClassName="xl:sr-only"><Input className={input} value={item.model||''} onChange={e=>update(item.id,{model:e.target.value})} placeholder="Model"/></Field>
            <Field label="Quantity" labelClassName="xl:sr-only"><Input type="number" min="1" className={`${input} text-right`} value={item.quantity} onChange={e=>update(item.id,{quantity:Math.max(1,Number(e.target.value)||1)})}/></Field>
            <Field label="Purchase unit" labelClassName="xl:sr-only"><select value={item.unit||unitOptions.find(option=>option.active)?.name||''} onChange={event=>update(item.id,{unit:event.target.value})} className={select}>{unitOptions.filter(option=>option.active&&option.name.trim()).map(option=><option key={option.id} value={option.name}>{option.name}</option>)}</select></Field>
            <Field label="Unit price" labelClassName="xl:sr-only"><Input type="number" min="0" step="0.01" className={`${input} text-right`} value={item.unitPrice} onChange={e=>update(item.id,{unitPrice:Number(e.target.value)||0})}/></Field>
            <Field label="Tax rate %" labelClassName="xl:sr-only"><Input type="number" min="0" step="0.01" className={`${input} text-right`} value={item.taxRate} onChange={e=>update(item.id,{taxRate:Number(e.target.value)||0})}/></Field>
            <div className="hidden h-9 items-center justify-end text-sm font-semibold tabular-nums xl:flex">{money(amount,currency)}</div>
            <Button type="button" variant="ghost" size="icon-sm" className="hidden xl:inline-flex" onClick={()=>removeLine(item.id)} aria-label={`Remove line item ${index+1}`}><Trash2 className="h-4 w-4 text-destructive"/></Button>
          </div>
        </div>})}
      </div>
      <datalist id="invoice-item-suggestions">{itemSuggestions.map(item=><option key={item} value={item}/>)}</datalist>
    </section>

    <section className="sticky bottom-0 z-20 -mx-4 min-w-0 border-t bg-background/95 px-4 py-4 shadow-[0_-8px_24px_-18px_rgba(15,23,42,0.35)] backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"><div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="text-xs text-muted-foreground flex items-center gap-2"><Rows3 className="h-4 w-4"/>{items.length} line item{items.length===1?'':'s'} • {items.reduce((s,i)=>s+i.quantity,0)} total units</div>
      <div className="flex min-w-0 flex-wrap items-end justify-end gap-3"><div className="w-[280px] max-w-full px-1 py-1">
        <div className="flex justify-between text-sm"><span>Taxable value</span><span>{money(subtotal,currency)}</span></div><div className="mt-1.5 flex justify-between text-sm"><span>Tax amount</span><span>{money(taxTotal,currency)}</span></div><div className="mt-2 border-t pt-2 flex justify-between text-base font-bold"><span>Total including tax</span><span>{money(total,currency)}</span></div>
      </div><div className="flex shrink-0 gap-2 sm:hidden">{(!invoice||invoice.status==='draft')&&<Button type="submit" variant="outline" formNoValidate onClick={()=>{submitIntent.current='draft'}}>Save Draft</Button>}<Button type="submit" onClick={()=>{submitIntent.current='final'}}>{invoice?'Update':'Create'}</Button></div></div>
    </div>
    </section>
    </div>

    <Dialog open={showCreateVendor} onOpenChange={setShowCreateVendor}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Vendor</DialogTitle>
          <DialogDescription>
            Add the vendor here without leaving the invoice entry screen. The new vendor will be immediately available in the Vendor dropdown.
          </DialogDescription>
        </DialogHeader>
        <QuickVendorForm
          onCancel={() => setShowCreateVendor(false)}
          onCreate={(vendor) => {
            onVendorsChange([...vendors, vendor]);
            setVendorId(vendor.id);
            setDirty(true);
            if (vendor.currency) setCurrency(vendor.currency);
            setShowCreateVendor(false);
          }}
          nextId={vendors.length + 1}
        />
      </DialogContent>
    </Dialog>
  </form>;
}


function QuickVendorForm({
  onCancel,
  onCreate,
  nextId
}: {
  onCancel: () => void;
  onCreate: (vendor: Vendor) => void;
  nextId: number;
}) {
  const [currencyOptions]=useCollection<MasterDataOption>('currencies');
  const [policies]=useCollection<SystemPolicy>('system-policies');
  const policy=policies[0]||DEFAULT_SYSTEM_POLICY;
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [taxId, setTaxId] = useState('');
  const [currency, setCurrency] = useState(currencyOptions.find(option=>option.id===policy.defaultCurrency)?.name||currencyOptions.find(option=>option.active)?.name||policy.defaultCurrency);

  const submit = (e: FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Vendor Name is required.');
      return;
    }

    onCreate({
      id: `VND-${String(nextId).padStart(3, '0')}`,
      name: trimmedName,
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email.trim(),
      website: website.trim(),
      address: address.trim(),
      taxId: taxId.trim(),
      currency
    });
  };

  const input = 'h-9 rounded-md border border-input bg-background px-2.5 text-sm shadow-none focus:outline-none focus:ring-2 focus:ring-ring';
  const select = 'h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Vendor Name *">
          <Input autoFocus required className={input} value={name} onChange={e=>setName(e.target.value)} placeholder="Dell Technologies" />
        </Field>
        <Field label="Contact Person">
          <Input className={input} value={contactPerson} onChange={e=>setContactPerson(e.target.value)} placeholder="Contact name" />
        </Field>
        <Field label="Phone">
          <Input className={input} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91..." />
        </Field>
        <Field label="Email">
          <Input type="email" className={input} value={email} onChange={e=>setEmail(e.target.value)} placeholder="sales@vendor.com" />
        </Field>
        <Field label="Website">
          <Input className={input} value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://..." />
        </Field>
        <Field label="Tax ID / GSTIN">
          <Input className={input} value={taxId} onChange={e=>setTaxId(e.target.value)} placeholder="GSTIN / Tax ID" />
        </Field>
        <Field label="Currency">
          <select className={select} value={currency} onChange={e=>setCurrency(e.target.value)}>
            {currencyOptions.filter(option=>option.active&&option.name.trim()).map(option=><option key={option.id} value={option.name}>{option.name}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Address">
            <Input className={input} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Vendor address" />
          </Field>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit"><Plus className="mr-2 h-4 w-4" />Create Vendor</Button>
      </DialogFooter>
    </form>
  );
}

function InvoiceDetails({
  invoice,
  vendorName,
  sitesList,
  assetsList,
  history,
  onClose,
  onReceive,
  onPayment
}: {
  invoice: Invoice;
  vendorName: string;
  sitesList: Location[];
  assetsList: Asset[];
  history: AssetHistoryEvent[];
  onClose: () => void;
  onReceive: () => void;
  onPayment: () => void;
}) {
  const received = invoice.lineItems.reduce((s, i) => s + i.receivedQuantity, 0);
  const qty = invoice.lineItems.reduce((s, i) => s + i.quantity, 0);
  const remaining = Math.max(0, qty - received);
  const receivingPercent = qty ? Math.min(100, Math.round((received / qty) * 100)) : 0;
  const paidPercent = invoice.total ? Math.min(100, Math.round((invoice.amountPaid / invoice.total) * 100)) : 0;
  const outstanding = Math.max(0, invoice.total - invoice.amountPaid);
  const linkedAssets = assetsList.filter(asset => asset.invoiceId === invoice.id);
  const linkedAssetIds = new Set(linkedAssets.map(asset => asset.id));
  const activity = history
    .filter(event => linkedAssetIds.has(event.assetId))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 12);

  return (
    <div className="flex min-h-0 min-w-0 max-h-[calc(100vh-32px)] flex-col">
      <DialogHeader className="shrink-0 border-b px-4 py-4 pr-12 sm:px-6">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <DialogTitle className="truncate">Invoice {invoice.invoiceNumber}</DialogTitle>
            <DialogDescription className="truncate">{vendorName} · Invoice date {formatDate(invoice.invoiceDate)}</DialogDescription>
          </div>
          <Badge variant="outline" className={`w-fit shrink-0 ${STATUS_STYLES[invoice.status]}`}>
            {invoice.status.replace('-', ' ')}
          </Badge>
        </div>
      </DialogHeader>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto px-4 py-4 sm:px-6">
        <div className="space-y-5">
        {/* Financial summary */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Summary label="Invoice Total" value={money(invoice.total, invoice.currency)} />
          <Summary label="Amount Paid" value={money(invoice.amountPaid, invoice.currency)} />
          <Summary label="Outstanding" value={money(outstanding, invoice.currency)} />
          <Summary label="Assets Created" value={`${linkedAssets.length}`} />
        </div>

        {/* Invoice information */}
        <div className="rounded-lg border">
          <div className="border-b bg-muted/30 px-4 py-3">
            <h3 className="font-semibold">Invoice Information</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Vendor" value={vendorName} />
            <Info label="Invoice Site" value={sitesList.find(location=>location.id===invoice.siteId)?.name || '—'} />
            <Info label="Invoice Number" value={invoice.invoiceNumber} />
            <Info label="Invoice Date" value={formatDate(invoice.invoiceDate)} />
            <Info label="Due Date" value={invoice.dueDate ? formatDate(invoice.dueDate) : '—'} />
            <Info label="Currency" value={invoice.currency} />
            <Info label="Payment Terms" value={invoice.paymentTerms || '—'} />
            <Info label="PO Number" value={invoice.poNumber || '—'} />
            <Info label="PO Date" value={invoice.poDate ? formatDate(invoice.poDate) : '—'} />
            <Info label="Created" value={formatDate(invoice.createdAt)} />
          </div>
        </div>

        {/* Progress */}
        <div className="grid gap-4 md:grid-cols-2">
          <ProgressCard
            title="Receiving Progress"
            value={`${received} / ${qty} units`}
            percent={receivingPercent}
            detail={remaining > 0 ? `${remaining} units remaining` : 'All ordered units received'}
          />
          <ProgressCard
            title="Payment Progress"
            value={`${money(invoice.amountPaid, invoice.currency)} / ${money(invoice.total, invoice.currency)}`}
            percent={paidPercent}
            detail={outstanding > 0 ? `${money(outstanding, invoice.currency)} outstanding` : 'Fully paid'}
          />
        </div>

        {/* Line items */}
        <div>
          <h3 className="mb-2 font-semibold">Invoice Line Items</h3>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Asset Type</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lineItems.map(item => {
                  const itemRemaining = Math.max(0, item.quantity - item.receivedQuantity);
                  const lineTotal = item.quantity * item.unitPrice * (1 + item.taxRate / 100);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-medium">{item.description}</p>
                        {(item.manufacturer || item.model) && (
                          <p className="text-xs text-muted-foreground">
                            {[item.manufacturer, item.model].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">{item.assetType || 'accessory'}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.receivedQuantity}</TableCell>
                      <TableCell>{itemRemaining}</TableCell>
                      <TableCell>{money(item.unitPrice, invoice.currency)}</TableCell>
                      <TableCell>{item.taxRate}%</TableCell>
                      <TableCell className="text-right font-medium">{money(lineTotal, invoice.currency)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full max-w-sm rounded-lg border bg-muted/20 p-4 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{money(invoice.subtotal, invoice.currency)}</span></div>
            <div className="mt-2 flex justify-between"><span>Tax</span><span>{money(invoice.taxTotal, invoice.currency)}</span></div>
            <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{money(invoice.total, invoice.currency)}</span></div>
            <div className="mt-2 flex justify-between"><span>Paid</span><span>{money(invoice.amountPaid, invoice.currency)}</span></div>
            <div className="mt-1 flex justify-between font-semibold"><span>Outstanding</span><span>{money(outstanding, invoice.currency)}</span></div>
          </div>
        </div>

        {/* Linked assets */}
        <div className="rounded-lg border">
          <div className="border-b bg-muted/30 px-4 py-3">
            <h3 className="font-semibold">Assets Created From This Invoice</h3>
          </div>
          {linkedAssets.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No assets have been created from this invoice yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset Tag</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Manufacturer / Model</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Site</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedAssets.map(asset => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">{asset.assetTag}</TableCell>
                      <TableCell>{asset.name}</TableCell>
                      <TableCell className="capitalize">{asset.type}</TableCell>
                      <TableCell>{[asset.manufacturer, asset.model].filter(Boolean).join(' · ') || '—'}</TableCell>
                      <TableCell><Badge variant="outline">{asset.status.replace('-', ' ')}</Badge></TableCell>
                      <TableCell>{asset.siteId || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Latest payment */}
        <div className="rounded-lg border">
          <div className="border-b bg-muted/30 px-4 py-3">
            <h3 className="font-semibold">Latest Payment</h3>
          </div>
          {invoice.paymentDate || invoice.paymentReference || invoice.paymentMethod ? (
            <div className="grid grid-cols-2 gap-4 p-4 text-sm md:grid-cols-3">
              <Info label="Payment Date" value={invoice.paymentDate ? formatDate(invoice.paymentDate) : '—'} />
              <Info label="Payment Method" value={invoice.paymentMethod || '—'} />
              <Info label="Reference" value={invoice.paymentReference || '—'} />
            </div>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">No payment has been recorded yet.</div>
          )}
        </div>

        {/* Activity */}
        <div className="rounded-lg border">
          <div className="border-b bg-muted/30 px-4 py-3">
            <h3 className="font-semibold">Invoice Activity</h3>
          </div>
          {activity.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No asset activity is linked to this invoice yet.
            </div>
          ) : (
            <div className="divide-y">
              {activity.map(event => {
                const asset = linkedAssets.find(a => a.id === event.assetId);
                return (
                  <div key={event.id} className="flex gap-3 px-4 py-3 text-sm">
                    <div className="mt-0.5"><CheckCircle2 className="h-4 w-4 text-muted-foreground" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{event.action}</span>
                        {asset && <Badge variant="outline">{asset.assetTag}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(event.timestamp)} · {event.performedBy}
                      </p>
                      {event.notes && <p className="mt-1 text-xs text-muted-foreground">{event.notes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {invoice.attachmentDataUrl && invoice.attachmentName && (
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="min-w-0"><p className="text-sm font-medium">Original invoice attachment</p><p className="truncate text-xs text-muted-foreground">{invoice.attachmentName}</p></div>
            <Button asChild size="sm" variant="outline"><a href={invoice.attachmentDataUrl} download={invoice.attachmentName}><Download className="h-4 w-4"/>Download</a></Button>
          </div>
        )}

        {invoice.notes && (
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p className="mb-1 font-medium">Notes</p>
            {invoice.notes}
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          {remaining > 0 && invoice.status !== 'cancelled' && (
            <Button onClick={onReceive}>
              <PackagePlus className="mr-2 h-4 w-4" />
              Receive & Create Assets
            </Button>
          )}
          {outstanding > 0 && invoice.status !== 'cancelled' && (
            <Button variant="outline" onClick={onPayment}>
              <CreditCard className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
        </div>
      </div>
    </div>
  );
}

const FALLBACK_PAYMENT_METHODS = ['Bank Transfer', 'UPI', 'Cheque', 'Cash', 'Credit/Debit Card', 'Other'];

function PaymentForm({invoice,onSubmit,onCancel}:{invoice:Invoice;onSubmit:(data:{amount:number;date:string;reference:string;method:string})=>void;onCancel:()=>void}) {
  const [methodRecords]=useCollection<MasterDataOption>('payment-methods');
  const PAYMENT_METHODS=methodRecords.filter(option=>option.active&&option.name.trim()).map(option=>option.name);
  if(!PAYMENT_METHODS.length)PAYMENT_METHODS.push(...FALLBACK_PAYMENT_METHODS);
  if(invoice.paymentMethod&&!PAYMENT_METHODS.includes(invoice.paymentMethod))PAYMENT_METHODS.push(invoice.paymentMethod);
  const outstanding = Math.max(0, Math.round((invoice.total - invoice.amountPaid) * 100) / 100);
  const [amount,setAmount]=useState(String(outstanding));
  const [date,setDate]=useState(new Date().toISOString().split('T')[0]);
  const [method,setMethod]=useState(invoice.paymentMethod && PAYMENT_METHODS.includes(invoice.paymentMethod) ? invoice.paymentMethod : PAYMENT_METHODS[0]);
  const [reference,setReference]=useState('');
  const value=Number(amount);
  const error = !amount || !Number.isFinite(value) || value<=0
    ? 'Enter an amount greater than zero.'
    : value>outstanding ? `Cannot exceed the outstanding balance of ${money(outstanding,invoice.currency)}.` : '';
  const select='h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

  const submit=(e:FormEvent)=>{
    e.preventDefault();
    if (error) return;
    onSubmit({amount:Math.round(value*100)/100,date,reference:reference.trim(),method});
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Summary label="Invoice total" value={money(invoice.total,invoice.currency)} />
        <Summary label="Paid so far" value={money(invoice.amountPaid,invoice.currency)} />
        <Summary label="Outstanding" value={money(outstanding,invoice.currency)} />
      </div>
      <Field label="Amount *" error={error}>
        <div className="flex gap-2">
          <Input type="number" min="0" step="0.01" max={outstanding} value={amount} onChange={e=>setAmount(e.target.value)} autoFocus required />
          <Button type="button" variant="outline" onClick={()=>setAmount(String(outstanding))}>Full</Button>
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Payment date *"><Input type="date" value={date} max={new Date().toISOString().split('T')[0]} onChange={e=>setDate(e.target.value)} required /></Field>
        <Field label="Method"><select className={select} value={method} onChange={e=>setMethod(e.target.value)}>{PAYMENT_METHODS.map(m=><option key={m}>{m}</option>)}</select></Field>
      </div>
      <Field label="Reference (UTR / cheque no. / transaction id)"><Input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Optional" /></Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={!!error}>Record payment</Button>
      </DialogFooter>
    </form>
  );
}

function Field({label,children,error,labelClassName=''}:{label:string;children:ReactNode;error?:string;labelClassName?:string}) {
  return (
    <div className="space-y-1.5">
      <label className={`text-sm font-medium ${labelClassName}`}>{label}</label>
      {children}
      {error&&<p className="text-[11px] leading-4 text-destructive">{error}</p>}
    </div>
  );
}

function Summary({label,value}:{label:string;value:string}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-medium">{value}</p>
    </div>
  );
}

function Info({label,value}:{label:string;value:string}) {
  return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate font-medium">{value}</p></div>;
}

function ProgressCard({title,value,percent,detail}:{title:string;value:string;percent:number;detail:string}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>
        <span className="text-sm font-medium">{percent}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{width:`${percent}%`}} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

