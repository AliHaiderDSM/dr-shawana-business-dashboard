import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, ArrowUpRight, Layers, Printer, Tags, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { DataTable } from '@/components/shared/data-table';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { PageHeader } from '@/components/shared/page-header';
import { PrintButton } from '@/components/shared/print-button';
import { Panel } from '@/components/shared/panel';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge, type Tone } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { productsApi } from '@redux/features/catalog';
import { formatDate, formatQuantity, titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  useBatches,
  useProductLedger,
  useSerialSummary,
  type ItemStatus,
  type ProductBatch,
  type ProductLedger,
} from '@redux/features/inventory';
import { BatchStatusBadge } from './batches-page';
import { ITEM_STATUS } from './item-status';
import { RegisterLabelsDialog } from './labels-page';

type Movement = ProductLedger['movements'][number];

const MOVEMENT_TONES: Record<Movement['type'], Tone> = {
  purchase_in: 'primary',
  stock_in: 'success',
  stock_out: 'warning',
  sale: 'info',
  sale_return: 'success',
  sale_edit_adjust: 'neutral',
  manufacturing_in: 'primary',
  adjustment: 'neutral',
};

function documentIds(movements: Movement[] | undefined, kind: 'stock_in' | 'stock_out') {
  const list = (movements ?? []).filter((m) => m.type === kind && m.referenceType === kind);
  const reversed = new Set(list.filter((m) => m.isReversal).map((m) => m.referenceId));
  return [
    ...new Set(list.filter((m) => !m.isReversal && !reversed.has(m.referenceId)).map((m) => m.referenceId)),
  ];
}

function PrintDocumentsButton({ label, path, ids }: { label: string; path: string; ids: string[] }) {
  if (ids.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled title="Nothing to print in this period">
        <Printer />
        {label}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="sm">
      <Link to={`${path}?ids=${ids.join(',')}`}>
        <Printer />
        {label}
      </Link>
    </Button>
  );
}

const REFERENCE_PATHS: Record<string, (id: string) => string> = {
  sale: (id) => `/sales/${id}`,
  sale_return: (id) => `/returns/${id}`,
};

const columns: ColumnDef<Movement, unknown>[] = [
  {
    id: 'date',
    header: 'Date',
    accessorKey: 'date',
    cell: ({ row }) => formatDate(row.original.date),
  },
  {
    id: 'type',
    header: 'Movement',
    accessorFn: (m) => titleCase(m.type),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <StatusBadge tone={MOVEMENT_TONES[row.original.type]}>{titleCase(row.original.type)}</StatusBadge>
        {row.original.isReversal ? <span className="text-xs text-muted-foreground">reversal</span> : null}
      </div>
    ),
  },
  {
    id: 'detail',
    header: 'From / to',
    accessorFn: (m) => m.detail ?? '',
    cell: ({ row }) => {
      const { detail, referenceType, referenceId } = row.original;
      if (!detail) return <span className="text-muted-foreground">—</span>;
      const path = REFERENCE_PATHS[referenceType]?.(referenceId);
      return path ? (
        <Link to={path} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
          {detail}
        </Link>
      ) : (
        detail
      );
    },
  },
  {
    id: 'batch',
    header: 'Batch',
    accessorFn: (m) => m.batchNo ?? '',
    cell: ({ row }) =>
      row.original.batchNo ? <span className="font-mono text-xs">{row.original.batchNo}</span> : '—',
  },
  {
    id: 'manufacturingDate',
    header: 'Mfg',
    accessorFn: (m) => m.manufacturingDate ?? '',
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {row.original.manufacturingDate ? formatDate(row.original.manufacturingDate) : '—'}
      </span>
    ),
  },
  {
    id: 'expiryDate',
    header: 'Expiry',
    accessorFn: (m) => m.expiryDate ?? '',
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {row.original.expiryDate ? formatDate(row.original.expiryDate) : '—'}
      </span>
    ),
  },
  {
    id: 'note',
    header: 'Note',
    accessorKey: 'note',
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.note ?? '—'}</span>,
  },
  {
    id: 'in',
    header: 'In',
    accessorKey: 'in',
    meta: { align: 'right' },
    cell: ({ row }) =>
      Number(row.original.in) > 0 ? (
        <span className="text-success">+{formatQuantity(row.original.in)}</span>
      ) : (
        '—'
      ),
  },
  {
    id: 'out',
    header: 'Out',
    accessorKey: 'out',
    meta: { align: 'right' },
    cell: ({ row }) =>
      Number(row.original.out) > 0 ? (
        <span className="text-destructive">−{formatQuantity(row.original.out)}</span>
      ) : (
        '—'
      ),
  },
  {
    id: 'balance',
    header: 'Balance',
    accessorKey: 'balance',
    meta: { align: 'right' },
    cell: ({ row }) => <span className="font-medium">{formatQuantity(row.original.balance)}</span>,
  },
];

