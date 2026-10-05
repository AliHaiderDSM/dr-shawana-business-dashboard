import { CalendarClock } from 'lucide-react';
import { Link } from 'react-router';
import { Panel } from '@/components/shared/panel';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useExpiryAlerts } from './api';

const LIMIT = 8;

function when(daysLeft: number) {
  if (daysLeft < 0) return `expired ${-daysLeft} days ago`;
  if (daysLeft === 0) return 'expires today';
  return `expires in ${daysLeft} days`;
}

export function ExpiryAlertsPanel({ className }: { className?: string }) {
  const { can, activeBranchId } = useAuth();
  const alerts = useExpiryAlerts();
  const rows = alerts.data ?? [];
  if (!can('stock.view') && !can('inventoryReport.view')) return null;
  if (rows.length === 0) return null;
  const expired = rows.filter((r) => r.daysLeft < 0).length;
  const allBranches = !activeBranchId;

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
      }.`}
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
        {rows.slice(0, LIMIT).map((r) => (
          <li key={r.batchId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium">{r.productName}</span>
            {allBranches ? <span className="text-muted-foreground">{r.branchName}</span> : null}
            <span className="font-mono text-xs">{r.batchNo}</span>
            <span className="w-24 text-right tabular-nums">
              {formatQuantity(r.quantity)} {r.unit}
            </span>
            <span
              className={cn(
                'w-56 text-right text-xs font-medium whitespace-nowrap',
                r.daysLeft < 0 ? 'text-destructive' : 'text-warning-soft-foreground',
              )}
            >
              {formatDate(r.expiryDate)} · {when(r.daysLeft)}
            </span>
          </li>
        ))}
      </ul>
      {rows.length > LIMIT ? (
        <p className="border-t px-5 py-2 text-xs text-muted-foreground">And {rows.length - LIMIT} more.</p>
      ) : null}
    </Panel>
  );
}
