import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { DateRangeFilter, FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { useListState } from '@/hooks/use-list-state';
import { formatDate, formatQuantity } from '@/lib/format';
import { materialsApi, useFinishedGoods, useMaterialReport, type MaterialReportQuery } from './api';

type MaterialReportRow = NonNullable<ReturnType<typeof useMaterialReport>['data']>[number];
type FinishedGoodRow = NonNullable<ReturnType<typeof useFinishedGoods>['data']>[number];

const ALERT_BADGES = {
  ok: <StatusBadge tone="success">OK</StatusBadge>,
  minimum: <StatusBadge tone="warning">Minimum</StatusBadge>,
  bare_minimum: <StatusBadge tone="danger">Bare minimum</StatusBadge>,
};

const materialColumns: ColumnDef<MaterialReportRow, unknown>[] = [
  {
    id: 'name',
    header: 'Material',
    accessorKey: 'name',
    meta: { hideable: false },
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    id: 'category',
    header: 'Category',
    accessorFn: (r) => r.categoryName ?? '',
    cell: ({ row }) => row.original.categoryName ?? '—',
  },
  { id: 'unit', header: 'Unit', accessorKey: 'unit' },
  ...(['opening', 'in', 'out', 'closing'] as const).map<ColumnDef<MaterialReportRow, unknown>>((key) => ({
    id: key,
    header: key[0]?.toUpperCase() + key.slice(1),
    accessorKey: key,
    meta: { align: 'right' },
    cell: ({ row }) => (
      <span className={key === 'closing' ? 'font-semibold' : undefined}>
        {formatQuantity(row.original[key])}
      </span>
    ),
  })),
  {
    id: 'minimum',
    header: 'Minimum',
    accessorKey: 'minimum',
    meta: { align: 'right' },
    cell: ({ row }) => formatQuantity(row.original.minimum),
  },
  {
    id: 'bareMinimum',
    header: 'Bare minimum',
    accessorKey: 'bareMinimum',
    meta: { align: 'right' },
    cell: ({ row }) => formatQuantity(row.original.bareMinimum),
  },
  {
    id: 'alert',
    header: 'Status',
    accessorFn: (r) => r.alert ?? '',
    cell: ({ row }) => (row.original.alert ? ALERT_BADGES[row.original.alert] : '—'),
  },
];

export function MaterialReportPage() {
  const list = useListState();
  const materials = materialsApi.useOptions();
  const query: MaterialReportQuery = {
    from: list.filters.from,
    to: list.filters.to,
    materialId: list.filters.materialId,
    location: list.filters.location as MaterialReportQuery['location'],
    level: list.filters.level as MaterialReportQuery['level'],
  };
  const report = useMaterialReport(query);

  return (
    <>
      <PageHeader
        title="Material report"
        description="Material in, out and closing quantity per location, with minimum alerts."
      />
      <DataTable
        columns={materialColumns}
        data={report.data}
        isLoading={report.isLoading}
        isFetching={report.isFetching}
        error={report.error}
        onRetry={() => void report.refetch()}
        getRowId={(r) => r.materialId}
        exportFileName="material-report"
        emptyTitle="No materials match"
        toolbar={
          <>
            <DateRangeFilter list={list} />
            <FilterSelect
              list={list}
              name="materialId"
              allLabel="All materials"
              className="w-48"
              options={(materials.data ?? []).map((m) => ({ value: m.id, label: m.name }))}
            />
            <FilterSelect
              list={list}
              name="location"
              allLabel="Store and lab"
              options={[
                { value: 'store', label: 'Store' },
                { value: 'lab', label: 'Pharmacy lab' },
              ]}
            />
            <FilterSelect
              list={list}
              name="level"
              allLabel="All levels"
              options={[
                { value: 'minimum', label: 'At minimum' },
                { value: 'bare_minimum', label: 'At bare minimum' },
              ]}
            />
          </>
        }
      />
    </>
  );
}

const finishedColumns: ColumnDef<FinishedGoodRow, unknown>[] = [
  {
    id: 'batchNo',
    header: 'Batch no',
    accessorKey: 'batchNo',
    meta: { hideable: false },
    cell: ({ row }) => <span className="font-medium">{row.original.batchNo}</span>,
  },
  { id: 'date', header: 'Date', accessorKey: 'date', cell: ({ row }) => formatDate(row.original.date) },
  {
    id: 'product',
    header: 'Product',
    accessorFn: (r) => r.productName ?? '',
    cell: ({ row }) => row.original.productName ?? '—',
  },
  {
    id: 'materialUsed',
    header: 'Material used',
    accessorKey: 'materialUsed',
    meta: { align: 'right' },
    cell: ({ row }) => formatQuantity(row.original.materialUsed),
  },
  {
    id: 'finishedQty',
    header: 'Finished qty',
    accessorKey: 'finishedQty',
    meta: { align: 'right' },
    cell: ({ row }) => <span className="font-semibold">{formatQuantity(row.original.finishedQty)}</span>,
  },
  {
    id: 'sizeGrams',
    header: 'Size (g)',
    accessorKey: 'sizeGrams',
    meta: { align: 'right' },
    cell: ({ row }) => formatQuantity(row.original.sizeGrams),
  },
  {
    id: 'lossGrams',
    header: 'Loss (g)',
    accessorKey: 'lossGrams',
    meta: { align: 'right' },
    cell: ({ row }) => formatQuantity(row.original.lossGrams),
  },
  {
    id: 'lossPercent',
    header: 'Loss %',
    accessorKey: 'lossPercent',
    meta: { align: 'right' },
    cell: ({ row }) =>
      row.original.lossPercent === null ? '—' : `${formatQuantity(row.original.lossPercent)}%`,
  },
];

export function FinishedGoodsPage() {
  const list = useListState();
  const report = useFinishedGoods({ from: list.filters.from, to: list.filters.to });

  return (
    <>
      <PageHeader
        title="Finished goods"
        description="Production batches with the material used, finished quantity and loss."
      />
      <DataTable
        columns={finishedColumns}
        data={report.data}
        isLoading={report.isLoading}
        isFetching={report.isFetching}
        error={report.error}
        onRetry={() => void report.refetch()}
        getRowId={(r) => r.batchId}
        exportFileName="finished-goods"
        emptyTitle="No finished goods in this period"
        toolbar={<DateRangeFilter list={list} />}
      />
    </>
  );
}
