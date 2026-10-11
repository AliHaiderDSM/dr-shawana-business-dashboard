import { CalendarClock, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { DetailList, Panel } from '@/components/shared/panel';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type ExpiryAlert, useExpiryAlerts } from './api';

const LIMIT = 8;

const KIND_LABEL: Record<ExpiryAlert['branchKind'], string> = {
  branch: 'Branch',
  warehouse: 'Main Warehouse',
  dispatch: 'Dispatch Department',
};

function when(daysLeft: number) {
  if (daysLeft < 0) return `expired ${-daysLeft} days ago`;
  if (daysLeft === 0) return 'expires today';
  return `expires in ${daysLeft} days`;
}

function ExpiryText({ row, className }: { row: ExpiryAlert; className?: string }) {
  return (
    <span
      className={cn(
        'text-xs font-medium whitespace-nowrap',
        row.daysLeft < 0 ? 'text-destructive' : 'text-warning-soft-foreground',
        className,
      )}
    >
      {formatDate(row.expiryDate)} · {when(row.daysLeft)}
    </span>
  );
}

function ExpiryDetailSheet({
  alert,
  all,
  onOpenChange,
}: {
  alert: ExpiryAlert | null;
  all: ExpiryAlert[];
  onOpenChange: (open: boolean) => void;
}) {
  const related = alert ? all.filter((r) => r.productName === alert.productName) : [];
  const total = related.reduce((sum, r) => sum + Number(r.quantity), 0);
  const branches = new Set(related.map((r) => r.branchId)).size;

  return (
    <Sheet open={Boolean(alert)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {alert ? (
          <>
            <SheetHeader>
              <SheetTitle>{alert.productName}</SheetTitle>
              <SheetDescription>
                Batch {alert.batchNo} at {alert.branchName}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-6 px-4 pb-6">
              <DetailList
                items={[
                  { label: 'Branch', value: alert.branchName },
                  { label: 'Type', value: KIND_LABEL[alert.branchKind] },
                  { label: 'Batch', value: <span className="font-mono">{alert.batchNo}</span> },
                  { label: 'In stock', value: `${formatQuantity(alert.quantity)} ${alert.unit}` },
                  { label: 'Expiry date', value: formatDate(alert.expiryDate) },
                  { label: 'Status', value: <ExpiryText row={alert} className="text-sm" /> },
                ]}
              />
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold">Where this product is expiring</h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatQuantity(String(total))} {alert.unit} · {branches}{' '}
                    {branches === 1 ? 'branch' : 'branches'}
                  </span>
                </div>
                <ul className="divide-y rounded-lg border">
                  {related.map((r) => (
                    <li
                      key={r.batchId}
                      className={cn(
                        'flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm',
                        r.batchId === alert.batchId && 'bg-primary-soft/40',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.branchName}</span>
                        <span className="text-xs text-muted-foreground">
                          {KIND_LABEL[r.branchKind]} · <span className="font-mono">{r.batchNo}</span>
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block tabular-nums">
                          {formatQuantity(r.quantity)} {r.unit}
                        </span>
                        <ExpiryText row={r} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function ExpiryAlertsPanel({ className }: { className?: string }) {
  const { can, activeBranchId } = useAuth();
  const alerts = useExpiryAlerts();
  const [selected, setSelected] = useState<ExpiryAlert | null>(null);
  const [showAll, setShowAll] = useState(false);
  const rows = alerts.data ?? [];
  if (!can('stock.view') && !can('inventoryReport.view')) return null;
  if (rows.length === 0) return null;
  const expired = rows.filter((r) => r.daysLeft < 0).length;
  const allBranches = !activeBranchId;
  const visible = showAll ? rows : rows.slice(0, LIMIT);

  return (
    <Panel
      className={cn('border-warning/50', className)}
      title={
        <span className="flex items-center gap-2">
          <CalendarClock className="size-4 text-warning-soft-foreground" />
          Expiry alerts
        </span>
      }
      description={`${rows.length === 1 ? '1 batch in stock expires' : `${rows.length} batches in stock expire`} within 3 months${
        expired ? `, ${expired} already expired` : ''
      }. Click a row for details.`}
      actions={
        allBranches ? null : (
          <Button asChild variant="outline" size="sm">
            <Link to="/inventory/batches?status=expiring">View batches</Link>
          </Button>
        )
      }
      bodyClassName="p-0"
    >
      <ul className="divide-y">
        {visible.map((r) => (
          <li key={r.batchId}>
            <button
              type="button"
              onClick={() => setSelected(r)}
              className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
            >
              <span className="min-w-0 flex-1 truncate font-medium">{r.productName}</span>
              <span className="text-muted-foreground">{r.branchName}</span>
              <span className="font-mono text-xs">{r.batchNo}</span>
              <span className="w-24 text-right tabular-nums">
                {formatQuantity(r.quantity)} {r.unit}
              </span>
              <ExpiryText row={r} className="w-56 text-right" />
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      {rows.length > LIMIT ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full border-t px-5 py-2 text-left text-xs font-medium text-primary hover:underline"
        >
          {showAll ? 'Show fewer' : `Show ${rows.length - LIMIT} more`}
        </button>
      ) : null}
      <ExpiryDetailSheet alert={selected} all={rows} onOpenChange={(open) => !open && setSelected(null)} />
    </Panel>
  );
}
