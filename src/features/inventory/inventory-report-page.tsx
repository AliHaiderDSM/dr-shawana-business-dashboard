import type { ColumnDef } from '@tanstack/react-table';
import { endOfMonth, startOfMonth } from 'date-fns';
import { DataTable } from '@/components/shared/data-table';
import { DateRangeFilter, FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { categoriesApi, productsApi } from '@/features/catalog/api';
import { useListState } from '@/hooks/use-list-state';
import { formatDate, formatQuantity, isoDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useInventoryReport, type InventoryReport } from './api';

type ReportRow = InventoryReport['rows'][number] & { isTotal?: boolean };

const QUANTITY_COLUMNS: { key: keyof InventoryReport['totals']; label: string }[] = [
  { key: 'opening', label: 'Opening' },
  { key: 'purchased', label: 'Purchased' },
  { key: 'stockIn', label: 'Stock in' },
  { key: 'manufactured', label: 'Manufactured' },
  { key: 'stockOut', label: 'Stock out' },
  { key: 'sold', label: 'Sold' },
  { key: 'returned', label: 'Returned' },
  { key: 'adjusted', label: 'Adjusted' },
  { key: 'closing', label: 'Closing' },
];

const columns: ColumnDef<ReportRow, unknown>[] = [
  {
    id: 'name',
    header: 'Product',
    accessorKey: 'name',
    meta: { hideable: false },
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    id: 'category',
    header: 'Category',
    accessorFn: (r) => r.categoryName ?? '',
    cell: ({ row }) => (row.original.isTotal ? '' : (row.original.categoryName ?? '—')),
  },
  ...QUANTITY_COLUMNS.map<ColumnDef<ReportRow, unknown>>(({ key, label }) => ({
    id: key,
    header: label,
    accessorKey: key,
    meta: { align: 'right' },
    cell: ({ row }) => (
      <span className={cn(key === 'closing' && 'font-semibold')}>{formatQuantity(row.original[key])}</span>
    ),
  })),
];

export function InventoryReportPage() {
  const list = useListState();
  const today = new Date();
  const from = list.filters.from ?? isoDate(startOfMonth(today));
  const to = list.filters.to ?? isoDate(endOfMonth(today));
  const report = useInventoryReport({
    from,
    to,
    categoryId: list.filters.categoryId,
    productId: list.filters.productId,
  });
  const categories = categoriesApi.useOptions();
  const products = productsApi.useOptions();

  const rows: ReportRow[] = report.data?.rows.length
    ? [
        ...report.data.rows,
        {
          productId: 'total',
          name: 'Total',
          categoryName: null,
          ...report.data.totals,
          isTotal: true,
        },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Inventory report"
        description={`Opening, movements and closing stock from ${formatDate(from)} to ${formatDate(to)}.`}
      />
      <DataTable
        columns={columns}
        data={report.data ? rows : undefined}
        isLoading={report.isLoading}
        isFetching={report.isFetching}
        error={report.error}
        onRetry={() => void report.refetch()}
        getRowId={(r) => r.productId}
        rowClassName={(r) => (r.isTotal ? 'bg-muted/50 font-semibold hover:bg-muted/50' : undefined)}
        exportFileName={`inventory-report-${from}-to-${to}`}
        emptyTitle="No stock in this period"
        toolbar={
          <>
            <DateRangeFilter list={list} placeholder="This month" />
            <FilterSelect
              list={list}
              name="categoryId"
              allLabel="All categories"
              className="w-44"
              options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
            <FilterSelect
              list={list}
              name="productId"
              allLabel="All products"
              className="w-48"
              options={(products.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
          </>
        }
      />
    </>
  );
}
