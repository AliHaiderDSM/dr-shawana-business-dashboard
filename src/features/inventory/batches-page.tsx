import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Loader2, PackageMinus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { BarcodeScanInput } from '@/components/shared/barcode-scan-input';
import { DataTable } from '@/components/shared/data-table';
import { ErrorState } from '@/components/shared/error-state';
import { FilterSelect } from '@/components/shared/list-filters';
import { MoneyInput } from '@/components/shared/money-input';
import { PageHeader } from '@/components/shared/page-header';
import { DetailList, Panel } from '@/components/shared/panel';
import { DetailSkeleton } from '@/components/shared/skeletons';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { productsApi } from '@/features/catalog/api';
import { useListState } from '@/hooks/use-list-state';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatMoney, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  findItemBySerial,
  useSerialSummary,
  useBatch,
  useBatches,
  useWriteOff,
  type BatchStatus,
  type ProductBatch,
  type ProductBatchDetail,
  type WriteOffInput,
} from './api';

const STATUS: Record<BatchStatus, { label: string; tone: Tone }> = {
  ok: { label: 'In date', tone: 'success' },
  expiring: { label: 'Expiring soon', tone: 'warning' },
  expired: { label: 'Expired', tone: 'danger' },
  no_expiry: { label: 'No expiry', tone: 'neutral' },
};

const REASONS: { value: WriteOffInput['reason']; label: string }[] = [
  { value: 'expired', label: 'Expired' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'lost', label: 'Lost' },
  { value: 'adjustment', label: 'Stock count adjustment' },
];

const MOVEMENT_LABELS: Record<string, string> = {
  purchase_in: 'Purchase',
  stock_in: 'Received',
  stock_out: 'Stock out',
  sale: 'Sold',
  sale_return: 'Returned',
  sale_edit_adjust: 'Sale edited',
  manufacturing_in: 'Produced',
  adjustment: 'Write-off',
};

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  return <StatusBadge tone={STATUS[status].tone}>{STATUS[status].label}</StatusBadge>;
}

