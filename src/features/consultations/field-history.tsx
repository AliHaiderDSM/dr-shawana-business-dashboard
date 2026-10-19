import { History } from 'lucide-react';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface PreviousEntry {
  consultationId: string;
  appointmentNo: number;
  date: string;
  data: Record<string, unknown>;
}

const PreviousVisits = createContext<PreviousEntry[]>([]);

export function PreviousVisitsProvider({
  entries,
  children,
}: {
  entries: PreviousEntry[];
  children: ReactNode;
}) {
  return <PreviousVisits.Provider value={entries}>{children}</PreviousVisits.Provider>;
}

export interface HistoryColumn {
  key: string;
  label: string;
  format?: (value: unknown) => string;
}

const show = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  return String(value);
};

export function FieldHistoryButton({
  title,
  columns,
  className,
}: {
  title: string;
  columns: HistoryColumn[];
  className?: string;
}) {
  const entries = useContext(PreviousVisits);
  const [open, setOpen] = useState(false);
  const rows = entries.filter((e) => columns.some((c) => show(e.data[c.key]) !== '—'));
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn('gap-1.5', className)}
        disabled={rows.length === 0}
        title={rows.length === 0 ? 'No earlier visit has this saved' : undefined}
        onClick={() => setOpen(true)}
      >
        <History />
        History{rows.length ? ` (${rows.length})` : ''}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Saved at the patient’s earlier visits, newest first.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Visit</th>
                  {columns.map((c) => (
                    <th key={c.key} className="px-3 py-2 text-left font-medium">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((e) => (
                  <tr key={e.consultationId} className="align-top">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="font-medium">{formatDate(e.date)}</div>
                      <div className="text-xs text-muted-foreground">#{e.appointmentNo}</div>
                    </td>
                    {columns.map((c) => (
                      <td key={c.key} className="px-3 py-2 whitespace-pre-wrap">
                        {c.format ? c.format(e.data[c.key]) : show(e.data[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
