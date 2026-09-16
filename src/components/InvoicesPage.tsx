import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Plus, Search, Eye, Edit, Trash2, PackagePlus, CheckCircle2, CreditCard, ArrowLeft, X, CalendarDays, Rows3, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  type Invoice, type InvoiceLineItem, type InvoiceStatus, type Asset, type AssetType,
  type Vendor, type User, type AssetHistoryEvent, formatCurrency, formatDate
} from '@/data/sampleData';

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
}

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: 'bg-muted text-muted-foreground border-muted',
  received: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  'partially-received': 'bg-chart-5/10 text-chart-5 border-chart-5/20',
  paid: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  'partially-paid': 'bg-chart-5/10 text-chart-5 border-chart-5/20',
  overdue: 'bg-destructive/10 text-destructive border-destructive/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20'
};

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  ['laptop','Laptop'],['desktop','Desktop'],['monitor','Monitor'],['phone','Phone'],
  ['tablet','Tablet'],['printer','Printer'],['server','Server'],['accessory','Accessory']
].map(([value,label]) => ({ value: value as AssetType, label }));

const CURRENCIES = [
  'USD - US Dollar','INR - Indian Rupee','EUR - Euro','GBP - British Pound',
  'AED - UAE Dirham','SGD - Singapore Dollar','AUD - Australian Dollar',
  'CAD - Canadian Dollar','JPY - Japanese Yen'
];

type EditableInvoiceLineItem = InvoiceLineItem & { itemDescription?: string };

