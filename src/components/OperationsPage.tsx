import { useEffect, useMemo, useState } from 'react';
import {
  Wrench, ClipboardList, BellRing, Calculator, QrCode, Upload, Download,
  Printer, CheckCircle2, Clock3, AlertTriangle, Plus, Trash2, Search,
  ShieldCheck, Server, Network, HardDrive, History, FileBarChart2,
  ArrowRightLeft, Boxes, Settings2, Eye, EyeOff, RefreshCw, Check,
  X, Activity, Database
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Asset, User, MaintenanceRecord, AssetHistoryEvent } from '@/data/sampleData';
import { formatCurrency, formatDate } from '@/data/sampleData';

type RequestStatus = 'pending' | 'approved' | 'rejected' | 'completed';
type AssetRequest = { id: string; userId: string; assetType: string; reason: string; date: string; status: RequestStatus };
type StockItem = { id: string; name: string; sku: string; category: string; quantity: number; minQuantity: number; unitCost: number; location: string };
type StockMovement = { id: string; stockId: string; itemName: string; type: 'received'|'issued'|'returned'|'adjusted'; quantity: number; before: number; after: number; reason: string; performedBy: string; timestamp: string };
type DeviceSpec = { assetId: string; enabled: boolean; hostname: string; os: string; osVersion: string; cpu: string; ram: string; storage: string; gpu: string; macAddress: string; ipAddress: string; biosVersion: string; encryption: boolean; antivirus: boolean; edr: boolean; lastCheckIn: string };
type Infrastructure = { id: string; name: string; type: 'server'|'router'|'switch'|'firewall'|'access-point'|'ups'|'printer'|'other'; ipAddress: string; macAddress: string; hostname: string; location: string; status: 'online'|'offline'|'maintenance'; vendor: string; model: string; notes: string };
type Notification = { id: string; title: string; detail: string; severity: 'info'|'warning'|'critical'; read: boolean; createdAt: string; tab?: string };
type AuditEvent = { id: string; timestamp: string; action: string; entityType: string; entityId: string; entityName: string; userName: string; details: string };

interface OperationsPageProps {
  assetsList: Asset[];
  onAssetsChange: (assets: Asset[]) => void;
  usersList: User[];
  history: AssetHistoryEvent[];
  onHistoryChange: (events: AssetHistoryEvent[]) => void;
  currentUser: User;
  initialTab?: string;
  onNotificationsChange?: (count: number) => void;
  notificationOpen?: boolean;
  onNotificationOpenChange?: (open: boolean) => void;
}

const requestSeed: AssetRequest[] = [
  { id: 'REQ-001', userId: 'USR-001', assetType: 'laptop', reason: 'New project equipment', date: new Date().toISOString().slice(0,10), status: 'pending' },
];

const defaultStock: StockItem[] = [
  { id:'STK-001', name:'USB-C Dock', sku:'DOCK-001', category:'Accessories', quantity:12, minQuantity:5, unitCost:85, location:'IT Store' },
  { id:'STK-002', name:'Wireless Mouse', sku:'MOU-001', category:'Accessories', quantity:24, minQuantity:10, unitCost:25, location:'IT Store' },
  { id:'STK-003', name:'Keyboard', sku:'KEY-001', category:'Accessories', quantity:18, minQuantity:8, unitCost:30, location:'IT Store' },
];

const defaultInfra: Infrastructure[] = [
  { id:'INF-001', name:'Core Switch', type:'switch', ipAddress:'192.168.1.2', macAddress:'00:11:22:33:44:55', hostname:'CORE-SW-01', location:'Head Office', status:'online', vendor:'Cisco', model:'Catalyst', notes:'' },
  { id:'INF-002', name:'Main Firewall', type:'firewall', ipAddress:'192.168.1.1', macAddress:'00:11:22:33:44:66', hostname:'FW-01', location:'Head Office', status:'online', vendor:'Fortinet', model:'FortiGate', notes:'' },
];

const blankSpec = (assetId: string): DeviceSpec => ({
  assetId, enabled: true, hostname:'', os:'', osVersion:'', cpu:'', ram:'', storage:'', gpu:'',
  macAddress:'', ipAddress:'', biosVersion:'', encryption:false, antivirus:false, edr:false, lastCheckIn:''
});

