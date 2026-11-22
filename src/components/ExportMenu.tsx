import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { exportCsv, exportExcel, type ExportTable } from '@/lib/tableExport';

/** Export button for any list. `build` is called on click so it always exports what is currently shown. */
export function ExportMenu({ build, disabled, label = 'Export' }: { build: () => ExportTable; disabled?: boolean; label?: string }) {
  const run = async (kind: 'csv' | 'xlsx') => {
    try {
      const table = build();
      if (kind === 'csv') exportCsv(table); else await exportExcel(table);
      toast.success(`Exported ${table.rows.length} row${table.rows.length === 1 ? '' : 's'} to ${kind === 'csv' ? 'CSV' : 'Excel'}`);
    } catch (e) {
      toast.error(`Export failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled}><Download className="h-4 w-4" /> {label}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void run('xlsx')}><FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run('csv')}><FileText className="h-4 w-4" /> CSV (.csv)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
