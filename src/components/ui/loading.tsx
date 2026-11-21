import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ActivityIndicator({ className, label = 'Working' }: { className?: string; label?: string }) {
  return (
    <span className={cn('inline-flex h-4 items-center gap-[3px]', className)} role="status" aria-label={label}>
      <span className="af-loader-bar h-2.5 w-[2px] rounded-full bg-current" />
      <span className="af-loader-bar h-4 w-[2px] rounded-full bg-current [animation-delay:120ms]" />
      <span className="af-loader-bar h-2.5 w-[2px] rounded-full bg-current [animation-delay:240ms]" />
    </span>
  );
}

export function PageLoader({ label = 'Preparing workspace' }: { label?: string }) {
  return (
    <div className="w-full space-y-5" role="status" aria-live="polite" aria-label={label}>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="af-skeleton h-6 w-44 rounded-md" />
          <div className="af-skeleton h-3 w-72 max-w-[65vw] rounded" />
        </div>
        <ActivityIndicator className="text-primary" label={label} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map(item => <div key={item} className="rounded-lg border bg-card p-4"><div className="af-skeleton h-3 w-20 rounded"/><div className="af-skeleton mt-4 h-8 w-16 rounded-md"/><div className="af-skeleton mt-3 h-2.5 w-28 rounded"/></div>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-lg border bg-card p-4 lg:col-span-3"><div className="af-skeleton h-4 w-36 rounded"/><div className="mt-5 space-y-3">{[0,1,2,3,4].map(item=><div key={item} className="af-skeleton h-9 w-full rounded"/>)}</div></div>
        <div className="rounded-lg border bg-card p-4 lg:col-span-2"><div className="af-skeleton h-4 w-28 rounded"/><div className="af-skeleton mx-auto mt-7 h-40 w-40 rounded-full"/></div>
      </div>
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function WorkspaceBoot() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07111f] p-6 text-slate-100" role="status" aria-live="polite">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,.2),transparent_52%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />
      <div className="relative w-full max-w-xl">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-blue-200/15 bg-gradient-to-br from-blue-500/25 to-blue-950/20 shadow-[0_20px_60px_rgba(0,0,0,.34)]">
            <Package className="h-9 w-9 text-blue-200" strokeWidth={1.65}/>
          </div>
          <p className="mt-7 text-[30px] font-semibold tracking-[-0.045em] text-white">AssetFlow</p>
          <p className="mt-1.5 text-sm font-medium tracking-[0.01em] text-slate-400">IT asset operations workspace</p>
        </div>
        <div className="mt-14">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10 p-px shadow-inner"><div className="af-boot-progress h-full rounded-full bg-gradient-to-r from-blue-600 via-blue-300 to-cyan-200" /></div>
          <div className="mt-4 flex items-center justify-between gap-4 text-sm text-slate-400"><span>Preparing your secure workspace</span><ActivityIndicator className="text-blue-200" label="Loading workspace data" /></div>
        </div>
        <p className="mt-12 text-center text-xs text-slate-500">Loading company data, permissions, and asset records</p>
      </div>
    </div>
  );
}
