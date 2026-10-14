import type { ColumnDef } from '@tanstack/react-table';
import { endOfMonth, startOfMonth } from 'date-fns';
import { History } from 'lucide-react';
import { useState } from 'react';
import { DataTable } from '@/components/shared/data-table';
import { DateRangeFilter, FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { PrintButton } from '@/components/shared/print-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { categoriesApi, productsApi, suppliersApi } from '@/features/catalog/api';
import { useBranchOptions, useInWarehouse } from '@/lib/auth/branches';
import { useListState } from '@/hooks/use-list-state';
import { formatDate, formatQuantity, isoDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Link, useNavigate } from 'react-router';
import { useInventoryReport, type InventoryReport } from './api';

type ReportRow = InventoryReport['rows'][number] & { isTotal?: boolean };
type QuantityKey = keyof InventoryReport['totals'];
type BranchPart = 'sent' | 'sold' | 'booked' | 'returned' | 'inBranch';

const QUANTITY_COLUMNS: { key: QuantityKey; label: string }[] = [
  { key: 'stockIn', label: 'Stock in' },
  { key: 'stockOut', label: 'Stock out' },
  { key: 'sold', label: 'Sold' },
  { key: 'booked', label: 'Booked (not dispatched)' },
  { key: 'returned', label: 'Returned' },
  { key: 'closing', label: 'Total stock' },
];

const SUPER_ADMIN_COLUMNS: { key: QuantityKey; label: string }[] = [
  { key: 'stockIn', label: 'Stock in' },
  { key: 'stockOut', label: 'Sent to branches' },
  { key: 'branchSold', label: 'Sold in branches' },
  { key: 'booked', label: 'Booked (not dispatched)' },
  { key: 'branchReturned', label: 'Returned in branches' },
  { key: 'inBranch', label: 'Now in branches' },
  { key: 'closing', label: 'Super Admin stock' },
  { key: 'total', label: 'Total' },
];

const BRANCH_COLUMNS: { key: QuantityKey; label: string }[] = [
  { key: 'stockOut', label: 'Stock out' },
  { key: 'branchSold', label: 'Sale qty' },
  { key: 'booked', label: 'Booked (not dispatched)' },
  { key: 'branchReturned', label: 'Returned' },
  { key: 'inBranch', label: 'In branch (offices qty)' },
];

const OUTGOING = new Set<QuantityKey>(['stockOut', 'sold', 'branchSold']);

function signedValue(outgoing: boolean, value: string | number) {
  const n = Number(value) || 0;
  return outgoing && n !== 0 ? -Math.abs(n) : n;
}

function SignedQuantity({
  value,
  outgoing,
  className,
}: {
  value: string | number;
  outgoing: boolean;
  className?: string;
}) {
  const n = signedValue(outgoing, value);
  return (
    <span className={cn('tabular-nums', n < 0 && 'text-destructive', className)}>
      {n < 0 ? `−${formatQuantity(String(-n))}` : formatQuantity(String(n))}
    </span>
  );
}

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
          onClick={(e) => e.stopPropagation()}
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
    meta: {
      align: 'right',
      exportValue: (r: unknown) => signedValue(OUTGOING.has(key), (r as ReportRow)[key]),
    },
    cell: ({ row }) => (
      <SignedQuantity
        value={row.original[key]}
        outgoing={OUTGOING.has(key)}
        className={cn((key === 'closing' || key === 'inBranch') && 'font-semibold')}
      />
    ),
  })),
];

