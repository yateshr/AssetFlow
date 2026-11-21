import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { decideTransferRequest, listTransferRequests } from '@/lib/db';
import type { Company, TransferRequest } from '@/data/models';

export function TransferApprovalsPage({ companies }: { companies: Company[] }) {
  const [requests,setRequests]=useState<TransferRequest[]>([]); const [busy,setBusy]=useState<string>('');
  const load=async()=>{try{setRequests(await listTransferRequests());}catch(error){toast.error('Could not load transfer requests',{description:error instanceof Error?error.message:String(error)});}};
  useEffect(()=>{void load();},[]);
  const decide=async(request:TransferRequest,approve:boolean)=>{const note=window.prompt(approve?'Approval note (optional)':'Reason for rejection (optional)','') ; if(note===null)return; setBusy(request.id); try{await decideTransferRequest(request.id,approve,note);toast.success(approve?'Transfer approved and completed':'Transfer request rejected');await load();}catch(error){toast.error('Could not decide transfer',{description:error instanceof Error?error.message:String(error)});}finally{setBusy('');}};
  const company=(id:string)=>companies.find(item=>item.id===id)?.name||id;
  return <div className="af-stagger space-y-6"><div><h1 className="text-3xl font-bold tracking-tight">Transfer Approvals</h1><p className="text-muted-foreground">Review employee and asset moves requested by site IT teams.</p></div><Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Request</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{requests.length===0?<TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No transfer requests.</TableCell></TableRow>:requests.map(request=><TableRow key={request.id}><TableCell><p className="font-medium capitalize">{request.requestType} transfer</p><p className="font-mono text-xs text-muted-foreground">{request.entityId}{request.requestedAssetTag?` → ${request.requestedAssetTag}`:''}</p></TableCell><TableCell>{company(request.sourceCompanyId)}</TableCell><TableCell>{company(request.targetCompanyId)}{request.targetDepartment&&<p className="text-xs text-muted-foreground">Department: {request.targetDepartment}</p>}</TableCell><TableCell className="max-w-64 truncate">{request.reason}</TableCell><TableCell><Badge variant="outline" className="capitalize">{request.status}</Badge></TableCell><TableCell><div className="flex justify-end gap-2">{request.status==='pending'&&<><Button size="sm" disabled={busy===request.id} onClick={()=>void decide(request,true)}><Check className="h-4 w-4"/>Approve</Button><Button size="sm" variant="outline" disabled={busy===request.id} onClick={()=>void decide(request,false)}><X className="h-4 w-4"/>Reject</Button></>}</div></TableCell></TableRow>)}</TableBody></Table></CardContent></Card></div>;
}
