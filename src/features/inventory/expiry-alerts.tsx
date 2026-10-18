import { CalendarClock, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { DetailList, Panel } from '@/components/shared/panel';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type ExpiryAlert, useExpiryAlerts } from '@redux/features/inventory';

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

interface BatchGroup {
  key: string;
  productName: string;
  batchNo: string;
  unit: string;
  expiryDate: string;
  daysLeft: number;
  total: number;
  rows: ExpiryAlert[];
}

function groupByBatch(rows: ExpiryAlert[]): BatchGroup[] {
  const groups = new Map<string, BatchGroup>();
  for (const r of rows) {
    const key = `${r.productName.toLowerCase()}|${r.batchNo.toLowerCase()}|${r.expiryDate}`;
    const group = groups.get(key) ?? {
      key,
      productName: r.productName,
      batchNo: r.batchNo,
      unit: r.unit,
      expiryDate: r.expiryDate,
      daysLeft: r.daysLeft,
      total: 0,
      rows: [],
    };
    group.total += Number(r.quantity);
    group.rows.push(r);
    groups.set(key, group);
  }
  return [...groups.values()].sort(
    (a, b) => a.daysLeft - b.daysLeft || a.productName.localeCompare(b.productName),
  );
}

function BranchList({ rows, highlight }: { rows: ExpiryAlert[]; highlight?: string }) {
  return (
    <ul className="divide-y rounded-lg border">
      {rows.map((r) => (
        <li
          key={r.batchId}
          className={cn(
            'flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm',
            highlight && r.batchNo === highlight && 'bg-primary-soft/40',
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
  );
}

function ExpiryDetailSheet({
  group,
  all,
  onOpenChange,
}: {
  group: BatchGroup | null;
  all: ExpiryAlert[];
  onOpenChange: (open: boolean) => void;
}) {
  const others = group
    ? all.filter(
        (r) =>
          r.productName === group.productName &&
          !(r.batchNo === group.batchNo && r.expiryDate === group.expiryDate),
      )
    : [];
  const branches = group ? new Set(group.rows.map((r) => r.branchId)).size : 0;
  const first = group?.rows[0];

  return (
    <Sheet open={Boolean(group)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {group && first ? (
          <>
            <SheetHeader>
              <SheetTitle>{group.productName}</SheetTitle>
              <SheetDescription>
                Batch {group.batchNo} · {branches} {branches === 1 ? 'place' : 'places'}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-6 px-4 pb-6">
              <DetailList
                items={[
                  { label: 'Batch', value: <span className="font-mono">{group.batchNo}</span> },
                  { label: 'Total in stock', value: `${formatQuantity(String(group.total))} ${group.unit}` },
                  { label: 'Expiry date', value: formatDate(group.expiryDate) },
                  { label: 'Status', value: <ExpiryText row={first} className="text-sm" /> },
                ]}
              />
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold">Where this batch is</h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatQuantity(String(group.total))} {group.unit} · {branches}{' '}
                    {branches === 1 ? 'place' : 'places'}
                  </span>
                </div>
                <BranchList rows={group.rows} />
              </div>
              {others.length ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Other expiring batches of this product</h3>
                  <BranchList rows={others} />
                </div>
              ) : null}
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
  const [selected, setSelected] = useState<BatchGroup | null>(null);
  const [showAll, setShowAll] = useState(false);
  const rows = alerts.data ?? [];
  if (!can('stock.view') && !can('inventoryReport.view')) return null;
  if (rows.length === 0) return null;
  const groups = groupByBatch(rows);
  const expired = groups.filter((g) => g.daysLeft < 0).length;
  const allBranches = !activeBranchId;
  const visible = showAll ? groups : groups.slice(0, LIMIT);

  return (
    <Panel
      className={cn('border-warning/50', className)}
      title={
        <span className="flex items-center gap-2">
          <CalendarClock className="size-4 text-warning-soft-foreground" />
          Expiry alerts
        </span>
      }
      description={`${groups.length === 1 ? '1 batch in stock expires' : `${groups.length} batches in stock expire`} within 3 months${
        expired ? `, ${expired} already expired` : ''
      }. One row per batch with its total; click a row to see where it is.`}
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
        {visible.map((g) => {
          const places = new Set(g.rows.map((r) => r.branchId)).size;
          return (
            <li key={g.key}>
              <button
                type="button"
                onClick={() => setSelected(g)}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{g.productName}</span>
                <span className="text-muted-foreground">
                  {places === 1 ? g.rows[0]!.branchName : `${places} places`}
                </span>
                <span className="font-mono text-xs">{g.batchNo}</span>
                <span className="w-24 text-right font-medium tabular-nums">
                  {formatQuantity(String(g.total))} {g.unit}
                </span>
                <ExpiryText row={g.rows[0]!} className="w-56 text-right" />
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>
      {groups.length > LIMIT ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full border-t px-5 py-2 text-left text-xs font-medium text-primary hover:underline"
        >
          {showAll ? 'Show fewer' : `Show ${groups.length - LIMIT} more`}
        </button>
      ) : null}
      <ExpiryDetailSheet group={selected} all={rows} onOpenChange={(open) => !open && setSelected(null)} />
    </Panel>
  );
}
