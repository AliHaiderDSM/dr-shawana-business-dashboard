import type { ColumnDef } from '@tanstack/react-table';
import { Gavel, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { PageHeader } from '@/components/shared/page-header';
import { DetailList } from '@/components/shared/panel';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ROLE_LABELS } from '@/features/staff/constants';
import { TraceNumber } from '@/features/trace/trace-page';
import { toastError } from '@/lib/api/errors';
import type { Role } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { productsApi } from '@redux/features/catalog';
import {
  useDecideStockHoldMutation,
  useStockHolds,
  type StockHold,
  type StockHoldDecision,
  type StockHoldReason,
  type StockHoldStatus,
} from '@redux/features/stock-holds';
import { HOLD_REASON_LABELS, HOLD_REASON_TONES, HoldStatusBadge } from './under-observation';

const DECISIONS: { value: StockHoldDecision; label: string; hint: string }[] = [
  {
    value: 'release',
    label: 'Release to stock',
    hint: 'Checked and fine. It can be sold and sent again here.',
  },
  {
    value: 'send_back',
    label: 'Back to Super Admin stock',
    hint: 'It never reached the branch or belongs in the Super Admin stock. It moves back there.',
  },
  { value: 'write_off', label: 'Write off', hint: 'Takes it out of the stock and shows it in Write-offs.' },
  { value: 'supplier_return', label: 'Send to supplier', hint: 'Takes it out of the stock as sent back.' },
];

const REASONS = (Object.keys(HOLD_REASON_LABELS) as StockHoldReason[]).filter((r) => r !== 'expired');

const STATUS_TABS: { value: StockHoldStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Under observation' },
  { value: 'released', label: 'Released' },
  { value: 'sent_back', label: 'Sent back' },
  { value: 'written_off', label: 'Written off' },
  { value: 'supplier_returned', label: 'Sent to supplier' },
];

const ACTIVE_TAB =
  'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm';
const ALL = 'all';

const roleLabel = (role?: string) => (role ? (ROLE_LABELS[role as Role] ?? role.replace(/_/g, ' ')) : '');

function sourceOf(h: StockHold) {
  if (h.sale) {
    return (
      <>
        Order <TraceNumber number={h.sale.invoiceNo} className="font-mono hover:underline" />
      </>
    );
  }
  if (h.transferNo) {
    return (
      <>
        Received <TraceNumber number={h.transferNo} className="font-mono hover:underline" />
      </>
    );
  }
  if (h.stockRequest) {
    return (
      <>
        Request <TraceNumber number={h.stockRequest.requestNo} className="font-mono hover:underline" /> for{' '}
        {h.stockRequest.branchName}
      </>
    );
  }
  return 'From the shelf';
}

