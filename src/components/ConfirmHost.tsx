import { useEffect, useRef, useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * App-wide replacement for window.confirm. Browsers and embedded windows can block the
 * native popup, which makes delete buttons silently do nothing.
 *
 *   if (!(await confirmDialog({ message: 'Delete this vendor?', destructive: true }))) return;
 */
export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };
let show: ((p: Pending) => void) | null = null;

export function confirmDialog(options: ConfirmOptions | string): Promise<boolean> {
  const opts = typeof options === 'string' ? { message: options } : options;
  return new Promise(resolve => {
    if (!show) { resolve(window.confirm(opts.message)); return; } // host not mounted: fall back to the browser popup
    show({ ...opts, resolve });
  });
}

/** Mount once near the root of the app. */
export function ConfirmHost() {
  const [queue, setQueue] = useState<Pending[]>([]);
  useEffect(() => {
    show = p => setQueue(q => [...q, p]);
    return () => { show = null; };
  }, []);

  const current = queue[0];
  // Keep the last message on screen while the dialog fades out.
  const lastShown = useRef<Pending | undefined>(undefined);
  if (current) lastShown.current = current;
  const shown = current ?? lastShown.current;
  const finish = (ok: boolean) => { current?.resolve(ok); setQueue(q => q.slice(1)); };

  return (
    <AlertDialog open={!!current} onOpenChange={open => { if (!open) finish(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{shown?.title || 'Please confirm'}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">{shown?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{shown?.cancelLabel || 'Cancel'}</AlertDialogCancel>
          <AlertDialogAction className={shown?.destructive ? 'bg-destructive text-white hover:bg-destructive/90' : undefined} onClick={() => finish(true)}>
            {shown?.confirmLabel || (shown?.destructive ? 'Delete' : 'Continue')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
