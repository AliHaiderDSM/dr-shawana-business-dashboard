import type { ColumnDef } from '@tanstack/react-table';
import { endOfMonth, startOfMonth } from 'date-fns';
import { DataTable } from '@/components/shared/data-table';
import { DateRangeFilter, FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { PrintButton } from '@/components/shared/print-button';
import { Input } from '@/components/ui/input';
import { categoriesApi, productsApi, suppliersApi } from '@/features/catalog/api';
import { useBranchOptions, useInWarehouse } from '@/lib/auth/branches';
import { useListState } from '@/hooks/use-list-state';
import { formatDate, formatQuantity, isoDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Link } from 'react-router';
import { useInventoryReport, type InventoryReport } from './api';

type ReportRow = InventoryReport['rows'][number] & { isTotal?: boolean };

const QUANTITY_COLUMNS: { key: keyof InventoryReport['totals']; label: string }[] = [
  { key: 'purchased', label: 'Purchased' },
  { key: 'stockIn', label: 'Stock in' },
  { key: 'stockOut', label: 'Stock out' },
  { key: 'sold', label: 'Sold' },
  { key: 'returned', label: 'Returned' },
  { key: 'closing', label: 'Total stock' },
];

const BRANCH_COLUMNS: { key: keyof InventoryReport['totals']; label: string }[] = [
  { key: 'stockOut', label: 'Stock out' },
  { key: 'branchSold', label: 'Sale qty' },
  { key: 'inBranch', label: 'In branch (offices qty)' },
];

const columnsFor = (
  quantities: typeof QUANTITY_COLUMNS,
  range: { from: string; to: string },
): ColumnDef<ReportRow, unknown>[] => [
  {
    id: 'name',
    header: 'Product',
    accessorKey: 'name',
    meta: { hideable: false },
    cell: ({ row }) =>
      row.original.isTotal ? (
        <span className="font-medium">{row.original.name}</span>
      ) : (
        <Link
          to={`/stock/${row.original.productId}?from=${range.from}&to=${range.to}`}
          className="font-medium text-primary hover:underline"
          title="Full history of this product"
        >
          {row.original.name}
        </Link>
      ),
  },
  {
    id: 'category',
    header: 'Category',
    accessorFn: (r) => r.categoryName ?? '',
    cell: ({ row }) => (row.original.isTotal ? '' : (row.original.categoryName ?? '—')),
  },
  ...quantities.map<ColumnDef<ReportRow, unknown>>(({ key, label }) => ({
    id: key,
    header: label,
    accessorKey: key,
    meta: { align: 'right' },
    cell: ({ row }) => (
      <span className={cn((key === 'closing' || key === 'inBranch') && 'font-semibold')}>
        {formatQuantity(row.original[key])}
      </span>
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
    supplierId: list.filters.supplierId,
    dispatcherId: list.filters.dispatcherId,
    toBranchId: list.filters.toBranchId,
  });
  const categories = categoriesApi.useOptions();
  const products = productsApi.useOptions();
  const suppliers = suppliersApi.useOptions({ type: 'supplier' });
  const dispatchers = suppliersApi.useOptions({ type: 'dispatcher' });
  const inWarehouse = useInWarehouse();
  const branches = useBranchOptions(inWarehouse);
  const targetBranch = (branches.data ?? []).find((b) => b.id === list.filters.toBranchId);
  const columns = columnsFor(targetBranch ? BRANCH_COLUMNS : QUANTITY_COLUMNS, { from, to });
  const month = list.filters.from?.slice(0, 7) ?? isoDate(today).slice(0, 7);

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
        description={
          targetBranch
            ? `Stock sent to ${targetBranch.name}, sold there and left there, ${formatDate(from)} to ${formatDate(to)}.`
            : `Stock in, stock out, sales and total stock from ${formatDate(from)} to ${formatDate(to)}. Click a product for its full history.`
        }
        actions={<PrintButton />}
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
            <Input
              type="month"
              aria-label="Month"
              className="h-9 w-40"
              value={month}
              onChange={(e) => {
                if (!e.target.value) return;
                const first = new Date(`${e.target.value}-01T00:00:00`);
                list.setFilters({ from: isoDate(startOfMonth(first)), to: isoDate(endOfMonth(first)) });
              }}
            />
            <DateRangeFilter list={list} placeholder="This month" />
            {inWarehouse ? (
              <FilterSelect
                list={list}
                name="toBranchId"
                allLabel="Stock to: any"
                className="w-44"
                options={(branches.data ?? [])
                  .filter((b) => b.kind === 'branch')
                  .map((b) => ({ value: b.id, label: b.name }))}
              />
            ) : null}
            <FilterSelect
              list={list}
              name="supplierId"
              allLabel="All suppliers"
              className="w-44"
              options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            />
            <FilterSelect
              list={list}
              name="dispatcherId"
              allLabel="All dispatchers"
              className="w-44"
              options={(dispatchers.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            />
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
