import type { ColumnDef } from '@tanstack/react-table';
import { Check, Loader2, PackageX, Plus, Send, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { BarcodeScanInput } from '@/components/shared/barcode-scan-input';
import { Combobox } from '@/components/shared/combobox';
import { DataTable } from '@/components/shared/data-table';
import { MoneyInput } from '@/components/shared/money-input';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ROLE_LABELS } from '@/features/staff/api';
import { toastError } from '@/lib/api/errors';
import type { Role } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatQuantity } from '@/lib/format';
import { findItemBySerial, useBatches, type ProductBatch } from './api';
import { TraceNumber } from '@/features/trace/trace-page';
import {
  useDecideWriteOff,
  usePendingWriteOffCount,
  useReportWriteOffs,
  useWriteOffs,
  WRITE_OFF_LABELS,
  type WriteOffReason,
  type WriteOffRecord,
} from './requests-api';

const REASON_TONES: Record<WriteOffReason, Tone> = {
  expired: 'warning',
  damaged: 'danger',
  lost: 'danger',
  adjustment: 'neutral',
};

const STATUS_TONES: Record<WriteOffRecord['status'], Tone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'neutral',
};

const STATUS_LABELS: Record<WriteOffRecord['status'], string> = {
  pending: 'Waiting for approval',
  approved: 'Approved, stock out',
  rejected: 'Rejected',
};

const REASONS: WriteOffReason[] = ['expired', 'damaged', 'lost'];

interface Line {
  key: number;
  batchId: string;
  label: string;
  available: string;
  qty: string;
  reason: WriteOffReason;
  note: string;
  serials: string[];
}

function ReportSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { isSuperAdmin } = useAuth();
  const report = useReportWriteOffs();
  const [search, setSearch] = useState('');
  const batches = useBatches({ pageSize: 50, inStockOnly: 'true', ...(search ? { search } : {}) }, open);
  const [lines, setLines] = useState<Line[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const options = ((batches.data?.data ?? []) as ProductBatch[])
    .filter((b) => !lines.some((l) => l.batchId === b.id))
    .map((b) => ({
      value: b.id,
      label: `${b.productName} · ${b.batchNo}`,
      hint: `${formatQuantity(b.quantity)} ${b.unit}${b.expiryDate ? ` · expires ${formatDate(b.expiryDate)}` : ''}`,
    }));
  const update = (key: number, change: Partial<Line>) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...change } : l)));
  const addLine = (line: Omit<Line, 'key'>) => {
    setLines((current) => [...current, { ...line, key: nextKey }]);
    setNextKey((k) => k + 1);
  };
  const ready = lines.length > 0 && lines.every((l) => Number(l.qty) > 0);

  const close = (value: boolean) => {
    if (!value) setLines([]);
    onOpenChange(value);
  };

  const scan = async (code: string) => {
    try {
      const piece = await findItemBySerial(code);
      if (piece.status !== 'in_stock') {
        toast.error(`${piece.serial} is ${piece.status.replace(/_/g, ' ')}`);
        return;
      }
      if (!piece.batchId) {
        toast.error(`${piece.serial} has no batch`);
        return;
      }
      if (lines.some((l) => l.serials.includes(piece.serial))) {
        toast.error(`${piece.serial} is already on the list`);
        return;
      }
      const existing = lines.find((l) => l.batchId === piece.batchId);
      if (existing) {
        const serials = [...existing.serials, piece.serial];
        update(existing.key, { serials, qty: String(serials.length) });
      } else {
        addLine({
          batchId: piece.batchId,
          label: `${piece.productName} · ${piece.batchNo ?? ''}`,
          available: '',
          qty: '1',
          reason:
            piece.expiryDate && piece.expiryDate < new Date().toISOString().slice(0, 10)
              ? 'expired'
              : 'damaged',
          note: '',
          serials: [piece.serial],
        });
      }
      toast.success(`${piece.serial} · ${piece.productName}`);
    } catch (error) {
      toastError(error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !report.isPending && close(v)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Report expired, damaged or lost stock</SheetTitle>
          <SheetDescription>
            {isSuperAdmin
              ? 'Your report takes the stock out at once.'
              : 'Make the list and send it. The Super Admin approves each line; only then the stock leaves. Scanned labels are held so nobody sells or dispatches them.'}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4">
          <BarcodeScanInput onScan={scan} placeholder="Scan the DSM label of each piece" />
          <Combobox
            value={null}
            onChange={(value) => {
              const batch = ((batches.data?.data ?? []) as ProductBatch[]).find((b) => b.id === value);
              if (!batch) return;
              addLine({
                batchId: batch.id,
                label: `${batch.productName} · ${batch.batchNo}`,
                available: batch.quantity,
                qty: '',
                reason: batch.status === 'expired' ? 'expired' : 'damaged',
                note: '',
                serials: [],
              });
            }}
            onSearchChange={setSearch}
            loading={batches.isFetching && !batches.data}
            options={options}
            placeholder="Or pick a batch without labels"
            aria-label="Pick a batch"
          />
          {lines.length ? (
            <ul className="divide-y rounded-lg border">
              {lines.map((line) => (
                <li key={line.key} className="space-y-2 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-40 flex-1">
                      <div className="text-sm font-medium">{line.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {line.serials.length
                          ? `${line.serials.length} labels: ${line.serials.join(', ')}`
                          : line.available
                            ? `${formatQuantity(line.available)} in stock`
                            : ''}
                      </div>
                    </div>
                    <MoneyInput
                      prefix=""
                      decimals={3}
                      placeholder="Qty"
                      aria-label={`${line.label} quantity`}
                      className="h-9 w-24 text-right"
                      value={line.qty}
                      readOnly={line.serials.length > 0}
                      onChange={(e) => update(line.key, { qty: e.target.value })}
                    />
                    <Select
                      value={line.reason}
                      onValueChange={(v) => update(line.key, { reason: v as WriteOffReason })}
                    >
                      <SelectTrigger size="sm" className="h-9 w-32" aria-label="Reason">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REASONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {WRITE_OFF_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground"
                      aria-label={`Remove ${line.label}`}
                      onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <Input
                    placeholder="What happened? (optional)"
                    className="h-8"
                    maxLength={500}
                    value={line.note}
                    onChange={(e) => update(line.key, { note: e.target.value })}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
              Scan labels or pick batches to build the list.
            </p>
          )}
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={report.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!ready || report.isPending}
            onClick={() =>
              report
                .mutateAsync({
                  items: lines.map((l) => ({
                    batchId: l.batchId,
                    qty: l.qty,
                    reason: l.reason,
                    note: l.note.trim() || null,
                    ...(l.serials.length ? { serials: l.serials } : {}),
                  })),
                })
                .then((rows) => {
                  toast.success(
                    isSuperAdmin
                      ? `${rows.length} written off`
                      : `${rows.length} ${rows.length === 1 ? 'line' : 'lines'} sent to the Super Admin`,
                  );
                  close(false);
                })
                .catch(toastError)
            }
          >
            {report.isPending ? <Loader2 className="animate-spin" /> : <Send />}
            {isSuperAdmin ? 'Write off' : 'Send for approval'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DecideDialog({
  decision,
  onClose,
}: {
  decision: { record: WriteOffRecord; approve: boolean } | null;
  onClose: () => void;
}) {
  const decide = useDecideWriteOff();
  const [note, setNote] = useState('');
  if (!decision) return null;
  const { record, approve } = decision;
  return (
    <Dialog open onOpenChange={(open) => !open && !decide.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {approve ? 'Approve' : 'Reject'} {record.writeOffNo}
          </DialogTitle>
          <DialogDescription>
            {formatQuantity(record.qty)} {record.unit} {record.productName}
            {record.batchNo ? ` (batch ${record.batchNo})` : ''} at {record.branch.name},{' '}
            {WRITE_OFF_LABELS[record.reason].toLowerCase()}.{' '}
            {approve ? 'The stock leaves the inventory now.' : 'Held labels go back to stock.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="write-off-decision">Note (optional)</Label>
          <Textarea
            id="write-off-decision"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={decide.isPending}>
            Cancel
          </Button>
          <Button
            variant={approve ? 'destructive' : 'default'}
            disabled={decide.isPending}
            onClick={() =>
              decide
                .mutateAsync({ id: record.id, approve, note: note.trim() || null })
                .then(() => {
                  toast.success(`${record.writeOffNo} ${approve ? 'approved' : 'rejected'}`);
                  onClose();
                })
                .catch(toastError)
            }
          >
            {decide.isPending ? <Loader2 className="animate-spin" /> : approve ? <Check /> : <X />}
            {approve ? 'Approve' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WriteOffsPage() {
  const { isSuperAdmin, can } = useAuth();
  const [status, setStatus] = useState<WriteOffRecord['status'] | 'all'>('all');
  const [search, setSearch] = useState('');
  const [reporting, setReporting] = useState(false);
  const [decision, setDecision] = useState<{ record: WriteOffRecord; approve: boolean } | null>(null);
  const pending = usePendingWriteOffCount(isSuperAdmin);
  const list = useWriteOffs({
    ...(status === 'all' ? {} : { status }),
    ...(search.trim() ? { search: search.trim() } : {}),
  });

  const columns: ColumnDef<WriteOffRecord, unknown>[] = [
    {
      id: 'writeOffNo',
      header: 'Write-off no',
      accessorKey: 'writeOffNo',
      cell: ({ row }) => <TraceNumber number={row.original.writeOffNo} />,
    },
    {
      id: 'date',
      header: 'Date',
      accessorKey: 'date',
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.date)}</span>,
    },
    ...(isSuperAdmin
      ? ([
          {
            id: 'branch',
            header: 'Branch',
            accessorFn: (r) => r.branch.name,
            cell: ({ row }) => row.original.branch.name,
          },
        ] as ColumnDef<WriteOffRecord, unknown>[])
      : []),
    {
      id: 'product',
      header: 'Product',
      accessorKey: 'productName',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.productName}</div>
          <div className="text-xs text-muted-foreground">
            {row.original.batchNo ? `Batch ${row.original.batchNo}` : 'No batch'}
            {row.original.expiryDate ? ` · expires ${formatDate(row.original.expiryDate)}` : ''}
          </div>
        </div>
      ),
    },
    {
      id: 'qty',
      header: 'Qty',
      accessorFn: (r) => -Number(r.qty),
      meta: { align: 'right' },
      cell: ({ row }) => (
        <span className="text-destructive tabular-nums">
          −{formatQuantity(row.original.qty)} {row.original.unit}
        </span>
      ),
    },
    {
      id: 'reason',
      header: 'Why',
      accessorFn: (r) => WRITE_OFF_LABELS[r.reason],
      cell: ({ row }) => (
        <div className="space-y-1">
          <StatusBadge tone={REASON_TONES[row.original.reason]}>
            {WRITE_OFF_LABELS[row.original.reason]}
          </StatusBadge>
          {row.original.note ? (
            <div className="max-w-64 text-xs text-muted-foreground">{row.original.note}</div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'serials',
      header: 'Labels',
      accessorFn: (r) => r.serials.join(', '),
      cell: ({ row }) =>
        row.original.serials.length ? (
          <span className="font-mono text-xs" title={row.original.serials.join(', ')}>
            {row.original.serials.slice(0, 3).join(', ')}
            {row.original.serials.length > 3 ? ` +${row.original.serials.length - 3}` : ''}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'createdBy',
      header: 'Reported by',
      accessorFn: (r) => r.createdBy?.name ?? '',
      cell: ({ row }) => (
        <div>
          <div>{row.original.createdBy?.name ?? '—'}</div>
          <div className="text-xs text-muted-foreground">
            {row.original.createdBy ? (ROLE_LABELS[row.original.createdBy.role as Role] ?? '') : ''}
          </div>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (r) => STATUS_LABELS[r.status],
      cell: ({ row }) => {
        const r = row.original;
        if (isSuperAdmin && r.status === 'pending') {
          return (
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setDecision({ record: r, approve: true })}
              >
                <Check />
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDecision({ record: r, approve: false })}>
                <X />
                Reject
              </Button>
            </div>
          );
        }
        return (
          <div className="space-y-1">
            <StatusBadge tone={STATUS_TONES[r.status]}>{STATUS_LABELS[r.status]}</StatusBadge>
            {r.decidedBy ? (
              <div className="text-xs text-muted-foreground">
                by {r.decidedBy.name}
                {r.decisionNote ? ` · “${r.decisionNote}”` : ''}
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
        title="Write-offs"
        description={
          isSuperAdmin
            ? 'Expired, damaged or lost stock the branches reported. Approve to take it out of the inventory, or reject to put held labels back.'
            : 'Report expired, damaged or lost stock. It leaves the inventory only after the Super Admin approves; held labels cannot be sold or dispatched.'
        }
        actions={
          can('stock.update') ? (
            <Button variant={isSuperAdmin ? 'outline' : 'default'} onClick={() => setReporting(true)}>
              {isSuperAdmin ? <PackageX /> : <Plus />}
              Report stock
            </Button>
          ) : null
        }
      />
      <DataTable
        columns={columns}
        data={list.data}
        isLoading={list.isLoading}
        isFetching={list.isFetching}
        error={list.error}
        onRetry={() => void list.refetch()}
        getRowId={(r) => r.id}
        exportFileName="write-offs"
        emptyTitle="Nothing here"
        toolbar={
          <>
            <Tabs value={status} onValueChange={(v) => setStatus(v as WriteOffRecord['status'] | 'all')}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Waiting{pending.data ? ` (${pending.data})` : ''}</TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="rejected">Rejected</TabsTrigger>
              </TabsList>
            </Tabs>
            <Input
              placeholder="Search product, batch or number"
              className="h-9 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </>
        }
      />
      <ReportSheet open={reporting} onOpenChange={setReporting} />
      <DecideDialog
        key={decision?.record.id ?? 'none'}
        decision={decision}
        onClose={() => setDecision(null)}
      />
    </>
  );
}

export function PendingWriteOffsBanner({ className }: { className?: string }) {
  const { isSuperAdmin } = useAuth();
  const pending = usePendingWriteOffCount(isSuperAdmin);
  if (!isSuperAdmin || !pending.data) return null;
  return (
    <Link
      to="/write-offs"
      className={`flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground transition-colors hover:bg-destructive-soft/80 ${className ?? ''}`}
    >
      <span className="font-medium">
        {pending.data === 1 ? '1 write-off is' : `${pending.data} write-offs are`} waiting for your approval
      </span>
      <span className="font-semibold">Review</span>
    </Link>
  );
}
