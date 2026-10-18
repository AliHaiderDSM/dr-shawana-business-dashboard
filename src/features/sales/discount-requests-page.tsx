import type { ColumnDef } from '@tanstack/react-table';
import { Check, Loader2, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge, type Tone } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ROLE_LABELS } from '@/features/staff/constants';
import { toastError } from '@/lib/api/errors';
import type { Role } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDateTime, formatMoney, formatQuantity } from '@/lib/format';
import { TraceNumber } from '@/features/trace/trace-page';
import {
  useDecideDiscountMutation,
  useDiscountRequests,
  usePendingDiscountCount,
  useWithdrawDiscountMutation,
  type DiscountRequest,
  type DiscountRequestStatus,
} from '@redux/features/discount-requests';
import { DISCOUNT_STATUS_LABELS } from './discount-requests-constants';

export const DISCOUNT_TONES: Record<DiscountRequestStatus, Tone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
  used: 'info',
};

const roleLabel = (role: string) => ROLE_LABELS[role as Role] ?? role.replace(/_/g, ' ');

function DecideDialog({
  decision,
  onClose,
}: {
  decision: { request: DiscountRequest; approve: boolean } | null;
  onClose: () => void;
}) {
  const [decide, decideState] = useDecideDiscountMutation();
  const [note, setNote] = useState('');
  if (!decision) return null;
  const { request, approve } = decision;
  return (
    <Dialog open onOpenChange={(open) => !open && !decideState.isLoading && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {approve ? 'Approve' : 'Reject'} {request.requestNo}
          </DialogTitle>
          <DialogDescription>
            {request.discountPercent}% off {formatQuantity(request.qty)} × {request.itemName} for{' '}
            {request.branch.name}, asked by {request.requestedBy?.name ?? 'staff'}. It takes{' '}
            {formatMoney(request.discountAmount)} off the sale.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="decision-note">Note for the branch (optional)</Label>
          <Textarea
            id="decision-note"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={decideState.isLoading}>
            Cancel
          </Button>
          <Button
            variant={approve ? 'default' : 'destructive'}
            disabled={decideState.isLoading}
            onClick={() =>
              decide({ id: request.id, approve, note: note.trim() || null })
                .unwrap()
                .then(() => {
                  toast.success(approve ? 'Discount approved' : 'Discount rejected');
                  onClose();
                })
                .catch(toastError)
            }
          >
            {decideState.isLoading ? <Loader2 className="animate-spin" /> : approve ? <Check /> : <X />}
            {approve ? 'Approve' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DiscountRequestsPage() {
  const { isSuperAdmin } = useAuth();
  const [status, setStatus] = useState<DiscountRequestStatus | 'all'>('pending');
  const requests = useDiscountRequests(status === 'all' ? {} : { status });
  const [withdraw, withdrawState] = useWithdrawDiscountMutation();
  const pending = usePendingDiscountCount(isSuperAdmin);
  const [decision, setDecision] = useState<{ request: DiscountRequest; approve: boolean } | null>(null);

  const columns: ColumnDef<DiscountRequest, unknown>[] = [
    {
      id: 'requestNo',
      header: 'Request no',
      accessorKey: 'requestNo',
      cell: ({ row }) => <TraceNumber number={row.original.requestNo} />,
    },
    {
      id: 'createdAt',
      header: 'Asked',
      accessorFn: (r) => formatDateTime(r.createdAt),
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDateTime(row.original.createdAt)}</span>,
    },
    {
      id: 'branch',
      header: 'Branch',
      accessorFn: (r) => r.branch.name,
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-xs font-semibold text-primary-soft-foreground">
            {row.original.branch.code}
          </span>
          {row.original.branch.name}
        </span>
      ),
    },
    {
      id: 'customer',
      header: 'Customer',
      accessorFn: (r) => r.customer?.name ?? '',
      cell: ({ row }) =>
        row.original.customer ? (
          <div className="min-w-0">
            <div className="font-medium">{row.original.customer.name}</div>
            {row.original.customer.phone ? (
              <div className="text-xs text-muted-foreground tabular-nums">{row.original.customer.phone}</div>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'requestedBy',
      header: 'Asked by',
      accessorFn: (r) => `${r.requestedBy?.name ?? ''} (${roleLabel(r.requestedBy?.role ?? '')})`,
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-medium">{row.original.requestedBy?.name ?? '—'}</div>
          <div className="text-xs text-muted-foreground">
            {roleLabel(row.original.requestedBy?.role ?? '')}
          </div>
        </div>
      ),
    },
    {
      id: 'item',
      header: 'Product',
      accessorFn: (r) => r.itemName,
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-medium">{row.original.itemName}</div>
          {row.original.note ? (
            <div className="max-w-64 truncate text-xs text-muted-foreground" title={row.original.note}>
              “{row.original.note}”
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'qty',
      header: 'Qty',
      accessorFn: (r) => Number(r.qty),
      meta: { align: 'right' },
      cell: ({ row }) => <span className="tabular-nums">{formatQuantity(row.original.qty)}</span>,
    },
    {
      id: 'price',
      header: 'Price',
      accessorFn: (r) => Number(r.unitPrice),
      meta: { align: 'right' },
      cell: ({ row }) => <span className="tabular-nums">{formatMoney(row.original.unitPrice)}</span>,
    },
    {
      id: 'discount',
      header: 'Discount',
      accessorFn: (r) => Number(r.discountPercent),
      meta: { align: 'right' },
      cell: ({ row }) => (
        <div className="text-right">
          <div className="font-semibold tabular-nums">{Number(row.original.discountPercent)}%</div>
          <div className="text-xs text-destructive tabular-nums">
            −{formatMoney(row.original.discountAmount)}
          </div>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (r) => DISCOUNT_STATUS_LABELS[r.status],
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="space-y-1">
            <StatusBadge tone={DISCOUNT_TONES[r.status]}>{DISCOUNT_STATUS_LABELS[r.status]}</StatusBadge>
            {r.decidedBy ? (
              <div className="text-xs text-muted-foreground">
                by {r.decidedBy.name}
                {r.decisionNote ? ` · “${r.decisionNote}”` : ''}
              </div>
            ) : null}
            {r.saleId && r.invoiceNo ? (
              <Link
                to={`/sales/${r.saleId}`}
                className="text-xs text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {r.invoiceNo}
              </Link>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      meta: { hideable: false },
      cell: ({ row }) => {
        const r = row.original;
        if (isSuperAdmin && r.status === 'pending') {
          return (
            <div className="flex justify-end gap-1.5">
              <Button size="sm" onClick={() => setDecision({ request: r, approve: true })}>
                <Check />
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDecision({ request: r, approve: false })}>
                <X />
                Reject
              </Button>
            </div>
          );
        }
        if (!isSuperAdmin && (r.status === 'pending' || r.status === 'approved')) {
          return (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                disabled={withdrawState.isLoading}
                onClick={() =>
                  withdraw(r.id)
                    .unwrap()
                    .then(() => toast.success('Request withdrawn'))
                    .catch(toastError)
                }
              >
                <Undo2 />
                Withdraw
              </Button>
            </div>
          );
        }
        return null;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Discount requests"
        description={
          isSuperAdmin
            ? 'Product discounts the branches asked for. A sale can use a discount only after you approve it, once.'
            : 'Product discounts your branch asked the Super Admin for. An approved discount is used once, on the sale it was asked for.'
        }
      />
      <DataTable
        columns={columns}
        data={requests.data}
        isLoading={requests.isLoading}
        isFetching={requests.isFetching}
        error={requests.error}
        onRetry={() => void requests.refetch()}
        getRowId={(r) => r.id}
        exportFileName="discount-requests"
        emptyTitle={status === 'pending' ? 'Nothing is waiting' : 'No requests'}
        toolbar={
          <Tabs value={status} onValueChange={(v) => setStatus(v as DiscountRequestStatus | 'all')}>
            <TabsList>
              <TabsTrigger value="pending">Waiting{pending.data ? ` (${pending.data})` : ''}</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="used">Used</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      <DecideDialog
        key={decision?.request.id ?? 'none'}
        decision={decision}
        onClose={() => setDecision(null)}
      />
    </>
  );
}

export function PendingDiscountsBanner({ className }: { className?: string }) {
  const { isSuperAdmin } = useAuth();
  const pending = usePendingDiscountCount(isSuperAdmin);
  if (!isSuperAdmin || !pending.data) return null;
  return (
    <Link
      to="/discount-requests"
      className={`flex items-center justify-between gap-3 rounded-xl border border-warning/50 bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground transition-colors hover:bg-warning-soft/80 ${className ?? ''}`}
    >
      <span className="font-medium">
        {pending.data === 1 ? '1 discount request is' : `${pending.data} discount requests are`} waiting for
        your approval
      </span>
      <span className="font-semibold">Review</span>
    </Link>
  );
}
