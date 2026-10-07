import { useInWarehouse } from '@/lib/auth/branches';
import { ExpiryAlertsPanel } from './expiry-alerts';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowDownToLine, ArrowUpFromLine, History } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { DataTable } from '@/components/shared/data-table';
import { FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { PrintButton } from '@/components/shared/print-button';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { categoriesApi } from '@/features/catalog/api';
import { useListState } from '@/hooks/use-list-state';
import { useAuth } from '@/lib/auth/auth-context';
import { formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useStockBalances, type StockBalance } from './api';

export function StockPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const list = useListState();
  const query = useStockBalances(list.query);
  const categories = categoriesApi.useOptions();
  const lowOnly = list.filters.lowStockOnly === 'true';
  const inWarehouse = useInWarehouse();

  function stockStatus(row: { quantity: string; isLowStock: boolean }) {
    if (Number(row.quantity) <= 0) return { label: 'Out of stock', tone: 'danger' as const };
    if (row.isLowStock) return { label: 'Low stock', tone: 'warning' as const };
    return { label: 'In stock', tone: 'success' as const };
  }

  const columns: ColumnDef<StockBalance, unknown>[] = [
    {
      id: 'name',
      header: 'Product',
      accessorKey: 'name',
      meta: { hideable: false },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-medium">{row.original.name}</div>
          {row.original.batchNo ? (
            <div className="text-xs text-muted-foreground">Batch {row.original.batchNo}</div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      accessorFn: (r) => r.categoryName ?? '',
      cell: ({ row }) => row.original.categoryName ?? '—',
    },
    {
      id: 'quantity',
      header: 'In stock',
      accessorKey: 'quantity',
      meta: { align: 'right' },
      cell: ({ row }) => (
        <span
          className={cn(
            'font-semibold',
            Number(row.original.quantity) <= 0
              ? 'text-destructive'
              : row.original.isLowStock && 'text-warning-soft-foreground',
          )}
        >
          {formatQuantity(row.original.quantity)}{' '}
          <span className="font-normal text-muted-foreground">{row.original.unit}</span>
          {Number(row.original.expiredQuantity) > 0 ? (
            <span className="block text-xs font-normal text-destructive">
              {formatQuantity(row.original.expiredQuantity)} expired
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'reserved',
      header: 'Booked',
      accessorKey: 'reservedQuantity',
      meta: { align: 'right' },
      cell: ({ row }) =>
        Number(row.original.reservedQuantity) > 0 ? (
          <span className="text-info" title="Booked by online orders waiting for dispatch">
            {formatQuantity(row.original.reservedQuantity)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'available',
      header: 'Available',
      accessorFn: (r) => Number(r.quantity) - Number(r.expiredQuantity) - Number(r.reservedQuantity),
      meta: { align: 'right' },
      cell: ({ row }) => (
        <span className="font-medium">
          {formatQuantity(
            Math.max(
              0,
              Number(row.original.quantity) -
                Number(row.original.expiredQuantity) -
                Number(row.original.reservedQuantity),
            ),
          )}
        </span>
      ),
    },
    {
      id: 'threshold',
      header: 'Low stock at',
      accessorKey: 'lowStockThreshold',
      meta: { align: 'right' },
      cell: ({ row }) => formatQuantity(row.original.lowStockThreshold),
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (r) => stockStatus(r).label,
      cell: ({ row }) => {
        const status = stockStatus(row.original);
        return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
      },
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right', hideable: false },
      cell: ({ row }) => (
        <Button asChild variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
          <Link to={`/stock/${row.original.productId}`}>
            <History />
            History
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Stock"
        description="Current balance of every product, from the stock ledger."
        actions={
          can('stock.view') ? (
            <>
              <Button asChild variant="outline">
                <Link to="/stock-in">
                  <ArrowDownToLine />
                  Stock in
                </Link>
              </Button>
              {inWarehouse ? (
                <Button asChild variant="outline">
                  <Link to="/stock-out">
                    <ArrowUpFromLine />
                    Stock out
                  </Link>
                </Button>
              ) : null}
              <PrintButton />
            </>
          ) : (
            <PrintButton />
          )
        }
      />
      <ExpiryAlertsPanel className="mb-6" />
      <DataTable
        columns={columns}
        data={query.data?.data}
        meta={query.data?.meta}
        list={list}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        searchPlaceholder="Search products"
        exportFileName="stock"
        getRowId={(r) => r.productId}
        onRowClick={(r) => void navigate(`/stock/${r.productId}`)}
        emptyTitle={lowOnly ? 'Nothing is low on stock' : 'No products yet'}
        emptyDescription="Products appear here once they are added to the catalog."
        toolbar={
          <>
            <FilterSelect
              list={list}
              name="categoryId"
              allLabel="All categories"
              className="w-44"
              options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
            <label className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm shadow-xs">
              <Switch
                checked={lowOnly}
                onCheckedChange={(checked) => list.setFilter('lowStockOnly', checked ? 'true' : undefined)}
                aria-label="Low stock only"
              />
              Low stock only
            </label>
          </>
        }
      />
    </>
  );
}
