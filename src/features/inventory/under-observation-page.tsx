import type { ColumnDef } from '@tanstack/react-table';
import { Gavel, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ROLE_LABELS } from '@/features/staff/constants';
import { TraceNumber } from '@/features/trace/trace-page';
import { toastError } from '@/lib/api/errors';
import type { Role } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  useDecideStockHoldMutation,
  useStockHolds,
  type StockHold,
  type StockHoldDecision,
  type StockHoldStatus,
} from '@redux/features/stock-holds';
import { HOLD_REASON_LABELS, HOLD_REASON_TONES, HoldStatusBadge } from './under-observation';

const DECISIONS: { value: StockHoldDecision; label: string; hint: string }[] = [
  { value: 'release', label: 'Release to stock', hint: 'Checked and fine. It can be sold and sent again.' },
  { value: 'write_off', label: 'Write off', hint: 'Takes it out of the stock and shows it in Write-offs.' },
  { value: 'supplier_return', label: 'Send to supplier', hint: 'Takes it out of the stock as sent back.' },
];

const roleLabel = (role?: string) => (role ? (ROLE_LABELS[role as Role] ?? role.replace(/_/g, ' ')) : '');

function DecideDialog({ hold, onClose }: { hold: StockHold; onClose: () => void }) {
  const [decide, state] = useDecideStockHoldMutation();
  const [decision, setDecision] = useState<StockHoldDecision>('release');
  const [note, setNote] = useState('');
  const busy = state.isLoading;
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Decide {hold.serial}</DialogTitle>
          <DialogDescription>
            {hold.product.name}
            {hold.batchNo ? ` · batch ${hold.batchNo}` : ''} at {hold.branch.name},{' '}
            {HOLD_REASON_LABELS[hold.reason].toLowerCase()}
            {hold.note ? `: “${hold.note}”` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Decision" className="grid gap-2">
            {DECISIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                role="radio"
                aria-checked={decision === d.value}
                onClick={() => setDecision(d.value)}
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-left transition-colors',
                  decision === d.value
                    ? 'border-primary/40 bg-primary-soft text-primary-soft-foreground'
                    : 'hover:bg-muted/50',
                )}
              >
                <div className="text-sm font-semibold">{d.label}</div>
                <div className="text-xs text-muted-foreground">{d.hint}</div>
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="hold-decision-note">Note</Label>
            <Textarea
              id="hold-decision-note"
              placeholder="What did you find?"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={decision === 'release' ? 'default' : 'destructive'}
            disabled={!note.trim() || busy}
            onClick={() =>
              decide({ id: hold.id, body: { decision, note: note.trim() } })
                .unwrap()
                .then((done) => {
                  toast.success(
                    `${done.serial}: ${DECISIONS.find((d) => d.value === decision)!.label.toLowerCase()}`,
                  );
                  onClose();
                })
                .catch(toastError)
            }
          >
            {busy ? <Loader2 className="animate-spin" /> : <Gavel />}
            {DECISIONS.find((d) => d.value === decision)!.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UnderObservationPage() {
  const { isSuperAdmin, me } = useAuth();
  const [status, setStatus] = useState<StockHoldStatus | 'all'>('open');
  const [search, setSearch] = useState('');
  const [deciding, setDeciding] = useState<StockHold | null>(null);
  const holds = useStockHolds({ status: status === 'all' ? null : status, search: search.trim() || null });
  const decider = me?.role === 'warehouse_keeper' || me?.role === 'branch_admin';

  const columns: ColumnDef<StockHold, unknown>[] = [
    {
      id: 'holdNo',
      header: 'Number',
      accessorKey: 'holdNo',
      cell: ({ row }) => (
        <div>
          <div className="font-mono font-medium whitespace-nowrap">{row.original.holdNo}</div>
          <div className="text-xs whitespace-nowrap text-muted-foreground">
            {formatDateTime(row.original.createdAt)}
          </div>
        </div>
      ),
    },
    {
      id: 'serial',
      header: 'Label',
      accessorKey: 'serial',
      cell: ({ row }) => (
        <span className="font-mono font-medium whitespace-nowrap">{row.original.serial}</span>
      ),
    },
    {
      id: 'product',
      header: 'Product',
      accessorFn: (r) => r.product.name,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.product.name}</div>
          <div className="text-xs text-muted-foreground">
            {row.original.batchNo ? `Batch ${row.original.batchNo}` : 'No batch'}
            {row.original.expiryDate ? ` · expires ${formatDate(row.original.expiryDate)}` : ''}
          </div>
        </div>
      ),
    },
    {
      id: 'where',
      header: 'Where',
      accessorFn: (r) => r.branch.name,
      cell: ({ row }) => {
        const h = row.original;
        return (
          <div>
            <div className="whitespace-nowrap">{h.branch.name}</div>
            <div className="text-xs whitespace-nowrap text-muted-foreground">
              {h.sale ? (
                <>
                  Order <TraceNumber number={h.sale.invoiceNo} className="font-mono hover:underline" />
                </>
              ) : h.stockRequest ? (
                <>
                  Request{' '}
                  <TraceNumber number={h.stockRequest.requestNo} className="font-mono hover:underline" /> for{' '}
                  {h.stockRequest.branchName}
                </>
              ) : (
                'From the shelf'
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: 'reason',
      header: 'Why',
      accessorFn: (r) => HOLD_REASON_LABELS[r.reason],
      cell: ({ row }) => (
        <div className="space-y-1">
          <StatusBadge tone={HOLD_REASON_TONES[row.original.reason]}>
            {HOLD_REASON_LABELS[row.original.reason]}
          </StatusBadge>
          {row.original.note ? (
            <div className="max-w-64 text-xs text-muted-foreground">{row.original.note}</div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'reportedBy',
      header: 'Reported by',
      accessorFn: (r) => r.reportedBy?.name ?? '',
      cell: ({ row }) => (
        <div>
          <div className="whitespace-nowrap">{row.original.reportedBy?.name ?? '—'}</div>
          <div className="text-xs text-muted-foreground">{roleLabel(row.original.reportedBy?.role)}</div>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (r) => r.status,
      cell: ({ row }) => {
        const h = row.original;
        if (h.canDecide) {
          return (
            <Button size="sm" onClick={() => setDeciding(h)}>
              <Gavel />
              Decide
            </Button>
          );
        }
        return (
          <div className="space-y-1">
            <HoldStatusBadge status={h.status} />
            {h.decidedBy ? (
              <div className="max-w-64 text-xs text-muted-foreground">
                by {h.decidedBy.name}
                {h.writeOffNo ? ` · ${h.writeOffNo}` : ''}
                {h.decisionNote ? ` · “${h.decisionNote}”` : ''}
              </div>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Under observation"
        description={
          isSuperAdmin
            ? 'Pieces the Warehouse Keeper or the Dispatch Department held back while sending. They cannot be sold or sent until the Warehouse Keeper or the Dispatch Department admin decides.'
            : decider
              ? 'Pieces held back while sending. Check each one and decide: release it to stock, write it off, or send it to the supplier.'
              : 'Pieces held back while sending. The Warehouse Keeper or the Dispatch Department admin decides what happens to them.'
        }
      />
      <DataTable
        columns={columns}
        data={holds.data}
        isLoading={holds.isLoading}
        isFetching={holds.isFetching}
        error={holds.error}
        onRetry={() => void holds.refetch()}
        getRowId={(r) => r.id}
        exportFileName="under-observation"
        emptyTitle={status === 'open' ? 'Nothing under observation' : 'Nothing here'}
        toolbar={
          <>
            <Tabs value={status} onValueChange={(v) => setStatus(v as StockHoldStatus | 'all')}>
              <TabsList>
                <TabsTrigger value="open">Under observation</TabsTrigger>
                <TabsTrigger value="released">Released</TabsTrigger>
                <TabsTrigger value="written_off">Written off</TabsTrigger>
                <TabsTrigger value="supplier_returned">Sent to supplier</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
            <Input
              placeholder="Search label, product, order or request"
              className="h-9 w-72"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </>
        }
      />
      {deciding ? <DecideDialog key={deciding.id} hold={deciding} onClose={() => setDeciding(null)} /> : null}
    </>
  );
}