export function OperationsPage({ assetsList, onAssetsChange, usersList, history, onHistoryChange, currentUser, initialTab='overview', onNotificationsChange, notificationOpen=false, onNotificationOpenChange }: OperationsPageProps) {
  const [tab, setTab] = useState(initialTab);
  const [requests, setRequests] = useState<AssetRequest[]>(requestSeed);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [stock, setStock] = useState<StockItem[]>(defaultStock);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [specs, setSpecs] = useState<Record<string, DeviceSpec>>({});
  const [infra, setInfra] = useState<Infrastructure[]>(defaultInfra);
  const [notificationsRead, setNotificationsRead] = useState<Record<string, boolean>>({});
  const [showRequest, setShowRequest] = useState(false);
  const [showSpec, setShowSpec] = useState(false);
  const [showInfra, setShowInfra] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedInfraId, setSelectedInfraId] = useState('');
  const [myAssetUser, setMyAssetUser] = useState(usersList[0]?.id || '');
  const [requestUser, setRequestUser] = useState(usersList[0]?.id || '');
  const [requestType, setRequestType] = useState('laptop');
  const [requestReason, setRequestReason] = useState('');
  const [labelSearch, setLabelSearch] = useState('');
  const [deprYears, setDeprYears] = useState('4');
  const [deprMethod, setDeprMethod] = useState<'straight'|'none'>('straight');
  const [importMessage, setImportMessage] = useState('');
  const [stockSearch, setStockSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all'|'low'>('all');
  const [infraSearch, setInfraSearch] = useState('');
  const [reportRange, setReportRange] = useState<'all'|'year'|'30'>('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditAction, setAuditAction] = useState('all');
  const [auditEntity, setAuditEntity] = useState('all');
  const [infraForm, setInfraForm] = useState<Infrastructure>(defaultInfra[0]);

  useEffect(() => {
    try {
      const read = <T,>(key: string, fallback: T): T => {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      };
      setRequests(read('assetflow-asset-requests', requestSeed));
      setMaintenance(read('assetflow-maintenance', []));
      setStock(read('assetflow-stock', defaultStock));
      setMovements(read('assetflow-stock-movements', []));
      const savedSpecs = read<Record<string, DeviceSpec>>('assetflow-device-specs', {});
      const normalizedSpecs = { ...savedSpecs };
      assetsList.forEach(asset => {
        normalizedSpecs[asset.id] = {
          ...blankSpec(asset.id),
          ...(savedSpecs[asset.id] || {}),
          enabled: true,
        };
      });
      setSpecs(normalizedSpecs);
      setInfra(read('assetflow-infrastructure', defaultInfra));
      setNotificationsRead(read('assetflow-notifications-read', {}));
    } catch {}
  }, []);

  useEffect(() => { localStorage.setItem('assetflow-asset-requests', JSON.stringify(requests)); }, [requests]);
  useEffect(() => { localStorage.setItem('assetflow-maintenance', JSON.stringify(maintenance)); }, [maintenance]);
  useEffect(() => { localStorage.setItem('assetflow-stock', JSON.stringify(stock)); }, [stock]);
  useEffect(() => { localStorage.setItem('assetflow-stock-movements', JSON.stringify(movements)); }, [movements]);
  useEffect(() => { localStorage.setItem('assetflow-device-specs', JSON.stringify(specs)); }, [specs]);
  useEffect(() => { localStorage.setItem('assetflow-infrastructure', JSON.stringify(infra)); }, [infra]);
  useEffect(() => { localStorage.setItem('assetflow-notifications-read', JSON.stringify(notificationsRead)); }, [notificationsRead]);
  useEffect(() => { setTab(initialTab); }, [initialTab]);

  const warranty = useMemo(() => assetsList.map(a => {
    const expiry = new Date(a.warrantyExpiry);
    const days = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
    return { asset:a, days };
  }).filter(x => Number.isFinite(x.days) && x.days <= 90), [assetsList]);

  const notifications = useMemo<Notification[]>(() => {
    const result: Notification[] = [];
    warranty.forEach(x => result.push({
      id:`warranty-${x.asset.id}`, title:x.days < 0 ? 'Warranty expired' : 'Warranty expiring soon',
      detail:`${x.asset.assetTag} • ${x.asset.name} • ${x.days < 0 ? `${Math.abs(x.days)} days overdue` : `${x.days} days remaining`}`,
      severity:x.days < 0 ? 'critical' : 'warning', read:!!notificationsRead[`warranty-${x.asset.id}`], createdAt:x.asset.warrantyExpiry, tab:'overview'
    }));
    stock.filter(s => s.quantity <= s.minQuantity).forEach(s => result.push({
      id:`stock-${s.id}`, title:'Low stock', detail:`${s.name} • ${s.quantity} remaining (minimum ${s.minQuantity})`,
      severity:'warning', read:!!notificationsRead[`stock-${s.id}`], createdAt:new Date().toISOString(), tab:'stock'
    }));
    infra.filter(i => i.status === 'offline').forEach(i => result.push({
      id:`infra-${i.id}`, title:'Infrastructure device offline', detail:`${i.name} • ${i.hostname || i.ipAddress || 'No address'}`,
      severity:'critical', read:!!notificationsRead[`infra-${i.id}`], createdAt:new Date().toISOString(), tab:'infrastructure'
    }));
    requests.filter(r => r.status === 'pending').forEach(r => result.push({
      id:`request-${r.id}`, title:'Asset request awaiting approval', detail:r.id, severity:'info',
      read:!!notificationsRead[`request-${r.id}`], createdAt:r.date, tab:'requests'
    }));
    maintenance.filter(m => m.status !== 'completed').forEach(m => result.push({
      id:`maintenance-${m.id}`, title:'Maintenance in progress', detail:`${m.assetName} • ${m.description}`,
      severity:'info', read:!!notificationsRead[`maintenance-${m.id}`], createdAt:m.date, tab:'maintenance'
    }));
    return result;
  }, [warranty, stock, infra, requests, maintenance, notificationsRead]);

  const unreadCount = notifications.filter(n=>!n.read).length;
  useEffect(() => { onNotificationsChange?.(unreadCount); }, [unreadCount, onNotificationsChange]);

  const addHistory = (event: AssetHistoryEvent) => onHistoryChange([...history, event]);

  const openNotifications = () => setTab('notifications');
  const markNotification = (id: string) => setNotificationsRead(prev => ({...prev, [id]:true}));
  const markAllRead = () => setNotificationsRead(Object.fromEntries(notifications.map(n=>[n.id,true])));

  const addMaintenance = (asset: Asset) => {
    if (maintenance.some(m => m.assetId === asset.id && m.status !== 'completed')) return;
    const now = new Date().toISOString();
    const record: MaintenanceRecord = { id:`M-${Date.now()}`, assetId:asset.id, assetName:asset.name, date:now.slice(0,10), type:'repair', description:'Repair ticket opened from Operations', cost:0, technician:'IT Team', status:'in-progress' };
    setMaintenance(prev=>[record,...prev]);
    onAssetsChange(assetsList.map(a=>a.id===asset.id?{...a,status:'maintenance'}:a));
    addHistory({id:`H-${Date.now()}`,assetId:asset.id,timestamp:now,action:'Under Repair',performedBy:currentUser.id,from:asset.status,to:'maintenance',reason:'Repair ticket opened',notes:record.description});
  };

  const completeMaintenance = (record: MaintenanceRecord) => {
    const asset=assetsList.find(a=>a.id===record.assetId);
    setMaintenance(prev=>prev.map(x=>x.id===record.id?{...x,status:'completed'}:x));
    if(asset){
      const now=new Date().toISOString();
      onAssetsChange(assetsList.map(a=>a.id===asset.id?{...a,status:'available'}:a));
      addHistory({id:`H-${Date.now()}`,assetId:asset.id,timestamp:now,action:'Repair Completed',performedBy:currentUser.id,from:'maintenance',to:'available',reason:'Repair completed',notes:record.description,cost:record.cost});
    }
  };

  const createRequest = () => {
    if(!requestUser || !requestReason.trim()) return;
    setRequests(prev=>[{id:`REQ-${String(prev.length+1).padStart(3,'0')}`,userId:requestUser,assetType:requestType,reason:requestReason.trim(),date:new Date().toISOString().slice(0,10),status:'pending'},...prev]);
    setRequestReason(''); setShowRequest(false);
  };
  const requestAction=(id:string,status:RequestStatus)=>setRequests(prev=>prev.map(r=>r.id===id?{...r,status}:r));

  const depValue=(asset:Asset)=>{
    const years=Math.max(1,Number(deprYears)||1);
    if(deprMethod==='none') return asset.purchasePrice;
    const age=Math.max(0,(Date.now()-new Date(asset.purchaseDate).getTime())/(365.25*86400000));
    return Math.max(0,asset.purchasePrice*(1-Math.min(age/years,1)));
  };

  const recordStockMovement=(item:StockItem,type:StockMovement['type'],quantity:number,reason:string)=>{
    const before=item.quantity;
    const delta=(type==='issued'||type==='adjusted'&&quantity<0)?-Math.abs(quantity):Math.abs(quantity);
    const after=Math.max(0,before+delta);
    const updated={...item,quantity:after};
    setStock(prev=>prev.map(x=>x.id===item.id?updated:x));
    setMovements(prev=>[{id:`SM-${Date.now()}`,stockId:item.id,itemName:item.name,type,quantity:Math.abs(quantity),before,after,reason,performedBy:currentUser.name,timestamp:new Date().toISOString()},...prev]);
  };

  const addStock=()=>{
    const name=window.prompt('Stock item name');
    if(!name?.trim()) return;
    const qty=Number(window.prompt('Starting quantity','0')||0);
    const item:StockItem={id:`STK-${Date.now()}`,name:name.trim(),sku:`SKU-${Date.now().toString().slice(-5)}`,category:'General',quantity:Math.max(0,qty),minQuantity:5,unitCost:0,location:'IT Store'};
    setStock(prev=>[item,...prev]);
    if(qty>0) setMovements(prev=>[{id:`SM-${Date.now()}`,stockId:item.id,itemName:item.name,type:'received',quantity:qty,before:0,after:qty,reason:'Initial stock',performedBy:currentUser.name,timestamp:new Date().toISOString()},...prev]);
  };

  const filteredStock=stock.filter(s=>{
    const q=stockSearch.toLowerCase();
    return (s.name.toLowerCase().includes(q)||s.sku.toLowerCase().includes(q)||s.category.toLowerCase().includes(q)) && (stockFilter==='all'||s.quantity<=s.minQuantity);
  });

  const saveSpec=()=>{
    if(!selectedAssetId) return;
    setSpecs(prev=>({...prev,[selectedAssetId]:{...(prev[selectedAssetId]||blankSpec(selectedAssetId)),enabled:true}}));
    setShowSpec(false);
  };

  const openSpec=(asset:Asset)=>{
    setSelectedAssetId(asset.id);
    setSpecs(prev=>prev[asset.id]?prev:{...prev,[asset.id]:blankSpec(asset.id)});
    setShowSpec(true);
  };

  const updateSpec=<K extends keyof DeviceSpec>(key:K,value:DeviceSpec[K])=>{
    if(!selectedAssetId) return;
    setSpecs(prev=>({...prev,[selectedAssetId]:{...(prev[selectedAssetId]||blankSpec(selectedAssetId)),[key]:value}}));
  };

  const openNewInfra=()=>{
    setSelectedInfraId('');
    setInfraForm({id:'',name:'',type:'server',ipAddress:'',macAddress:'',hostname:'',location:'',status:'online',vendor:'',model:'',notes:''});
    setShowInfra(true);
  };
  const openEditInfra=(item:Infrastructure)=>{setSelectedInfraId(item.id);setInfraForm(item);setShowInfra(true);};
  const saveInfra=()=>{
    if(!infraForm.name.trim()) return;
    const item={...infraForm,id:infraForm.id||`INF-${Date.now()}`};
    setInfra(prev=>infraForm.id?prev.map(x=>x.id===infraForm.id?item:x):[item,...prev]);
    setShowInfra(false);
  };

  const filteredInfra=infra.filter(i=>[i.name,i.type,i.ipAddress,i.macAddress,i.hostname,i.location,i.vendor,i.model].some(v=>v.toLowerCase().includes(infraSearch.toLowerCase())));

  const exportCsv=()=>{
    const rows=[['Asset Tag','Name','Type','Manufacturer','Model','Serial','Status','Purchase Date','Purchase Price','Warranty Expiry'],...assetsList.map(a=>[a.assetTag,a.name,a.type,a.manufacturer,a.model,a.serialNumber,a.status,a.purchaseDate,String(a.purchasePrice),a.warrantyExpiry])];
    const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='assetflow-assets.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const parseImport=(file:File)=>{
    const reader=new FileReader();
    reader.onload=()=>{
      const lines=String(reader.result||'').split(/\r?\n/).filter(Boolean);
      if(!lines.length){setImportMessage('The CSV is empty.');return;}
      const clean=(v:string)=>v.trim().replace(/^"|"$/g,'').replace(/""/g,'"');
      const headers=lines[0].split(',').map(clean).map(h=>h.toLowerCase());
      const idx=(names:string[])=>names.map(n=>headers.indexOf(n)).find(i=>i>=0)??-1;
      const tagIdx=idx(['asset tag','assettag']),nameIdx=idx(['name','asset name']),typeIdx=idx(['type','asset type']),serialIdx=idx(['serial','serial number','serialnumber']);
      const manufacturerIdx=idx(['manufacturer','make']),modelIdx=idx(['model']),statusIdx=idx(['status']),purchaseDateIdx=idx(['purchase date','purchasedate']),priceIdx=idx(['purchase price','purchaseprice','price']),warrantyIdx=idx(['warranty expiry','warrantyexpiry']);
      const rows=lines.slice(1).map(line=>line.split(',').map(clean)).filter(r=>r.length>=3);
      if(tagIdx<0||nameIdx<0||typeIdx<0||serialIdx<0){setImportMessage('Required columns missing. Include at least Asset Tag, Name, Type and Serial Number.');return;}
      const existingTags=new Set(assetsList.map(a=>a.assetTag.toLowerCase())); const allowedTypes=new Set(['laptop','desktop','monitor','phone','tablet','printer','server','accessory']); const newAssets:Asset[]=[]; let skipped=0;
      rows.forEach((r,n)=>{const tag=r[tagIdx]||`IMP-${Date.now()}-${n+1}`,serial=r[serialIdx]||'',name=r[nameIdx]||'Imported Asset',type=(r[typeIdx]||'accessory').toLowerCase(); if(existingTags.has(tag.toLowerCase())||!allowedTypes.has(type)){skipped++;return;} newAssets.push({id:`AST-IMP-${Date.now()}-${n+1}`,name,type:type as Asset['type'],manufacturer:manufacturerIdx>=0?r[manufacturerIdx]||'':'',model:modelIdx>=0?r[modelIdx]||'':'',serialNumber:serial,assetTag:tag,status:statusIdx>=0&&['available','assigned','maintenance','retired','disposed','lost'].includes(r[statusIdx])?r[statusIdx] as Asset['status']:'available',purchaseDate:purchaseDateIdx>=0&&r[purchaseDateIdx]?r[purchaseDateIdx]:new Date().toISOString().slice(0,10),purchasePrice:priceIdx>=0?Number(r[priceIdx])||0:0,warrantyExpiry:warrantyIdx>=0&&r[warrantyIdx]?r[warrantyIdx]:'',location:'',notes:'Imported from CSV'}); existingTags.add(tag.toLowerCase());});
      onAssetsChange([...assetsList,...newAssets]); setImportMessage(`Imported ${newAssets.length} assets. Skipped ${skipped} duplicate/invalid rows.`);
    }; reader.readAsText(file);
  };

  const filteredLabels=assetsList.filter(a=>[a.assetTag,a.name,a.serialNumber].some(v=>v.toLowerCase().includes(labelSearch.toLowerCase()))).slice(0,30);
  const printLabels=()=>{
    const html=filteredLabels.map(a=>`<div class="label"><strong>ASSETFLOW</strong><div>${a.name}</div><code>${a.assetTag}</code><small>Serial: ${a.serialNumber}</small></div>`).join('');
    const w=window.open('','_blank'); if(!w)return; w.document.write(`<html><head><title>Asset Labels</title><style>body{font-family:Arial;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:20px}.label{border:1px solid #222;padding:14px;min-height:80px;page-break-inside:avoid}.label strong{font-size:11px;letter-spacing:2px}.label div{font-weight:bold;margin:8px 0}.label code{display:block;font-size:16px}.label small{display:block;margin-top:5px}</style></head><body>${html}</body></html>`); w.document.close(); w.print();
  };

  const filteredAssetsReport=useMemo(()=>{
    const now=Date.now(); return assetsList.filter(a=>{
      if(reportRange==='all')return true;
      const t=new Date(a.purchaseDate).getTime();
      return reportRange==='year'?t>=now-365*86400000:t>=now-30*86400000;
    });
  },[assetsList,reportRange]);

  const reportByType=Object.entries(filteredAssetsReport.reduce<Record<string,number>>((acc,a)=>{acc[a.type]=(acc[a.type]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]);
  const reportByStatus=Object.entries(filteredAssetsReport.reduce<Record<string,number>>((acc,a)=>{acc[a.status]=(acc[a.status]||0)+1;return acc;},{}));
  const reportValue=filteredAssetsReport.reduce((s,a)=>s+a.purchasePrice,0);
  const reportWarranty=filteredAssetsReport.filter(a=>{const d=Math.ceil((new Date(a.warrantyExpiry).getTime()-Date.now())/86400000);return Number.isFinite(d)&&d<=90;}).length;
  const reportAvgAge=filteredAssetsReport.length?filteredAssetsReport.reduce((s,a)=>s+Math.max(0,(Date.now()-new Date(a.purchaseDate).getTime())/86400000),0)/filteredAssetsReport.length/365.25:0;

  const auditEvents=useMemo<AuditEvent[]>(()=>{
    const staticHistory=history.map(h=>({id:h.id,timestamp:h.timestamp,action:h.action,entityType:'Asset',entityId:h.assetId,entityName:assetsList.find(a=>a.id===h.assetId)?.name||h.assetId,userName:usersList.find(u=>u.id===h.performedBy)?.name||h.performedBy||'System',details:[h.from&&`From: ${h.from}`,h.to&&`To: ${h.to}`,h.reason,h.notes].filter(Boolean).join(' • ')}));
    const stockAudit=movements.map(m=>({id:m.id,timestamp:m.timestamp,action:`Stock ${m.type}`,entityType:'Stock',entityId:m.stockId,entityName:m.itemName,userName:m.performedBy,details:`Quantity ${m.before} → ${m.after} • ${m.reason}`}));
    return [...staticHistory,...stockAudit].sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
  },[history,assetsList,usersList,movements]);
  const auditActions=[...new Set(auditEvents.map(a=>a.action))]; const auditEntities=[...new Set(auditEvents.map(a=>a.entityType))];
  const filteredAudit=auditEvents.filter(a=>(auditAction==='all'||a.action===auditAction)&&(auditEntity==='all'||a.entityType===auditEntity)&&(!auditSearch||[a.entityName,a.userName,a.details,a.entityId].some(v=>v.toLowerCase().includes(auditSearch.toLowerCase()))));
  const complianceChecks=[
    {label:'Asset tags populated',count:assetsList.filter(a=>a.assetTag.trim()).length,total:assetsList.length},
    {label:'Serial numbers populated',count:assetsList.filter(a=>a.serialNumber.trim()).length,total:assetsList.length},
    {label:'Warranty dates populated',count:assetsList.filter(a=>a.warrantyExpiry.trim()).length,total:assetsList.length},
    {label:'Assigned assets have an employee',count:assetsList.filter(a=>a.status!=='assigned'||!!a.assignedTo).length,total:assetsList.length},
    {label:'Lifecycle history present',count:assetsList.filter(a=>history.some(h=>h.assetId===a.id)).length,total:assetsList.length},
  ];
  const complianceScore=complianceChecks.length?Math.round(complianceChecks.reduce((s,c)=>s+(c.total?c.count/c.total:1),0)/complianceChecks.length*100):100;

  const exportAudit=()=>{
    const rows=[['Timestamp','Action','Entity','ID','Name','User','Details'],...filteredAudit.map(a=>[a.timestamp,a.action,a.entityType,a.entityId,a.entityName,a.userName,a.details])];
    const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n'); const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download='assetflow-audit-log.csv'; link.click(); URL.revokeObjectURL(url);
  };

  const tabs=[
    ['overview','Overview'],['stock','IT Stock'],['transfers','Transfers'],['device-specs','Detailed Profile'],['infrastructure','Infrastructure'],
    ['reports','Management Reports'],['stock-movements','Stock History'],['notifications','Notifications'],['audit','Audit & Compliance'],
    ['maintenance','Maintenance'],['requests','Asset Requests'],['depreciation','Depreciation'],['labels','Labels / Print'],['import','Import / Export'],['permissions','Permissions'],['my-assets','My Assets']
  ];

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">IT Operations Hub</h1><p className="text-muted-foreground">Inventory, transfers, device details, infrastructure, reporting, notifications, audit and lifecycle operations.</p></div>
    <div className="flex flex-wrap gap-2 border-b pb-3">{tabs.map(([id,label])=><Button key={id} variant={tab===id?'default':'outline'} size="sm" onClick={()=>setTab(id)}>{label}</Button>)}</div>

    {tab==='overview'&&<div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardHeader><CardTitle className="text-sm flex gap-2"><Boxes className="h-4 w-4"/> Assets</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{assetsList.length}</div><p className="text-xs text-muted-foreground">{assetsList.filter(a=>a.status==='assigned').length} assigned • {assetsList.filter(a=>a.status==='maintenance').length} in repair</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm flex gap-2"><Database className="h-4 w-4"/> Stock</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{stock.reduce((s,i)=>s+i.quantity,0)}</div><p className="text-xs text-muted-foreground">{stock.filter(i=>i.quantity<=i.minQuantity).length} low-stock items</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm flex gap-2"><Network className="h-4 w-4"/> Infrastructure</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{infra.length}</div><p className="text-xs text-muted-foreground">{infra.filter(i=>i.status==='offline').length} offline</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm flex gap-2"><BellRing className="h-4 w-4"/> Unread Alerts</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{unreadCount}</div><Button variant="link" className="p-0 h-auto text-xs" onClick={openNotifications}>Open notification center</Button></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Management Snapshot</CardTitle></CardHeader><CardContent className="grid md:grid-cols-3 gap-4">
        <div><p className="text-sm text-muted-foreground">Asset purchase value</p><p className="text-2xl font-semibold">{formatCurrency(assetsList.reduce((s,a)=>s+a.purchasePrice,0))}</p></div>
        <div><p className="text-sm text-muted-foreground">Warranty alerts</p><p className="text-2xl font-semibold">{warranty.length}</p></div>
        <div><p className="text-sm text-muted-foreground">Compliance score</p><p className="text-2xl font-semibold">{complianceScore}%</p></div>
      </CardContent></Card>
    </div>}

    {tab==='stock'&&<Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>IT Stock / Inventory</CardTitle><p className="text-sm text-muted-foreground">Track consumables and spare equipment with minimum-stock alerts.</p></div><Button onClick={addStock}><Plus className="h-4 w-4 mr-1"/>Add Item</Button></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-wrap gap-2"><Input className="max-w-sm" placeholder="Search stock..." value={stockSearch} onChange={e=>setStockSearch(e.target.value)}/><select value={stockFilter} onChange={e=>setStockFilter(e.target.value as 'all'|'low')} className="px-3 py-2 border rounded-md bg-background"><option value="all">All stock</option><option value="low">Low stock</option></select></div>
      <Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>SKU</TableHead><TableHead>Qty</TableHead><TableHead>Min</TableHead><TableHead>Location</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{filteredStock.map(s=><TableRow key={s.id}><TableCell><b>{s.name}</b><div className="text-xs text-muted-foreground">{s.category}</div></TableCell><TableCell className="font-mono">{s.sku}</TableCell><TableCell>{s.quantity} {s.quantity<=s.minQuantity&&<Badge variant="destructive" className="ml-2">Low</Badge>}</TableCell><TableCell>{s.minQuantity}</TableCell><TableCell>{s.location}</TableCell><TableCell className="space-x-1"><Button size="sm" variant="outline" onClick={()=>recordStockMovement(s,'received',1,'Stock received')}>+1</Button><Button size="sm" variant="outline" onClick={()=>recordStockMovement(s,'issued',1,'Stock issued')}>-1</Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}

    {tab==='transfers'&&<Card><CardHeader><CardTitle>Asset Transfer Workflow</CardTitle><p className="text-sm text-muted-foreground">Transfer assigned assets between employees while recording the lifecycle event.</p></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Asset</TableHead><TableHead>Current Employee</TableHead><TableHead>Transfer To</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{assetsList.filter(a=>a.status==='assigned').map(a=>{const from=usersList.find(u=>u.id===a.assignedTo); return <TransferRow key={a.id} asset={a} from={from} users={usersList} onTransfer={(to)=>{const now=new Date().toISOString();const toUser=usersList.find(u=>u.id===to);onAssetsChange(assetsList.map(x=>x.id===a.id?{...x,assignedTo:to,status:'assigned'}:x));addHistory({id:`H-${Date.now()}`,assetId:a.id,timestamp:now,action:'Transferred',performedBy:currentUser.id,from:from?.name||'Unassigned',to:toUser?.name||to,userId:to,reason:'Asset transferred',notes:`Transferred from ${from?.name||'unassigned'} to ${toUser?.name||to}`});}}>Transfer</TransferRow>})}</TableBody></Table>{assetsList.filter(a=>a.status==='assigned').length===0&&<p className="text-sm text-muted-foreground">No assigned assets available for transfer.</p>}</CardContent></Card>}

    {tab==='device-specs'&&<Card><CardHeader><CardTitle className="flex gap-2"><Settings2 className="h-5 w-5"/> Detailed Device Management</CardTitle><p className="text-sm text-muted-foreground">Detailed profile is enabled by default for every asset. Technical fields can be left blank when not applicable.</p></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Asset</TableHead><TableHead>Detailed Profile</TableHead><TableHead>Hostname</TableHead><TableHead>OS</TableHead><TableHead>Network</TableHead><TableHead>Security</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{assetsList.map(a=>{const s=specs[a.id]||blankSpec(a.id);return <TableRow key={a.id}><TableCell><b>{a.assetTag}</b><div className="text-xs text-muted-foreground">{a.name}</div></TableCell><TableCell><Badge><Check className="h-3 w-3 mr-1"/>Enabled</Badge></TableCell><TableCell>{s.hostname||'—'}</TableCell><TableCell>{s.os?(s.osVersion?`${s.os} ${s.osVersion}`:s.os):'—'}</TableCell><TableCell>{s.ipAddress||s.macAddress?'Configured':'—'}</TableCell><TableCell>{s.encryption||s.antivirus||s.edr?<Badge variant="outline">Tracked</Badge>:'—'}</TableCell><TableCell><Button size="sm" variant="outline" onClick={()=>openSpec(a)}>{s.enabled?'Edit':'Enable'}</Button></TableCell></TableRow>})}</TableBody></Table></CardContent></Card>}

    {tab==='infrastructure'&&<Card><CardHeader className="flex flex-row justify-between items-center"><div><CardTitle className="flex gap-2"><Server className="h-5 w-5"/> Network / Infrastructure Assets</CardTitle><p className="text-sm text-muted-foreground">Track servers and network equipment separately from employee assets.</p></div><Button onClick={openNewInfra}><Plus className="h-4 w-4 mr-1"/>Add Device</Button></CardHeader><CardContent className="space-y-4"><Input placeholder="Search infrastructure..." value={infraSearch} onChange={e=>setInfraSearch(e.target.value)} className="max-w-md"/><Table><TableHeader><TableRow><TableHead>Device</TableHead><TableHead>Type</TableHead><TableHead>IP / MAC</TableHead><TableHead>Location</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{filteredInfra.map(i=><TableRow key={i.id}><TableCell><b>{i.name}</b><div className="text-xs text-muted-foreground">{i.hostname} • {i.vendor} {i.model}</div></TableCell><TableCell className="capitalize">{i.type.replace('-',' ')}</TableCell><TableCell><div>{i.ipAddress||'—'}</div><div className="text-xs text-muted-foreground">{i.macAddress||'—'}</div></TableCell><TableCell>{i.location||'—'}</TableCell><TableCell><Badge variant={i.status==='offline'?'destructive':'outline'}>{i.status}</Badge></TableCell><TableCell><Button size="sm" variant="outline" onClick={()=>openEditInfra(i)}>Edit</Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}

    {tab==='reports'&&<div className="space-y-4"><div className="flex justify-end"><select value={reportRange} onChange={e=>setReportRange(e.target.value as 'all'|'year'|'30')} className="px-3 py-2 border rounded-md bg-background"><option value="all">All assets</option><option value="year">Purchased in last 12 months</option><option value="30">Purchased in last 30 days</option></select></div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4"><Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Assets</p><p className="text-2xl font-bold">{filteredAssetsReport.length}</p></CardContent></Card><Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Purchase value</p><p className="text-2xl font-bold">{formatCurrency(reportValue)}</p></CardContent></Card><Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Average asset age</p><p className="text-2xl font-bold">{reportAvgAge.toFixed(1)} yrs</p></CardContent></Card><Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Warranty alerts</p><p className="text-2xl font-bold">{reportWarranty}</p></CardContent></Card></div><div className="grid lg:grid-cols-2 gap-4"><Card><CardHeader><CardTitle>Assets by Type</CardTitle></CardHeader><CardContent><Table><TableBody>{reportByType.map(([type,count])=><TableRow key={type}><TableCell className="capitalize">{type}</TableCell><TableCell className="text-right font-medium">{count}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card><Card><CardHeader><CardTitle>Assets by Status</CardTitle></CardHeader><CardContent><Table><TableBody>{reportByStatus.map(([status,count])=><TableRow key={status}><TableCell className="capitalize">{status}</TableCell><TableCell className="text-right font-medium">{count}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card></div><Card><CardHeader><CardTitle>Operational KPIs</CardTitle></CardHeader><CardContent className="grid md:grid-cols-3 gap-4"><div><p className="text-sm text-muted-foreground">Assigned rate</p><p className="text-xl font-semibold">{assetsList.length?Math.round(assetsList.filter(a=>a.status==='assigned').length/assetsList.length*100):0}%</p></div><div><p className="text-sm text-muted-foreground">Repair rate</p><p className="text-xl font-semibold">{assetsList.length?Math.round(assetsList.filter(a=>a.status==='maintenance').length/assetsList.length*100):0}%</p></div><div><p className="text-sm text-muted-foreground">Lost/disposed</p><p className="text-xl font-semibold">{assetsList.filter(a=>a.status==='lost'||a.status==='disposed').length}</p></div></CardContent></Card></div>}

    {tab==='stock-movements'&&<Card><CardHeader><CardTitle className="flex gap-2"><History className="h-5 w-5"/> Stock Movement History</CardTitle><p className="text-sm text-muted-foreground">Every local stock receipt, issue, return and adjustment is recorded.</p></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead>Movement</TableHead><TableHead>Qty</TableHead><TableHead>Before → After</TableHead><TableHead>Performed By</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader><TableBody>{movements.map(m=><TableRow key={m.id}><TableCell>{formatDate(m.timestamp.slice(0,10))}</TableCell><TableCell>{m.itemName}</TableCell><TableCell className="capitalize">{m.type}</TableCell><TableCell>{m.quantity}</TableCell><TableCell>{m.before} → {m.after}</TableCell><TableCell>{m.performedBy}</TableCell><TableCell>{m.reason}</TableCell></TableRow>)}</TableBody></Table>{movements.length===0&&<p className="text-sm text-muted-foreground py-4">No stock movements yet. Use +1 / -1 in IT Stock.</p>}</CardContent></Card>}

    <Dialog open={notificationOpen} onOpenChange={onNotificationOpenChange}>
      <DialogContent className="w-[min(92vw,720px)] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" /> Smart Notification Center
          </DialogTitle>
          <DialogDescription>
            Warranty, stock, infrastructure, request and maintenance alerts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
              No active notifications.
            </div>
          ) : (
            notifications.map(n => (
              <div key={n.id} className={`flex gap-3 p-3 border rounded-lg ${n.read ? 'opacity-60' : ''}`}>
                <div className="pt-0.5">
                  {n.severity === 'critical'
                    ? <AlertTriangle className="h-5 w-5 text-destructive" />
                    : <BellRing className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <strong>{n.title}</strong>
                    {!n.read && <Badge>New</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.detail}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{formatDate(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <Button size="sm" variant="outline" onClick={() => markNotification(n.id)}>
                    Mark read
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={markAllRead}>Mark all read</Button>
          <Button onClick={() => onNotificationOpenChange?.(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {tab==='notifications' && (
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <div>
            <CardTitle>Smart Notification Center</CardTitle>
            <p className="text-sm text-muted-foreground">
              {unreadCount} unread alert{unreadCount === 1 ? '' : 's'}.
            </p>
          </div>
          <Button variant="outline" onClick={markAllRead}>Mark all read</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {notifications.length === 0 ? (
            <p className="text-muted-foreground">No active notifications.</p>
          ) : (
            notifications.map(n => (
              <div key={n.id} className={`flex gap-3 p-3 border rounded-lg ${n.read ? 'opacity-60' : ''}`}>
                <div>
                  {n.severity === 'critical'
                    ? <AlertTriangle className="h-5 w-5 text-destructive" />
                    : <BellRing className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <strong>{n.title}</strong>
                    {!n.read && <Badge>New</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{n.detail}</p>
                </div>
                {!n.read && (
                  <Button size="sm" variant="outline" onClick={() => markNotification(n.id)}>
                    Mark read
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    )}

    {tab==='audit'&&<Card><CardHeader className="flex flex-row justify-between items-center"><div><CardTitle className="flex gap-2"><ShieldCheck className="h-5 w-5"/> Audit & Compliance</CardTitle><p className="text-sm text-muted-foreground">Operational audit trail plus data-quality compliance checks.</p></div><div className="flex items-center gap-2"><Badge variant={complianceScore<80?'destructive':'outline'}>{complianceScore}% compliance</Badge><Button variant="outline" onClick={exportAudit}><Download className="h-4 w-4 mr-1"/>Export</Button></div></CardHeader><CardContent className="space-y-5"><div className="grid md:grid-cols-5 gap-3">{complianceChecks.map(c=><div key={c.label} className="border rounded-lg p-3"><p className="text-xs text-muted-foreground">{c.label}</p><p className="text-xl font-semibold mt-1">{c.total?Math.round(c.count/c.total*100):100}%</p><p className="text-xs text-muted-foreground">{c.count}/{c.total}</p></div>)}</div><div className="flex flex-wrap gap-2"><Input placeholder="Search audit..." value={auditSearch} onChange={e=>setAuditSearch(e.target.value)} className="max-w-sm"/><select value={auditAction} onChange={e=>setAuditAction(e.target.value)} className="px-3 py-2 border rounded-md bg-background"><option value="all">All actions</option>{auditActions.map(a=><option key={a}>{a}</option>)}</select><select value={auditEntity} onChange={e=>setAuditEntity(e.target.value)} className="px-3 py-2 border rounded-md bg-background"><option value="all">All entities</option>{auditEntities.map(e=><option key={e}>{e}</option>)}</select></div><Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>User</TableHead><TableHead>Details</TableHead></TableRow></TableHeader><TableBody>{filteredAudit.slice(0,100).map(a=><TableRow key={a.id}><TableCell className="whitespace-nowrap">{new Date(a.timestamp).toLocaleString()}</TableCell><TableCell><Badge variant="outline">{a.action}</Badge></TableCell><TableCell><b>{a.entityName}</b><div className="text-xs text-muted-foreground">{a.entityType} • {a.entityId}</div></TableCell><TableCell>{a.userName}</TableCell><TableCell>{a.details||'—'}</TableCell></TableRow>)}</TableBody></Table>{filteredAudit.length===0&&<p className="text-sm text-muted-foreground py-4">No audit events match the filters.</p>}</CardContent></Card>}

    {tab==='maintenance'&&<Card><CardHeader><CardTitle>Repair & Maintenance</CardTitle><p className="text-sm text-muted-foreground">Create and track local maintenance tickets.</p></CardHeader><CardContent className="space-y-4"><Table><TableHeader><TableRow><TableHead>Asset</TableHead><TableHead>Status</TableHead><TableHead>Warranty</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{assetsList.slice(0,20).map(a=>{const w=warranty.find(x=>x.asset.id===a.id);return <TableRow key={a.id}><TableCell><b>{a.assetTag}</b><div className="text-xs text-muted-foreground">{a.name}</div></TableCell><TableCell><Badge variant="outline">{a.status}</Badge></TableCell><TableCell>{w?<Badge variant="destructive">{w.days<0?'Expired':`${w.days} days`}</Badge>:<span className="text-muted-foreground">OK</span>}</TableCell><TableCell><Button size="sm" variant="outline" onClick={()=>addMaintenance(a)}><Wrench className="h-4 w-4 mr-1"/>Open repair</Button></TableCell></TableRow>})}</TableBody></Table>{maintenance.length>0&&<div className="border rounded-lg"><div className="p-3 font-medium">Open tickets</div>{maintenance.map(m=><div key={m.id} className="flex items-center justify-between border-t p-3"><div><b>{m.assetName}</b><p className="text-xs text-muted-foreground">{m.description}</p></div><div className="flex gap-2 items-center"><Badge>{m.status}</Badge><Button size="sm" onClick={()=>completeMaintenance(m)}><CheckCircle2 className="h-4 w-4 mr-1"/>Complete</Button><Button size="icon-sm" variant="ghost" onClick={()=>setMaintenance(prev=>prev.filter(x=>x.id!==m.id))}><Trash2 className="h-4 w-4"/></Button></div></div>)}</div>}</CardContent></Card>}

    {tab==='requests'&&<Card><CardHeader className="flex flex-row justify-between items-center"><div><CardTitle>Asset Requests</CardTitle><p className="text-sm text-muted-foreground">Employee requests and approval workflow.</p></div><Button onClick={()=>setShowRequest(true)}><Plus className="h-4 w-4 mr-1"/>New Request</Button></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Employee</TableHead><TableHead>Asset Type</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{requests.map(r=>{const u=usersList.find(x=>x.id===r.userId);return <TableRow key={r.id}><TableCell className="font-mono">{r.id}</TableCell><TableCell>{u?.name||r.userId}</TableCell><TableCell className="capitalize">{r.assetType}</TableCell><TableCell>{r.reason}</TableCell><TableCell><Badge variant="outline">{r.status}</Badge></TableCell><TableCell>{r.status==='pending'&&<><Button size="sm" onClick={()=>requestAction(r.id,'approved')}>Approve</Button><Button size="sm" variant="outline" onClick={()=>requestAction(r.id,'rejected')}>Reject</Button></>}</TableCell></TableRow>})}</TableBody></Table></CardContent></Card>}

    {tab==='depreciation'&&<Card><CardHeader><CardTitle className="flex gap-2"><Calculator className="h-5 w-5"/> Asset Depreciation</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex gap-3 flex-wrap items-end"><label className="text-sm">Useful life (years)<Input type="number" min="1" value={deprYears} onChange={e=>setDeprYears(e.target.value)} className="mt-1 w-28"/></label><label className="text-sm">Method<select value={deprMethod} onChange={e=>setDeprMethod(e.target.value as 'straight'|'none')} className="mt-1 block px-3 py-2 border rounded-md bg-background"><option value="straight">Straight line</option><option value="none">No depreciation</option></select></label></div><Table><TableHeader><TableRow><TableHead>Asset</TableHead><TableHead>Purchase</TableHead><TableHead>Age</TableHead><TableHead>Current Book Value</TableHead></TableRow></TableHeader><TableBody>{assetsList.map(a=><TableRow key={a.id}><TableCell><b>{a.assetTag}</b><div className="text-xs text-muted-foreground">{a.name}</div></TableCell><TableCell>{formatCurrency(a.purchasePrice)}</TableCell><TableCell>{Math.max(0,((Date.now()-new Date(a.purchaseDate).getTime())/(365.25*86400000))).toFixed(1)} yrs</TableCell><TableCell className="font-medium">{formatCurrency(depValue(a))}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}

    {tab==='labels'&&<Card><CardHeader><CardTitle className="flex gap-2"><QrCode className="h-5 w-5"/> Asset Labels</CardTitle><p className="text-sm text-muted-foreground">Filter assets and print labels.</p></CardHeader><CardContent className="space-y-4"><div className="flex gap-2"><Input value={labelSearch} onChange={e=>setLabelSearch(e.target.value)} placeholder="Filter by asset tag, name or serial..."/><Button onClick={printLabels}><Printer className="h-4 w-4 mr-1"/>Print</Button></div><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{filteredLabels.map(a=><div key={a.id} className="border rounded-lg p-4"><div className="text-[10px] tracking-widest">ASSETFLOW</div><b>{a.name}</b><div className="font-mono mt-2">{a.assetTag}</div><div className="text-xs text-muted-foreground">{a.serialNumber}</div></div>)}</div></CardContent></Card>}

    {tab==='import'&&<Card><CardHeader><CardTitle>Import / Export</CardTitle><p className="text-sm text-muted-foreground">Use CSV for local transfers until the database is connected.</p></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-2"><Button onClick={exportCsv}><Download className="h-4 w-4 mr-1"/>Export Assets CSV</Button><label className="inline-flex items-center gap-2 px-4 py-2 rounded-md border cursor-pointer text-sm font-medium"><Upload className="h-4 w-4"/><span>Validate CSV</span><input type="file" accept=".csv,text/csv" className="hidden" onChange={e=>e.target.files?.[0]&&parseImport(e.target.files[0])}/></label></div>{importMessage&&<div className="p-3 rounded-lg bg-muted text-sm">{importMessage}</div>}</CardContent></Card>}

    {tab==='permissions'&&<Card><CardHeader><CardTitle>Role Permissions</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Capability</TableHead><TableHead>Admin</TableHead><TableHead>Manager</TableHead><TableHead>User</TableHead></TableRow></TableHeader><TableBody>{[['View assets','✓','✓','✓'],['Create/edit assets','✓','✓',''],['Delete assets','✓','',''],['Manage users','✓','',''],['Manage vendors','✓','✓',''],['Manage invoices','✓','✓',''],['Approve requests','✓','✓',''],['View audit logs','✓','✓',''],['System settings','✓','','']].map(r=><TableRow key={r[0]}>{r.map((c,i)=><TableCell key={i} className={i===0?'font-medium':''}>{c||'—'}</TableCell>)}</TableRow>)}</TableBody></Table></CardContent></Card>}

    {tab==='my-assets'&&<Card><CardHeader><CardTitle>My Assets</CardTitle></CardHeader><CardContent className="space-y-4"><select value={myAssetUser} onChange={e=>setMyAssetUser(e.target.value)} className="px-3 py-2 border rounded-md bg-background">{usersList.map(u=><option key={u.id} value={u.id}>{u.name} • {u.department}</option>)}</select><Table><TableHeader><TableRow><TableHead>Asset</TableHead><TableHead>Tag</TableHead><TableHead>Status</TableHead><TableHead>Warranty</TableHead></TableRow></TableHeader><TableBody>{assetsList.filter(a=>a.assignedTo===myAssetUser).map(a=>{const d=Math.ceil((new Date(a.warrantyExpiry).getTime()-Date.now())/86400000);return <TableRow key={a.id}><TableCell><b>{a.name}</b><div className="text-xs text-muted-foreground">{a.manufacturer} {a.model}</div></TableCell><TableCell className="font-mono">{a.assetTag}</TableCell><TableCell><Badge variant="outline">{a.status}</Badge></TableCell><TableCell>{Number.isFinite(d)?(d<0?<Badge variant="destructive">Expired</Badge>:<span>{d} days</span>):'-'}</TableCell></TableRow>})}</TableBody></Table></CardContent></Card>}

    <Dialog open={showRequest} onOpenChange={setShowRequest}><DialogContent><DialogHeader><DialogTitle>New Asset Request</DialogTitle><DialogDescription>Submit a local request for IT equipment.</DialogDescription></DialogHeader><div className="space-y-4"><label className="text-sm">Employee<select value={requestUser} onChange={e=>setRequestUser(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-md bg-background">{usersList.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label className="text-sm">Asset type<select value={requestType} onChange={e=>setRequestType(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-md bg-background">{['laptop','desktop','monitor','phone','tablet','printer','server','accessory'].map(x=><option key={x}>{x}</option>)}</select></label><label className="text-sm">Reason<Input value={requestReason} onChange={e=>setRequestReason(e.target.value)} placeholder="Why is this equipment required?" className="mt-1"/></label></div><DialogFooter><Button onClick={createRequest} disabled={!requestReason.trim()}>Submit Request</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={showSpec} onOpenChange={setShowSpec}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Optional Device Specification</DialogTitle><DialogDescription>Enable detailed technical tracking only when required for this device.</DialogDescription></DialogHeader>{selectedAssetId&&<div className="space-y-4"><div className="grid sm:grid-cols-2 gap-3">{(['hostname','os','osVersion','cpu','ram','storage','gpu','macAddress','ipAddress','biosVersion','lastCheckIn'] as const).map(key=><label key={key} className="text-sm capitalize">{key.replace(/([A-Z])/g,' $1')}<Input className="mt-1" value={String(specs[selectedAssetId]?.[key]||'')} onChange={e=>updateSpec(key,e.target.value)}/></label>)}</div><div className="flex flex-wrap gap-5 text-sm"><label><input type="checkbox" checked={!!specs[selectedAssetId]?.encryption} onChange={e=>updateSpec('encryption',e.target.checked)}/> Encryption</label><label><input type="checkbox" checked={!!specs[selectedAssetId]?.antivirus} onChange={e=>updateSpec('antivirus',e.target.checked)}/> Antivirus</label><label><input type="checkbox" checked={!!specs[selectedAssetId]?.edr} onChange={e=>updateSpec('edr',e.target.checked)}/> EDR</label></div></div>}<DialogFooter><Button variant="outline" onClick={()=>setShowSpec(false)}>Cancel</Button><Button onClick={saveSpec}>Save</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={showInfra} onOpenChange={setShowInfra}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{infraForm.id?'Edit Infrastructure Device':'Add Infrastructure Device'}</DialogTitle><DialogDescription>Track network and infrastructure equipment.</DialogDescription></DialogHeader><div className="grid sm:grid-cols-2 gap-3">{(['name','ipAddress','macAddress','hostname','location','vendor','model'] as const).map(key=><label key={key} className="text-sm capitalize">{key.replace(/([A-Z])/g,' $1')}<Input className="mt-1" value={infraForm[key]} onChange={e=>setInfraForm({...infraForm,[key]:e.target.value})}/></label>)}<label className="text-sm">Type<select className="mt-1 w-full px-3 py-2 border rounded-md bg-background" value={infraForm.type} onChange={e=>setInfraForm({...infraForm,type:e.target.value as Infrastructure['type']})}>{['server','router','switch','firewall','access-point','ups','printer','other'].map(x=><option key={x}>{x}</option>)}</select></label><label className="text-sm">Status<select className="mt-1 w-full px-3 py-2 border rounded-md bg-background" value={infraForm.status} onChange={e=>setInfraForm({...infraForm,status:e.target.value as Infrastructure['status']})}>{['online','offline','maintenance'].map(x=><option key={x}>{x}</option>)}</select></label><label className="text-sm sm:col-span-2">Notes<Input className="mt-1" value={infraForm.notes} onChange={e=>setInfraForm({...infraForm,notes:e.target.value})}/></label></div><DialogFooter><Button variant="outline" onClick={()=>setShowInfra(false)}>Cancel</Button><Button onClick={saveInfra}>Save Device</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function TransferRow({asset,from,users,onTransfer}:{asset:Asset;from?:User;users:User[];onTransfer:(userId:string)=>void}) {
  const [to,setTo]=useState('');
  const choices=users.filter(u=>u.id!==asset.assignedTo&&u.status==='active');
  return <TableRow><TableCell><b>{asset.assetTag}</b><div className="text-xs text-muted-foreground">{asset.name}</div></TableCell><TableCell>{from?.name||'—'}</TableCell><TableCell><select value={to} onChange={e=>setTo(e.target.value)} className="px-2 py-1.5 border rounded-md bg-background text-sm"><option value="">Select employee</option>{choices.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></TableCell><TableCell><Button size="sm" disabled={!to} onClick={()=>{onTransfer(to);setTo('')}}><ArrowRightLeft className="h-4 w-4 mr-1"/>Transfer</Button></TableCell></TableRow>;
}