export const batchColumns = (showProduct: boolean): ColumnDef<ProductBatch, unknown>[] => [
  ...(showProduct
    ? [
        {
          id: 'product',
          header: 'Product',
          accessorKey: 'productName',
          meta: { hideable: false },
          cell: ({ row }) => <span className="font-medium">{row.original.productName}</span>,
        } satisfies ColumnDef<ProductBatch, unknown>,
      ]
    : []),
  {
    id: 'batchNo',
    header: 'Batch',
    accessorKey: 'batchNo',
    cell: ({ row }) => <span className="font-mono">{row.original.batchNo}</span>,
  },
  {
    id: 'manufacturingDate',
    header: 'Mfg',
    accessorKey: 'manufacturingDate',
    cell: ({ row }) => formatDate(row.original.manufacturingDate),
  },
  {
    id: 'expiryDate',
    header: 'Expiry',
    accessorKey: 'expiryDate',
    cell: ({ row }) => formatDate(row.original.expiryDate),
  },
  {
    id: 'supplier',
    header: 'Supplier',
    accessorFn: (r) => r.supplierName ?? '',
    cell: ({ row }) => row.original.supplierName ?? '—',
  },
  {
    id: 'received',
    header: 'Received',
    accessorKey: 'received',
    meta: { align: 'right' },
    cell: ({ row }) => formatQuantity(row.original.received),
  },
  {
    id: 'quantity',
    header: 'On hand',
    accessorKey: 'quantity',
    meta: { align: 'right' },
    cell: ({ row }) => (
      <span className={cn('font-semibold', row.original.status === 'expired' && 'text-destructive')}>
        {formatQuantity(row.original.quantity)}{' '}
        <span className="font-normal text-muted-foreground">{row.original.unit}</span>
      </span>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    accessorFn: (r) => STATUS[r.status].label,
    cell: ({ row }) => <BatchStatusBadge status={row.original.status} />,
  },
];

export function BatchesPage() {
  const navigate = useNavigate();
  const list = useListState();
  const query = useBatches(list.query);
  const products = productsApi.useOptions();
  const inStockOnly = list.filters.inStockOnly === 'true';

  return (
    <>
      <PageHeader
        title="Batches"
        description="Every batch received, with its expiry and what is left. Sales take the batch that expires first."
      />
      <DataTable
        columns={batchColumns(true)}
        data={query.data?.data}
        meta={query.data?.meta}
        list={list}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        searchPlaceholder="Batch number or product"
        exportFileName="batches"
        onRowClick={(r) => void navigate(`/inventory/batches/${r.id}`)}
        rowClassName={(r) =>
          r.status === 'expired' && Number(r.quantity) > 0 ? 'bg-destructive-soft/40' : ''
        }
        emptyTitle="No batches yet"
        emptyDescription="A batch is created when stock is received with a batch number, or produced in manufacturing."
        toolbar={
          <>
            <FilterSelect
              list={list}
              name="productId"
              allLabel="All products"
              className="w-48"
              options={(products.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
            <FilterSelect
              list={list}
              name="status"
              allLabel="Any expiry"
              className="w-40"
              options={[
                { value: 'active', label: 'Not expired' },
                { value: 'expiring', label: 'Expiring in 90 days' },
                { value: 'expired', label: 'Expired' },
              ]}
            />
            <label className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm shadow-xs">
              <Switch
                checked={inStockOnly}
                onCheckedChange={(checked) => list.setFilter('inStockOnly', checked ? 'true' : undefined)}
                aria-label="In stock only"
              />
              In stock only
            </label>
          </>
        }
      />
    </>
  );
}

function WriteOffDialog({ batch, onClose }: { batch: ProductBatchDetail; onClose: () => void }) {
  const writeOff = useWriteOff(batch.id);
  const [qty, setQty] = useState(batch.quantity);
  const [reason, setReason] = useState<WriteOffInput['reason']>(
    batch.status === 'expired' ? 'expired' : 'damaged',
  );
  const [note, setNote] = useState('');
  const [serials, setSerials] = useState<string[]>([]);
  const summary = useSerialSummary(batch.productId);
  const tracked = summary.data?.trackSerials ?? false;
  const count = tracked && serials.length > 0 ? String(serials.length) : qty;
  const invalid = !(Number(count) > 0) || Number(count) > Number(batch.quantity);

  const scan = async (code: string) => {
    try {
      const piece = await findItemBySerial(code);
      if (piece.batchId !== batch.id) toast.error(`${piece.serial} belongs to another batch`);
      else if (piece.status !== 'in_stock') toast.error(`${piece.serial} is not in stock`);
      else if (serials.includes(piece.serial)) toast.error(`${piece.serial} is already scanned`);
      else setSerials((current) => [...current, piece.serial]);
    } catch (error) {
      toastError(error);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !writeOff.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Write off stock</DialogTitle>
          <DialogDescription>
            Removes stock of batch {batch.batchNo} from {batch.productName}. It is recorded in the batch
            history.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="write-off-qty">Quantity</Label>
              <MoneyInput
                id="write-off-qty"
                prefix=""
                decimals={3}
                value={count}
                readOnly={tracked && serials.length > 0}
                onChange={(e) => setQty(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">
                {formatQuantity(batch.quantity)} {batch.unit} on hand
              </span>
            </div>
            <div className="grid gap-2">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as WriteOffInput['reason'])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {tracked ? (
            <div className="grid gap-2">
              <Label>Labels</Label>
              <BarcodeScanInput onScan={scan} placeholder="Scan the label of each piece" />
              {serials.length ? (
                <div className="flex flex-wrap gap-1">
                  {serials.map((serial) => (
                    <button
                      key={serial}
                      type="button"
                      className="rounded-md border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] hover:line-through"
                      onClick={() => setSerials((current) => current.filter((x) => x !== serial))}
                    >
                      {serial}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Labelled product: scan each piece. Without scans only unlabelled stock can be written off.
                </span>
              )}
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="write-off-note">Note</Label>
            <Textarea id="write-off-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={writeOff.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={invalid || writeOff.isPending}
            onClick={() =>
              writeOff
                .mutateAsync({
                  qty: count,
                  reason,
                  note: note.trim() || null,
                  ...(serials.length ? { serials } : {}),
                })
                .then(() => {
                  toast.success(`${formatQuantity(count)} written off from ${batch.batchNo}`);
                  onClose();
                })
                .catch(toastError)
            }
          >
            {writeOff.isPending ? <Loader2 className="animate-spin" /> : <PackageMinus />}
            Write off
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function referenceLink(m: ProductBatchDetail['movements'][number]) {
  const label = m.reference ?? '—';
  if (m.referenceType === 'sale') return <Link to={`/sales/${m.referenceId}`}>{label}</Link>;
  if (m.referenceType === 'sale_return') return <Link to={`/returns/${m.referenceId}`}>{label}</Link>;
  return label;
}

export function BatchDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const query = useBatch(id);
  const [writingOff, setWritingOff] = useState(false);

  if (query.isLoading) return <DetailSkeleton />;
  if (query.error || !query.data)
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const b = query.data;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
        <Link to="/inventory/batches">
          <ArrowLeft />
          Batches
        </Link>
      </Button>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="font-mono">{b.batchNo}</span>
            <BatchStatusBadge status={b.status} />
          </span>
        }
        description={b.productName}
        actions={
          can('stock.update') && Number(b.quantity) > 0 ? (
            <Button variant="outline" onClick={() => setWritingOff(true)}>
              <PackageMinus />
              Write off
            </Button>
          ) : null
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel
          title="History"
          description="Every stock movement of this batch, oldest first."
          bodyClassName="p-0"
        >
          {b.movements.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No movements yet.</p>
          ) : (
            <ul className="divide-y">
              {b.movements.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="w-24 shrink-0 text-muted-foreground">{formatDate(m.date)}</span>
                  <span className="w-28 shrink-0 font-medium">{MOVEMENT_LABELS[m.type] ?? m.type}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground [&_a]:text-primary [&_a]:hover:underline">
                    {referenceLink(m)}
                    {m.note && m.note !== m.reference ? ` · ${m.note}` : ''}
                  </span>
                  <span
                    className={cn(
                      'w-20 text-right font-semibold tabular-nums',
                      Number(m.qty) < 0 ? 'text-destructive' : 'text-success',
                    )}
                  >
                    {Number(m.qty) > 0 ? '+' : ''}
                    {formatQuantity(m.qty)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Details">
          <DetailList
            items={[
              {
                label: 'Product',
                value: (
                  <Link to={`/stock/${b.productId}`} className="text-primary hover:underline">
                    {b.productName}
                  </Link>
                ),
              },
              { label: 'Manufacturing', value: formatDate(b.manufacturingDate) },
              { label: 'Expiry', value: formatDate(b.expiryDate) },
              { label: 'Supplier', value: b.supplierName },
              { label: 'Purchase price', value: b.unitCost ? formatMoney(b.unitCost) : null },
              { label: 'Received', value: `${formatQuantity(b.received)} ${b.unit}` },
              { label: 'On hand', value: `${formatQuantity(b.quantity)} ${b.unit}` },
            ]}
          />
        </Panel>
      </div>
      {writingOff ? <WriteOffDialog batch={b} onClose={() => setWritingOff(false)} /> : null}
    </>
  );
}
