import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Printer, Tags } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { DataTable } from '@/components/shared/data-table';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { PageHeader } from '@/components/shared/page-header';
import { Panel } from '@/components/shared/panel';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge, type Tone } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { productsApi } from '@/features/catalog/api';
import { formatDate, formatQuantity, titleCase } from '@/lib/format';
import { useBatches, useProductLedger, useSerialSummary, type ItemStatus, type ProductLedger } from './api';
import { ITEM_STATUS, RegisterLabelsDialog } from './labels-page';
import { batchColumns } from './batches-page';

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
    id: 'batch',
    header: 'Batch',
    accessorFn: (m) => m.batchNo ?? '',
    cell: ({ row }) =>
      row.original.batchNo ? <span className="font-mono text-xs">{row.original.batchNo}</span> : '—',
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

export function StockLedgerPage() {
  const { productId = '' } = useParams();
  const navigate = useNavigate();
  const batches = useBatches({ productId, pageSize: 100 });
  const serials = useSerialSummary(productId);
  const [registering, setRegistering] = useState(false);
  const unlabelled = (serials.data?.unlabelled ?? []).reduce((sum, u) => sum + Number(u.qty), 0);
  const tracked = serials.data?.trackSerials ?? false;
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const product = productsApi.useDetail(productId);
  const ledger = useProductLedger(productId, range);
  const unit = product.data?.unit ?? '';
  const data = ledger.data;

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
        description="Every movement of this product, oldest first, with the running balance."
        actions={<DateRangePicker from={range.from} to={range.to} onChange={setRange} />}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Opening" value={data ? `${formatQuantity(data.opening)} ${unit}` : '…'} />
        <StatCard label="Total in" value={data ? `${formatQuantity(data.totalIn)} ${unit}` : '…'} />
        <StatCard label="Total out" value={data ? `${formatQuantity(data.totalOut)} ${unit}` : '…'} />
        <StatCard label="Closing" value={data ? `${formatQuantity(data.closing)} ${unit}` : '…'} />
      </div>
      {tracked || unlabelled > 0 ? (
        <Panel
          className="mb-6"
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
      {registering ? (
        <RegisterLabelsDialog productId={productId} onClose={() => setRegistering(false)} />
      ) : null}
      {batches.data?.data.length ? (
        <div className="mb-6 space-y-3">
          <h2 className="text-sm font-semibold">Batches</h2>
          <DataTable
            columns={batchColumns(false)}
            data={batches.data.data}
            isLoading={batches.isLoading}
            onRowClick={(b) => void navigate(`/inventory/batches/${b.id}`)}
            exportFileName={`batches-${product.data?.name ?? productId}`}
            emptyTitle="No batches"
          />
        </div>
      ) : null}
      <h2 className="mb-3 text-sm font-semibold">Movements</h2>
      <DataTable
        columns={columns}
        data={data?.movements}
        isLoading={ledger.isLoading}
        isFetching={ledger.isFetching}
        error={ledger.error}
        onRetry={() => void ledger.refetch()}
        exportFileName={`stock-history-${product.data?.name ?? productId}`}
        emptyTitle="No movements"
        emptyDescription="Nothing moved in this period."
      />
    </>
  );
}