const emptyLine = (): EditableInvoiceLineItem => ({
  id: `INVL-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
  description: '', quantity: 1, unitPrice: 0, taxRate: 0, assetType: 'laptop',
  manufacturer: '', model: '', receivedQuantity: 0
});

function money(value: number, currency: string) {
  const code = currency.split(' ')[0] || 'USD';
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(value); }
  catch { return formatCurrency(value); }
}

export function InvoicesPage({
  invoicesList, onInvoicesChange, assetsList, onAssetsChange, vendorsList,
  onVendorsChange, currentUser, history, onHistoryChange
}: InvoicesPageProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [receiving, setReceiving] = useState<Invoice | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);

  const vendorName = (id: string) => vendorsList.find(v => v.id === id)?.name || 'Unknown vendor';
  const filtered = invoicesList.filter(invoice => {
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

  const deleteInvoice = (invoice: Invoice) => {
    if (invoice.lineItems.some(i => i.receivedQuantity > 0)) {
      alert('This invoice has received items linked to assets and cannot be deleted.'); return;
    }
    if (confirm(`Delete invoice ${invoice.invoiceNumber}?`))
      onInvoicesChange(invoicesList.filter(i => i.id !== invoice.id));
  };

  const handleReceive = (invoice: Invoice, receiveQuantities: Record<string, number>) => {
    let nextAssets = [...assetsList];
    const events: AssetHistoryEvent[] = [];
    const nextItems = invoice.lineItems.map(item => {
      const remaining = Math.max(0, item.quantity - item.receivedQuantity);
      const requested = Math.max(0, Math.min(remaining, Math.floor(receiveQuantities[item.id] ?? remaining)));
      for (let index=0; index<requested; index++) {
        const n = nextAssets.length + 1;
        const asset: Asset = {
          id:`AST-${String(n).padStart(3,'0')}`, name:item.description,
          type:item.assetType || 'accessory',
          manufacturer:item.manufacturer || vendorName(invoice.vendorId),
          model:item.model || item.description, serialNumber:'',
          assetTag:`AST-${String(n).padStart(3,'0')}`, status:'available',
          purchaseDate:invoice.invoiceDate, purchasePrice:item.unitPrice,
          warrantyExpiry:new Date(new Date(invoice.invoiceDate).setFullYear(new Date(invoice.invoiceDate).getFullYear()+1)).toISOString().split('T')[0],
          location:'IT Asset Manager', vendorId:invoice.vendorId, invoiceId:invoice.id,
          invoiceItemId:item.id, notes:`Purchased on invoice ${invoice.invoiceNumber}`
        };
        nextAssets.push(asset);
        const t = new Date().toISOString();
        events.push({ id:`HIST-${Date.now()}-${n}-${index}`, assetId:asset.id, timestamp:t, action:'Purchased',
          performedBy:currentUser.name, from:vendorName(invoice.vendorId), to:'IT Asset Manager',
          notes:`Purchased on invoice ${invoice.invoiceNumber}`, cost:item.unitPrice });
        events.push({ id:`HIST-${Date.now()}-${n}-${index}-received`, assetId:asset.id,
          timestamp:new Date(Date.now()+1).toISOString(), action:'Received',
          performedBy:currentUser.name, to:'IT Asset Manager',
          notes:`Received against invoice ${invoice.invoiceNumber}` });
      }
      return {...item, receivedQuantity:item.receivedQuantity + requested};
    });
    onAssetsChange(nextAssets);
    onHistoryChange([...history,...events]);
    const allReceived = nextItems.every(item => item.receivedQuantity >= item.quantity);
    const anyReceived = nextItems.some(item => item.receivedQuantity > 0);
    onInvoicesChange(invoicesList.map(i => i.id===invoice.id ? {
      ...invoice,
      lineItems: nextItems,
      status: (allReceived ? 'received' : anyReceived ? 'partially-received' : invoice.status) as InvoiceStatus
    } : i));
    setReceiving(null);
  };

  const handlePayment = (data:{amount:number;date:string;reference:string;method:string}) => {
    if (!paymentInvoice) return;
    const outstanding = Math.max(0, paymentInvoice.total - paymentInvoice.amountPaid);
    if (data.amount > outstanding) {
      alert(`Payment cannot exceed the outstanding balance of ${money(outstanding, paymentInvoice.currency)}.`);
      return;
    }
    const amountPaid = paymentInvoice.amountPaid + data.amount;
    const updated = {...paymentInvoice, amountPaid,
      status:(amountPaid >= paymentInvoice.total ? 'paid' : 'partially-paid') as InvoiceStatus,
      paymentDate:data.date,paymentReference:data.reference,paymentMethod:data.method};
    onInvoicesChange(invoicesList.map(i => i.id===paymentInvoice.id ? updated : i));
    setPaymentInvoice(null);
  };

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-bold">Invoices</h1><p className="text-muted-foreground">Record vendor invoices and link received items to assets.</p></div>
      <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2"/>Add Invoice</Button>
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
          {invoice.lineItems.some(i=>i.receivedQuantity<i.quantity) && invoice.status!=='cancelled' && <Button variant="ghost" size="icon-sm" title="Receive & Create Assets" onClick={()=>setReceiving(invoice)}><PackagePlus className="h-4 w-4"/></Button>}
          <Button variant="ghost" size="icon-sm" title="Delete" onClick={()=>deleteInvoice(invoice)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
        </div></TableCell>
      </TableRow>)}
    </TableBody></Table></CardContent></Card>

    <Dialog open={showCreate || !!editing} onOpenChange={open=>{if(!open){setShowCreate(false);setEditing(null)}}}>
      <DialogContent className="!w-[calc(100vw-32px)] !max-w-[1600px] !h-[calc(100vh-32px)] !max-h-[calc(100vh-32px)] p-0 gap-0 overflow-hidden rounded-lg">
        <InvoiceForm invoice={editing} invoices={invoicesList} vendors={vendorsList} onVendorsChange={onVendorsChange} onSubmit={editing?updateInvoice:createInvoice} onCancel={()=>{setShowCreate(false);setEditing(null)}}/>
      </DialogContent>
    </Dialog>

    <Dialog open={!!viewing} onOpenChange={open=>!open&&setViewing(null)}><DialogContent className="!w-fit !min-w-[min(760px,calc(100vw-32px))] !max-w-[calc(100vw-32px)] !h-auto !max-h-[calc(100vh-32px)] p-0 gap-0 overflow-hidden rounded-lg">
      {viewing&&<InvoiceDetails invoice={viewing} vendorName={vendorName(viewing.vendorId)} assetsList={assetsList} history={history} onClose={()=>setViewing(null)} onReceive={()=>{setViewing(null);setReceiving(viewing)}} onPayment={()=>{setViewing(null);setPaymentInvoice(viewing)}}/>}
    </DialogContent></Dialog>

    <Dialog open={!!receiving} onOpenChange={open=>!open&&setReceiving(null)}><DialogContent className="max-w-3xl">
      <DialogHeader><DialogTitle>Receive Invoice Items & Create Assets</DialogTitle><DialogDescription>Each remaining unit will become an available asset in IT Asset Manager.</DialogDescription></DialogHeader>
      {receiving&&<ReceiveItemsForm invoice={receiving} onCancel={()=>setReceiving(null)} onConfirm={(quantities)=>handleReceive(receiving, quantities)}/>}
    </DialogContent></Dialog>

    <Dialog open={!!paymentInvoice} onOpenChange={open=>!open&&setPaymentInvoice(null)}><DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Record Payment</DialogTitle><DialogDescription>{paymentInvoice?.invoiceNumber}</DialogDescription></DialogHeader>
      {paymentInvoice&&<PaymentForm invoice={paymentInvoice} onSubmit={handlePayment} onCancel={()=>setPaymentInvoice(null)}/>}
    </DialogContent></Dialog>
  </div>;
}

function InvoiceForm({invoice,invoices,vendors,onVendorsChange,onSubmit,onCancel}:{invoice:Invoice|null;invoices:Invoice[];vendors:Vendor[];onVendorsChange:(vendors:Vendor[])=>void;onSubmit:(data:Omit<Invoice,'id'|'createdAt'>)=>void;onCancel:()=>void}) {
  const [vendorId,setVendorId]=useState(invoice?.vendorId||vendors[0]?.id||'');
  const [invoiceNumber,setInvoiceNumber]=useState(invoice?.invoiceNumber||'');
  const [invoiceDate,setInvoiceDate]=useState(invoice?.invoiceDate||new Date().toISOString().split('T')[0]);
  const [dueDate,setDueDate]=useState(invoice?.dueDate||'');
  const [currency,setCurrency]=useState(invoice?.currency||vendors[0]?.currency||CURRENCIES[0]);
  const [paymentTerms,setPaymentTerms]=useState(invoice?.paymentTerms||'');
  const [poNumber,setPoNumber]=useState(invoice?.poNumber||'');
  const [status,setStatus]=useState<InvoiceStatus>(invoice?.status||'draft');
  const [notes,setNotes]=useState(invoice?.notes||'');
  const [items,setItems]=useState<EditableInvoiceLineItem[]>(invoice?.lineItems||[emptyLine(),emptyLine()]);
  const [selectedRows,setSelectedRows]=useState<string[]>([]);
  const [showCreateVendor, setShowCreateVendor] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const subtotal=useMemo(()=>items.reduce((s,i)=>s+i.quantity*i.unitPrice,0),[items]);
  const taxTotal=useMemo(()=>items.reduce((s,i)=>s+i.quantity*i.unitPrice*i.taxRate/100,0),[items]);
  const total=subtotal+taxTotal;
  const update=(id:string,patch:Partial<EditableInvoiceLineItem>)=>setItems(a=>a.map(i=>i.id===id?{...i,...patch}:i));
  const toggleRow=(id:string)=>setSelectedRows(a=>a.includes(id)?a.filter(x=>x!==id):[...a,id]);
  const removeSelected=()=>{setItems(a=>{const remaining=a.filter(i=>!selectedRows.includes(i.id));return remaining.length?remaining:[emptyLine()]});setSelectedRows([])};
  const input='h-9 rounded-md border border-input bg-background px-2.5 text-sm shadow-none focus:outline-none focus:ring-2 focus:ring-ring';
  const select='h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

  const submit=(e:FormEvent)=>{e.preventDefault();
    const normalizedNumber=invoiceNumber.trim().toLowerCase();
    if(!vendorId||!invoiceNumber.trim()||items.some(i=>!i.description.trim()||i.quantity<1)){alert('Please select a vendor, enter an invoice number, and complete every line item.');return;}
    const duplicate=invoices.find(i=>
      i.id!==invoice?.id && i.vendorId===vendorId && i.invoiceNumber.trim().toLowerCase()===normalizedNumber
    );
    if(duplicate){setDuplicateWarning(`Invoice ${invoiceNumber.trim()} already exists for this vendor. Please check the invoice number before saving.`);return;}
    setDuplicateWarning('');
    onSubmit({vendorId,invoiceNumber:invoiceNumber.trim(),invoiceDate,dueDate:dueDate||undefined,currency,paymentTerms:paymentTerms.trim()||undefined,poNumber:poNumber.trim()||undefined,status,notes:notes.trim()||undefined,subtotal,taxTotal,total,amountPaid:invoice?.amountPaid||0,paymentDate:invoice?.paymentDate,paymentReference:invoice?.paymentReference,paymentMethod:invoice?.paymentMethod,lineItems:items});
  };

  return <form onSubmit={submit} className="flex h-full min-h-0 flex-col bg-background">
    <div className="flex shrink-0 items-center justify-between border-b px-5 py-3">
      <div className="flex items-center gap-3"><button type="button" onClick={onCancel} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><ArrowLeft className="h-5 w-5"/></button>
        <div><h2 className="text-xl font-bold">{invoice?'Edit Vendor Invoice':'Add Vendor Invoice'}</h2><p className="text-xs text-muted-foreground">Enter the invoice details and line items. Received asset items can be created from this invoice.</p></div>
      </div><button type="button" onClick={onCancel} className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted"><X className="h-5 w-5"/></button>
    </div>

    <div className="shrink-0 border-b bg-muted/10 px-5 py-3">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Field label="Vendor *"><select value={vendorId} onChange={e=>{if(e.target.value==='__create_vendor__'){setShowCreateVendor(true);return;}setVendorId(e.target.value);const v=vendors.find(x=>x.id===e.target.value);if(v?.currency)setCurrency(v.currency)}} className={select}>
          {vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
          <option value="__create_vendor__">＋ Create New Vendor</option>
        </select></Field>
        <Field label="Invoice Number *"><Input required className={input} value={invoiceNumber} onChange={e=>setInvoiceNumber(e.target.value)} placeholder="INV-2026-001"/></Field>
        <Field label="Invoice Date *"><div className="relative"><Input type="date" required className={`${input} pr-9`} value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)}/><CalendarDays className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/></div></Field>
        <Field label="Due Date"><div className="relative"><Input type="date" className={`${input} pr-9`} value={dueDate} onChange={e=>setDueDate(e.target.value)}/><CalendarDays className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/></div></Field>
        <Field label="Currency"><select value={currency} onChange={e=>setCurrency(e.target.value)} className={select}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select></Field>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Field label="Payment Terms"><Input className={input} value={paymentTerms} onChange={e=>setPaymentTerms(e.target.value)} placeholder="Net 30"/></Field>
        <Field label="PO Number"><Input className={input} value={poNumber} onChange={e=>setPoNumber(e.target.value)} placeholder="PO-2026-001"/></Field>
        <Field label="Status"><select value={status} onChange={e=>setStatus(e.target.value as InvoiceStatus)} className={select}>{Object.keys(STATUS_STYLES).map(s=><option key={s} value={s}>{s.replace('-',' ')}</option>)}</select></Field>
        <div className="xl:col-span-2"><Field label="Notes"><Input className={input} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Invoice notes..."/></Field></div>
      </div>
    </div>

    {duplicateWarning && (
      <div className="mx-5 mt-3 flex shrink-0 items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="flex-1">{duplicateWarning}</div>
      </div>
    )}

    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-3">
      <div className="mb-3 flex shrink-0 items-center justify-between"><div><h3 className="text-lg font-semibold">Invoice Items</h3><p className="text-xs text-muted-foreground">For IT hardware, choose the asset type so received items can be created automatically.</p></div>
        <div className="flex gap-2"><Button type="button" variant="outline" size="sm" className="border-primary text-primary" onClick={()=>setItems(a=>[...a,emptyLine()])}><Plus className="mr-1.5 h-4 w-4"/>Add Row</Button>
        <Button type="button" variant="outline" size="sm" disabled={!selectedRows.length} onClick={removeSelected}><Trash2 className="mr-1.5 h-4 w-4"/>Remove Selected</Button></div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-background">
        <table className="w-full min-w-[1280px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-muted/90"><tr className="border-b">
            {['#','ITEM','DESCRIPTION','ASSET TYPE','MANUFACTURER','MODEL','QTY','UNIT','PRICE/UNIT','TAX %','AMOUNT'].map((h,i)=><th key={i} className={`border-r px-3 py-2 text-left font-medium text-muted-foreground ${i===0?'w-12':i===1?'min-w-[210px]':i===2?'min-w-[220px]':i===3?'min-w-[145px]':i===4?'min-w-[155px]':i===5?'min-w-[165px]':i===6?'w-20':i===7?'w-28':i===8?'w-36':i===9?'w-24':'min-w-[145px]'}`}>{h}</th>)}<th className="w-14 border-l px-2 py-2 text-center"><input type="checkbox" checked={items.length>0&&selectedRows.length===items.length} onChange={e=>setSelectedRows(e.target.checked?items.map(i=>i.id):[])} className="h-4 w-4 rounded border-input accent-primary" aria-label="Select all rows"/></th>
          </tr></thead>
          <tbody>{items.map((item,index)=>{const amount=item.quantity*item.unitPrice*(1+item.taxRate/100);return <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20">
            <td className="border-r px-3 py-2 text-muted-foreground">{index+1}</td>
            <td className="border-r p-1.5"><Input required className={input} value={item.description} onChange={e=>update(item.id,{description:e.target.value})} placeholder="Dell Latitude 5420"/></td>
            <td className="border-r p-1.5"><Input className={input} value={item.itemDescription||''} onChange={e=>update(item.id,{itemDescription:e.target.value})} placeholder="Business Laptop"/></td>
            <td className="border-r p-1.5"><select value={item.assetType||'accessory'} onChange={e=>update(item.id,{assetType:e.target.value as AssetType})} className={select}>{ASSET_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></td>
            <td className="border-r p-1.5"><Input className={input} value={item.manufacturer||''} onChange={e=>update(item.id,{manufacturer:e.target.value})} placeholder="Dell"/></td>
            <td className="border-r p-1.5"><Input className={input} value={item.model||''} onChange={e=>update(item.id,{model:e.target.value})} placeholder="Latitude 5420"/></td>
            <td className="border-r p-1.5"><Input type="number" min="1" className={`${input} text-right`} value={item.quantity} onChange={e=>update(item.id,{quantity:Math.max(1,Number(e.target.value)||1)})}/></td>
            <td className="border-r p-1.5"><select defaultValue="Pcs" className={select}><option>Pcs</option><option>Nos</option><option>Unit</option><option>Set</option><option>Box</option><option>Pack</option></select></td>
            <td className="border-r p-1.5"><Input type="number" min="0" step="0.01" className={`${input} text-right`} value={item.unitPrice} onChange={e=>update(item.id,{unitPrice:Number(e.target.value)||0})}/></td>
            <td className="border-r p-1.5"><Input type="number" min="0" step="0.01" className={`${input} text-right`} value={item.taxRate} onChange={e=>update(item.id,{taxRate:Number(e.target.value)||0})}/></td>
            <td className="px-3 py-2 text-right font-medium tabular-nums">{money(amount,currency)}</td>
            <td className="border-l px-2 py-2 text-center"><input type="checkbox" checked={selectedRows.includes(item.id)} onChange={()=>toggleRow(item.id)} className="h-4 w-4 rounded border-input accent-primary" aria-label={`Select row ${index+1}`}/></td>
          </tr>})}</tbody>
          <tfoot className="bg-muted/20"><tr><td colSpan={6} className="px-3 py-3 text-right font-semibold">TOTAL</td><td className="px-3 py-3 text-right font-medium">{items.reduce((s,i)=>s+i.quantity,0)}</td><td colSpan={3}/><td className="px-3 py-3 text-right font-semibold">{money(total,currency)}</td><td/></tr></tfoot>
        </table>
      </div>
    </div>

    <div className="shrink-0 border-t px-5 py-3"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="text-xs text-muted-foreground flex items-center gap-2"><Rows3 className="h-4 w-4"/>{items.length} line item{items.length===1?'':'s'} • {items.reduce((s,i)=>s+i.quantity,0)} total units</div>
      <div className="flex items-end gap-6"><div className="min-w-[280px] rounded-md border bg-muted/20 px-4 py-3">
        <div className="flex justify-between text-sm"><span>Subtotal</span><span>{money(subtotal,currency)}</span></div><div className="mt-1.5 flex justify-between text-sm"><span>Tax</span><span>{money(taxTotal,currency)}</span></div><div className="mt-2 border-t pt-2 flex justify-between text-base font-bold"><span>Total</span><span>{money(total,currency)}</span></div>
      </div><div className="flex gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" className="min-w-[150px]">{invoice?'Update Invoice':'Create Invoice'}</Button></div></div>
    </div>
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
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState('Hardware');
  const [address, setAddress] = useState('');
  const [taxId, setTaxId] = useState('');
  const [currency, setCurrency] = useState('INR - Indian Rupee');

  const submit = (e: FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('Vendor Name is required.');
      return;
    }

    onCreate({
      id: `VND-${String(nextId).padStart(3, '0')}`,
      name: trimmedName,
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email.trim(),
      website: website.trim(),
      category,
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
        <Field label="Category">
          <select className={select} value={category} onChange={e=>setCategory(e.target.value)}>
            {['Hardware','Software','Services','Cloud','Telecom','Consulting','Other'].map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Tax ID / GSTIN">
          <Input className={input} value={taxId} onChange={e=>setTaxId(e.target.value)} placeholder="GSTIN / Tax ID" />
        </Field>
        <Field label="Currency">
          <select className={select} value={currency} onChange={e=>setCurrency(e.target.value)}>
            {CURRENCIES.map(c=><option key={c}>{c}</option>)}
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
  assetsList,
  history,
  onClose,
  onReceive,
  onPayment
}: {
  invoice: Invoice;
  vendorName: string;
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
            <Info label="Invoice Number" value={invoice.invoiceNumber} />
            <Info label="Invoice Date" value={formatDate(invoice.invoiceDate)} />
            <Info label="Due Date" value={invoice.dueDate ? formatDate(invoice.dueDate) : '—'} />
            <Info label="Currency" value={invoice.currency} />
            <Info label="Payment Terms" value={invoice.paymentTerms || '—'} />
            <Info label="PO Number" value={invoice.poNumber || '—'} />
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
                    <TableHead>Location</TableHead>
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
                      <TableCell>{asset.location || '—'}</TableCell>
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

function Field({label,children}:{label:string;children:ReactNode}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
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