const inStock = (b: ProductBatch) => Number(b.quantity) > 0;

const byFirstOut = (a: ProductBatch, b: ProductBatch) =>
  Number(inStock(b)) - Number(inStock(a)) ||
  (a.expiryDate ?? '9999-12-31').localeCompare(b.expiryDate ?? '9999-12-31') ||
  a.createdAt.localeCompare(b.createdAt);

function BatchesPanel({
  batches,
  loading,
  unit,
  selected,
  onSelect,
  className,
}: {
  batches: ProductBatch[];
  loading: boolean;
  unit: string;
  selected: string | null;
  onSelect: (batchNo: string | null) => void;
  className?: string;
}) {
  const sorted = [...batches].sort(byFirstOut);
  const first = sorted.find((b) => inStock(b) && b.status !== 'expired');
  const stocked = sorted.filter(inStock).length;
  return (
    <Panel
      className={className}
      title="Batches"
      description={
        loading
          ? 'Loading…'
          : batches.length
            ? `${batches.length} batch${batches.length === 1 ? '' : 'es'}, ${stocked} in stock. Click one to see only its movements.`
            : 'No batch recorded for this product.'
      }
    >
      {sorted.length ? (
        <ul className="-mx-2 max-h-72 divide-y overflow-y-auto">
          {sorted.map((b) => {
            const active = selected === b.batchNo;
            return (
              <li key={b.id}>
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-md px-2 py-2 transition-colors',
                    active ? 'bg-primary-soft' : 'hover:bg-muted/50',
                    !inStock(b) && !active && 'opacity-60',
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelect(active ? null : b.batchNo)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{b.batchNo}</span>
                        {first?.id === b.id ? (
                          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                            Goes out first
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {b.expiryDate ? `Expires ${formatDate(b.expiryDate)}` : 'No expiry'}
                        {b.manufacturingDate ? ` · Mfg ${formatDate(b.manufacturingDate)}` : ''}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-semibold tabular-nums">
                        {formatQuantity(b.quantity)} {unit}
                      </span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        of {formatQuantity(b.received)}
                      </span>
                    </span>
                    <BatchStatusBadge status={b.status} />
                  </button>
                  <Button asChild variant="ghost" size="icon" className="size-7 shrink-0">
                    <Link to={`/inventory/batches/${b.id}`} aria-label={`Open batch ${b.batchNo}`}>
                      <ArrowUpRight />
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Panel>
  );
}

export function StockLedgerPage() {
  const { productId = '' } = useParams();
  const serials = useSerialSummary(productId);
  const [registering, setRegistering] = useState(false);
  const unlabelled = (serials.data?.unlabelled ?? []).reduce((sum, u) => sum + Number(u.qty), 0);
  const tracked = serials.data?.trackSerials ?? false;
  const [params] = useSearchParams();
  const [range, setRange] = useState<{ from?: string; to?: string }>(() => ({
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  }));
  const product = productsApi.useDetail(productId);
  const ledger = useProductLedger(productId, range);
  const unit = product.data?.unit ?? '';
  const data = ledger.data;
  const batches = useBatches({ productId, pageSize: 100 }, Boolean(productId));
  const [batchNo, setBatchNo] = useState<string | null>(null);
  const movements = batchNo ? data?.movements.filter((m) => m.batchNo === batchNo) : data?.movements;
  const showLabels = tracked || unlabelled > 0;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
        <Link to="/stock">
          <ArrowLeft />
          Stock
        </Link>
      </Button>
      <PageHeader
        title={product.data?.name ?? 'Stock history'}
        description="Every movement of this product, oldest first: where it came from, where it went, the batch and the running balance."
        actions={
          <>
            <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
            <PrintButton />
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total in" value={data ? `${formatQuantity(data.totalIn)} ${unit}` : '…'} />
        <StatCard label="Total out" value={data ? `${formatQuantity(data.totalOut)} ${unit}` : '…'} />
        <StatCard label="Closing" value={data ? `${formatQuantity(data.closing)} ${unit}` : '…'} />
      </div>
      <div className={cn('mb-6 grid items-start gap-6', showLabels && 'lg:grid-cols-2')}>
        {showLabels ? (
          <Panel
            title="Labels"
            description={
              tracked
                ? 'Every piece of this product carries a DSM label. Sales, stock out and returns scan it.'
                : 'This product is not labelled yet.'
            }
            actions={
              <div className="flex flex-wrap gap-2">
                {tracked ? (
                  <>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/inventory/labels?productId=${productId}`}>
                        <Tags />
                        View labels
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/print/labels?productId=${productId}`}>
                        <Printer />
                        Print in-stock labels
                      </Link>
                    </Button>
                  </>
                ) : null}
                {unlabelled > 0 ? (
                  <Button size="sm" onClick={() => setRegistering(true)}>
                    <Tags />
                    Register labels
                  </Button>
                ) : null}
              </div>
            }
          >
            <div className="flex flex-wrap gap-2">
              {(Object.entries(serials.data?.byStatus ?? {}) as [ItemStatus, number][]).map(
                ([status, count]) => (
                  <StatusBadge key={status} tone={ITEM_STATUS[status].tone}>
                    {ITEM_STATUS[status].label}: {count}
                  </StatusBadge>
                ),
              )}
            </div>
            {tracked && unlabelled > 0 ? (
              <p className="mt-3 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
                {formatQuantity(unlabelled)} {unit} in stock have no label yet and cannot be sold until their
                labels are registered.
              </p>
            ) : null}
          </Panel>
        ) : null}
        <BatchesPanel
          batches={batches.data?.data ?? []}
          loading={batches.isLoading}
          unit={unit}
          selected={batchNo}
          onSelect={setBatchNo}
        />
      </div>
      {registering ? (
        <RegisterLabelsDialog productId={productId} onClose={() => setRegistering(false)} />
      ) : null}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Movements and batches</h2>
        {batchNo ? (
          <Button variant="secondary" size="sm" className="h-7" onClick={() => setBatchNo(null)}>
            <Layers />
            Batch {batchNo}
            <X />
          </Button>
        ) : null}
      </div>
      <DataTable
        columns={columns}
        data={movements}
        isLoading={ledger.isLoading}
        isFetching={ledger.isFetching}
        error={ledger.error}
        onRetry={() => void ledger.refetch()}
        exportFileName={`stock-history-${product.data?.name ?? productId}`}
        actions={
          <>
            <PrintDocumentsButton
              label="Print stock in"
              path="/print/stock-in"
              ids={documentIds(data?.movements, 'stock_in')}
            />
            <PrintDocumentsButton
              label="Print stock out"
              path="/print/stock-out"
              ids={documentIds(data?.movements, 'stock_out')}
            />
          </>
        }
        emptyTitle="No movements"
        emptyDescription="Nothing moved in this period."
      />
    </>
  );
}
