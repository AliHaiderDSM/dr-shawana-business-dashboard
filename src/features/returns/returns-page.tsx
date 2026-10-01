import type { ColumnDef } from '@tanstack/react-table';
import { Eye, PackageOpen, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { DataTable } from '@/components/shared/data-table';
import { DateRangeFilter, enumOptions, FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { useListState } from '@/hooks/use-list-state';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatMoney, formatQuantity } from '@/lib/format';
import { DISPOSITION_LABELS, REASON_LABELS, useReturns, type SaleReturn } from './api';
import { ReturnFormSheet } from './return-form-sheet';

export function ReturnStatusBadge({ record }: { record: Pick<SaleReturn, 'status' | 'items'> }) {
  if (record.status === 'completed') return <StatusBadge tone="success">Inspected</StatusBadge>;
  const waiting = record.items.filter((i) => i.disposition === 'pending').length;
  return <StatusBadge tone="warning">{`${waiting} awaiting inspection`}</StatusBadge>;
}

export function ReturnsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const list = useListState({ defaultSort: '-date' });
  const query = useReturns(list.query);
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(params.get('new') === '1');
  const presetSale = params.get('saleId');
  const presetLabel = params.get('saleLabel');

  const closeSheet = (open: boolean) => {
    setCreating(open);
    if (!open && params.has('new')) {
      for (const key of ['new', 'saleId', 'saleLabel']) params.delete(key);
      setParams(params, { replace: true });
    }
  };

  const columns: ColumnDef<SaleReturn, unknown>[] = [
    {
      id: 'returnNo',
      header: 'Return no',
      accessorKey: 'returnNo',
      meta: { sortKey: 'returnSeq', hideable: false },
      cell: ({ row }) => <span className="font-medium">{row.original.returnNo}</span>,
    },
    {
      id: 'date',
      header: 'Received',
      accessorKey: 'date',
      meta: { sortKey: 'date' },
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      id: 'sale',
      header: 'Sale',
      accessorFn: (r) => `${r.sale?.invoiceNo ?? ''} ${r.sale?.patient?.name ?? ''}`,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.sale?.invoiceNo}</div>
          <div className="text-xs text-muted-foreground">{row.original.sale?.patient?.name}</div>
        </div>
      ),
    },
    {
      id: 'reason',
      header: 'Reason',
      accessorFn: (r) => REASON_LABELS[r.reason],
      cell: ({ row }) => (
        <StatusBadge tone={row.original.reason === 'damaged' ? 'danger' : 'neutral'} dot={false}>
          {REASON_LABELS[row.original.reason]}
        </StatusBadge>
      ),
    },
    {
      id: 'items',
      header: 'Products',
      accessorFn: (r) => r.items.map((i) => `${i.product?.name ?? ''} ${i.qty}`).join('; '),
      cell: ({ row }) => (
        <span className="line-clamp-1 max-w-72 text-muted-foreground">
          {row.original.items.map((i) => `${i.product?.name ?? ''} × ${formatQuantity(i.qty)}`).join(', ')}
        </span>
      ),
    },
    {
      id: 'totalQty',
      header: 'Qty',
      accessorKey: 'totalQty',
      meta: { align: 'right' },
      cell: ({ row }) => formatQuantity(row.original.totalQty),
    },
    {
      id: 'refund',
      header: 'Refund',
      accessorKey: 'refundAmount',
      meta: { align: 'right' },
      cell: ({ row }) =>
        Number(row.original.refundAmount) > 0 ? (
          formatMoney(row.original.refundAmount)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <ReturnStatusBadge record={row.original} />,
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right', hideable: false },
      cell: ({ row }) => (
        <RowActions
          actions={[
            { label: 'Open', icon: Eye, onSelect: () => void navigate(`/returns/${row.original.id}`) },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Returns"
        description="Products that came back. Inspect each item: back into stock, damaged, or sent to the supplier."
        actions={
          can('returns.create') ? (
            <Button onClick={() => setCreating(true)}>
              <Undo2 />
              Receive return
            </Button>
          ) : null
        }
      />
      <DataTable
        columns={columns}
        data={query.data?.data}
        meta={query.data?.meta}
        list={list}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        searchPlaceholder="Return no, invoice or patient"
        exportFileName="returns"
        onRowClick={(r) => void navigate(`/returns/${r.id}`)}
        emptyTitle="No returns"
        emptyDescription="Returned deliveries and counter returns appear here."
        emptyAction={
          can('returns.create') ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <PackageOpen />
              Receive return
            </Button>
          ) : null
        }
        toolbar={
          <>
            <FilterSelect
              list={list}
              name="status"
              allLabel="All statuses"
              className="w-48"
              options={[
                { value: 'pending', label: 'Awaiting inspection' },
                { value: 'completed', label: 'Inspected' },
              ]}
            />
            <FilterSelect
              list={list}
              name="disposition"
              allLabel="Any outcome"
              className="w-44"
              options={enumOptions(['restocked', 'damaged', 'supplier'] as const, DISPOSITION_LABELS)}
            />
            <FilterSelect
              list={list}
              name="reason"
              allLabel="All reasons"
              options={enumOptions(
                Object.keys(REASON_LABELS) as (keyof typeof REASON_LABELS)[],
                REASON_LABELS,
              )}
            />
            <DateRangeFilter list={list} />
          </>
        }
      />
      <ReturnFormSheet
        key={presetSale ?? 'blank'}
        open={creating}
        onOpenChange={closeSheet}
        initialSale={presetSale ? { id: presetSale, label: presetLabel ?? '' } : undefined}
      />
    </>
  );
}