function DecideDialog({ hold, onClose }: { hold: StockHold; onClose: () => void }) {
  const [decide, state] = useDecideStockHoldMutation();
  const choices = DECISIONS.filter((d) => d.value !== 'send_back' || hold.canSendBack);
  const [decision, setDecision] = useState<StockHoldDecision>(choices[0]!.value);
  const [note, setNote] = useState('');
  const busy = state.isLoading;
  const chosen = choices.find((d) => d.value === decision)!;
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
            {choices.map((d) => (
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
            variant={decision === 'release' || decision === 'send_back' ? 'default' : 'destructive'}
            disabled={!note.trim() || busy}
            onClick={() =>
              decide({ id: hold.id, body: { decision, note: note.trim() } })
                .unwrap()
                .then((done) => {
                  toast.success(`${done.serial}: ${chosen.label.toLowerCase()}`);
                  onClose();
                })
                .catch(toastError)
            }
          >
            {busy ? <Loader2 className="animate-spin" /> : <Gavel />}
            {chosen.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HoldSheet({
  hold,
  onOpenChange,
  onDecide,
}: {
  hold: StockHold | null;
  onOpenChange: (open: boolean) => void;
  onDecide: (hold: StockHold) => void;
}) {
  return (
    <Sheet open={Boolean(hold)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {hold ? (
          <>
            <SheetHeader>
              <SheetTitle className="font-mono">{hold.holdNo}</SheetTitle>
              <SheetDescription>
                {hold.product.name} · <span className="font-mono">{hold.serial}</span>
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-6 px-4 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <HoldStatusBadge status={hold.status} />
                <StatusBadge tone={HOLD_REASON_TONES[hold.reason]}>
                  {HOLD_REASON_LABELS[hold.reason]}
                </StatusBadge>
              </div>
              <DetailList
                items={[
                  { label: 'Label', value: <span className="font-mono">{hold.serial}</span> },
                  { label: 'Product', value: hold.product.name },
                  { label: 'Batch', value: hold.batchNo ?? 'No batch' },
                  { label: 'Expiry', value: hold.expiryDate ? formatDate(hold.expiryDate) : '—' },
                  { label: 'Where', value: hold.branch.name },
                  { label: 'From', value: sourceOf(hold) },
                  { label: 'Held on', value: formatDateTime(hold.createdAt) },
                  {
                    label: 'Reported by',
                    value: hold.reportedBy
                      ? `${hold.reportedBy.name} · ${roleLabel(hold.reportedBy.role)}`
                      : '—',
                  },
                ]}
              />
              {hold.note ? (
                <div className="space-y-1">
                  <h3 className="text-xs text-muted-foreground">What was wrong</h3>
                  <p className="text-sm whitespace-pre-wrap">{hold.note}</p>
                </div>
              ) : null}
              {hold.decidedBy ? (
                <div className="space-y-3 rounded-lg border p-3">
                  <h3 className="text-sm font-semibold">Decision</h3>
                  <DetailList
                    items={[
                      { label: 'Outcome', value: <HoldStatusBadge status={hold.status} /> },
                      {
                        label: 'Decided',
                        value: hold.decidedAt ? formatDateTime(hold.decidedAt) : '—',
                      },
                      { label: 'By', value: `${hold.decidedBy.name} · ${roleLabel(hold.decidedBy.role)}` },
                      { label: 'Write-off', value: hold.writeOffNo ?? '—' },
                    ]}
                  />
                  {hold.decisionNote ? (
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{hold.decisionNote}</p>
                  ) : null}
                </div>
              ) : null}
              {hold.canDecide ? (
                <Button className="w-full" onClick={() => onDecide(hold)}>
                  <Gavel />
                  Decide
                </Button>
              ) : hold.status === 'open' ? (
                <p className="text-sm text-muted-foreground">
                  Waiting for the Super Admin, the Warehouse Keeper or the Dispatch Department admin to
                  decide.
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function UnderObservationPage() {
  const { isSuperAdmin, me } = useAuth();
  const [status, setStatus] = useState<StockHoldStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState<StockHoldReason | typeof ALL>(ALL);
  const [productId, setProductId] = useState(ALL);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [deciding, setDeciding] = useState<StockHold | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const products = productsApi.useOptions();
  const holds = useStockHolds({
    status: status === 'all' ? null : status,
    search: search.trim() || null,
    reason: reason === ALL ? null : reason,
    productId: productId === ALL ? null : productId,
    from: from || null,
    to: to || null,
  });
  const selected = holds.data?.find((h) => h.id === selectedId) ?? null;
  const decider = isSuperAdmin || me?.role === 'warehouse_keeper' || me?.role === 'branch_admin';

  const columns: ColumnDef<StockHold, unknown>[] = [
    {
      id: 'holdNo',
      header: 'Number',
      accessorKey: 'holdNo',
      cell: ({ row }) => (
        <span className="font-mono font-medium whitespace-nowrap">{row.original.holdNo}</span>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      accessorKey: 'createdAt',
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'serial',
      header: 'Label',
      accessorKey: 'serial',
      cell: ({ row }) => <span className="font-mono whitespace-nowrap">{row.original.serial}</span>,
    },
    {
      id: 'product',
      header: 'Product',
      accessorFn: (r) => r.product.name,
      cell: ({ row }) => <span className="font-medium">{row.original.product.name}</span>,
    },
    {
      id: 'where',
      header: 'Where',
      accessorFn: (r) => r.branch.name,
      cell: ({ row }) => <span className="whitespace-nowrap">{row.original.branch.name}</span>,
    },
    {
      id: 'reason',
      header: 'Why',
      accessorFn: (r) => HOLD_REASON_LABELS[r.reason],
      cell: ({ row }) => (
        <StatusBadge tone={HOLD_REASON_TONES[row.original.reason]}>
          {HOLD_REASON_LABELS[row.original.reason]}
        </StatusBadge>
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
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setDeciding(h);
              }}
            >
              <Gavel />
              Decide
            </Button>
          );
        }
        return <HoldStatusBadge status={h.status} />;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Under observation"
        description={
          decider
            ? 'Pieces held back while sending or receiving. Click a row for its details, then decide: release it, send it back to the Super Admin stock, write it off, or send it to the supplier.'
            : 'Pieces held back while sending or receiving. The Super Admin, the Warehouse Keeper or the Dispatch Department admin decides what happens to them.'
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
        onRowClick={(r) => setSelectedId(r.id)}
        exportFileName="under-observation"
        emptyTitle={status === 'open' ? 'Nothing under observation' : 'Nothing here'}
        toolbar={
          <>
            <Tabs value={status} onValueChange={(v) => setStatus(v as StockHoldStatus | 'all')}>
              <TabsList>
                {STATUS_TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className={ACTIVE_TAB}>
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Input
              placeholder="Search label, product, order or request"
              className="h-9 w-72"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={reason} onValueChange={(v) => setReason(v as StockHoldReason | typeof ALL)}>
              <SelectTrigger className="h-9 w-40" aria-label="Reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All reasons</SelectItem>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {HOLD_REASON_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="h-9 w-48" aria-label="Product">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All products</SelectItem>
                {(products.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateRangePicker
              from={from || undefined}
              to={to || undefined}
              onChange={(range) => {
                setFrom(range.from ?? '');
                setTo(range.to ?? '');
              }}
              placeholder="All dates"
            />
          </>
        }
      />
      <HoldSheet
        hold={selected}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onDecide={(hold) => setDeciding(hold)}
      />
      {deciding ? <DecideDialog key={deciding.id} hold={deciding} onClose={() => setDeciding(null)} /> : null}
    </>
  );
}