function BranchSplitSheet({
  row,
  onClose,
  onHistory,
}: {
  row: ReportRow | null;
  onClose: () => void;
  onHistory: () => void;
}) {
  const branches = (row?.branches ?? []).filter(
    (b) => Number(b.sent) || Number(b.sold) || Number(b.returned) || Number(b.inBranch),
  );
  const sum = (part: BranchPart) => branches.reduce((total, b) => total + (Number(b[part]) || 0), 0);
  const parts: { part: BranchPart; label: string; outgoing: boolean }[] = [
    { part: 'sent', label: 'Sent', outgoing: false },
    { part: 'sold', label: 'Sold', outgoing: true },
    { part: 'booked', label: 'Booked', outgoing: false },
    { part: 'returned', label: 'Returned', outgoing: false },
    { part: 'inBranch', label: 'Now in branch', outgoing: false },
  ];
  return (
    <Sheet open={Boolean(row)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {row ? (
          <>
            <SheetHeader>
              <SheetTitle>{row.name}</SheetTitle>
              <SheetDescription>
                Which branch got this product, what each one sold and got back, and what it holds now. Stock
                that goes out shows with a minus.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-6">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                {(
                  [
                    ['Stock in', 'stockIn'],
                    ['Sent to branches', 'stockOut'],
                    ['Super Admin stock', 'closing'],
                    ['Total (branches + Super Admin)', 'total'],
                  ] as const
                ).map(([label, key]) => (
                  <div key={key} className="rounded-lg border bg-muted/30 px-3 py-2">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <SignedQuantity value={row[key]} outgoing={OUTGOING.has(key)} className="font-semibold" />
                  </div>
                ))}
              </div>
              {branches.length ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Branch</th>
                        {parts.map((p) => (
                          <th key={p.part} className="px-3 py-2 text-right font-medium">
                            {p.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {branches.map((b) => (
                        <tr key={b.branchId}>
                          <td className="px-3 py-2 font-medium">{b.branchName}</td>
                          {parts.map((p) => (
                            <td key={p.part} className="px-3 py-2 text-right">
                              <SignedQuantity
                                value={b[p.part]}
                                outgoing={p.outgoing}
                                className={cn(p.part === 'inBranch' && 'font-semibold')}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t bg-muted/40 font-semibold">
                      <tr>
                        <td className="px-3 py-2">Total</td>
                        {parts.map((p) => (
                          <td key={p.part} className="px-3 py-2 text-right">
                            <SignedQuantity value={sum(p.part)} outgoing={p.outgoing} />
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="rounded-lg border px-3 py-6 text-center text-sm text-muted-foreground">
                  No branch got this product in this period.
                </p>
              )}
              <Button variant="outline" onClick={onHistory}>
                <History />
                Full history
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function InventoryReportPage() {
  const navigate = useNavigate();
  const list = useListState();
  const [split, setSplit] = useState<ReportRow | null>(null);
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
  const perBranch = Boolean(report.data?.perBranch);
  const columns = columnsFor(
    targetBranch ? BRANCH_COLUMNS : perBranch ? SUPER_ADMIN_COLUMNS : QUANTITY_COLUMNS,
    {
      from,
      to,
    },
  );
  const month = list.filters.from?.slice(0, 7) ?? isoDate(today).slice(0, 7);
  const history = (productId: string) => void navigate(`/stock/${productId}?from=${from}&to=${to}`);

  const rows: ReportRow[] = report.data?.rows.length
    ? [
        ...report.data.rows,
        {
          productId: 'total',
          name: 'Total',
          categoryName: null,
          ...report.data.totals,
          branches: [],
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
            ? `Stock sent to ${targetBranch.name}, sold there and left there, ${formatDate(from)} to ${formatDate(to)}. Stock that goes out shows with a minus.`
            : perBranch
              ? `What came in, what went to the branches, what they sold and got back, and what they hold now, ${formatDate(from)} to ${formatDate(to)}. Stock that goes out shows with a minus. Click a row to see each branch.`
              : `Stock in, stock out, sales and total stock from ${formatDate(from)} to ${formatDate(to)}. Stock that goes out shows with a minus. Click a product for its full history.`
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
        onRowClick={(r) => {
          if (r.isTotal) return;
          if (perBranch && !targetBranch) setSplit(r);
          else history(r.productId);
        }}
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
                  .filter((b) => b.kind === 'branch' || b.kind === 'dispatch')
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
      <BranchSplitSheet
        row={split}
        onClose={() => setSplit(null)}
        onHistory={() => split && history(split.productId)}
      />
    </>
  );
}
