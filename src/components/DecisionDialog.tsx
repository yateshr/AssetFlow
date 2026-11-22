import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

/** Approve / reject with an optional note. Replaces window.prompt, which embedded browsers block. */
export function DecisionDialog({ open, approve, title, description, busy, onCancel, onConfirm }: {
  open: boolean; approve: boolean; title: string; description?: string; busy?: boolean; onCancel: () => void; onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  useEffect(() => { if (open) setNote(''); }, [open]);
  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !busy) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <label className="block space-y-1.5 text-sm font-medium">{approve ? 'Note (optional)' : 'Reason for rejecting (optional)'}
          <Textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className="font-normal" />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant={approve ? 'default' : 'destructive'} onClick={() => onConfirm(note.trim())} disabled={busy}>{busy ? 'Working…' : approve ? 'Approve' : 'Reject'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
