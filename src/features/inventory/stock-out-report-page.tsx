import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { DataTable } from '@/components/shared/data-table';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TraceNumber } from '@/features/trace/trace-page';
import { ROLE_LABELS } from '@/features/staff/constants';
import type { Role } from '@/lib/api/types';
import { formatDate, formatDateTime, formatQuantity } from '@/lib/format';
import {
  useStockOutReport,
  type StockOutReportStatus,
  type StockOutTransfer,
} from '@redux/features/inventory';

const ALL = 'all';

const roleLabel = (role: string) => ROLE_LABELS[role as Role] ?? role.replace(/_/g, ' ');

function TransferSheet({ transfer, onClose }: { transfer: StockOutTransfer | null; onClose: () => void }) {
  return (
    <Sheet open={transfer !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
        {transfer ? (
          <>
            <SheetHeader className="border-b">
              <SheetTitle>{transfer.transferNo}</SheetTitle>
              <SheetDescription>
                {transfer.from.name} → {transfer.to?.name ?? '—'} · {formatDate(transfer.date)}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-sm">
              <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-2">
                <dt className="text-muted-foreground">Request</dt>
                <dd>{transfer.requestNo ? <TraceNumber number={transfer.requestNo} /> : '—'}</dd>
                <dt className="text-muted-foreground">Sent by</dt>
                <dd>
                  {transfer.sentBy ? `${transfer.sentBy.name} (${roleLabel(transfer.sentBy.role)})` : '—'}
                  <div className="text-xs text-muted-foreground">{formatDateTime(transfer.sentAt)}</div>
                </dd>
                <dt className="text-muted-foreground">Received</dt>
                <dd>
                  {transfer.receivedAt ? (
                    <>
                      {transfer.receivedBy ?? '—'}
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(transfer.receivedAt)}
                      </div>
                    </>
                  ) : (
                    <StatusBadge tone="warning">On the way</StatusBadge>
                  )}
                </dd>
              </dl>
              <section className="space-y-2">
                <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Items ({transfer.products})
                </h4>
                <ul className="divide-y rounded-lg border">
                  {transfer.items.map((item, index) => (
                    <li key={`${item.product}-${index}`} className="space-y-1.5 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{item.product}</span>
                        <span className="tabular-nums">{formatQuantity(item.qty)}</span>
                      </div>
                      {item.serials.length ? (
                        <div className="flex flex-wrap gap-1">
                          {item.serials.map((serial) => (
                            <span
                              key={serial}
                              className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                            >
                              {serial}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">No labels scanned</div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function StockOutReportPage() {
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const [toBranchId, setToBranchId] = useState<string>(ALL);
  const [status, setStatus] = useState<StockOutReportStatus>('all');
  const [open, setOpen] = useState<StockOutTransfer | null>(null);
  const report = useStockOutReport({
    ...range,
    toBranchId: toBranchId === ALL ? undefined : toBranchId,
    status,
  });
  const rows = report.data ?? [];
  const branches = [...new Map(rows.flatMap((t) => (t.to ? [[t.to.id, t.to] as const] : []))).values()].sort(
    (a, b) => a.name.localeCompare(b.name),
  );
  const totalQty = rows.reduce((sum, t) => sum + Number(t.qty), 0);
  const totalSerials = rows.reduce((sum, t) => sum + t.serials, 0);
  const waiting = rows.filter((t) => !t.receivedAt).length;

  const columns: ColumnDef<StockOutTransfer, unknown>[] = [
    {
      id: 'transferNo',
      header: 'Transfer no',
      accessorKey: 'transferNo',
      cell: ({ row }) => (
        <TraceNumber
          number={row.original.transferNo}
          className="font-mono text-xs font-medium text-primary hover:underline"
        />
      ),
    },
    {
      id: 'date',
      header: 'Date',
      accessorFn: (t) => t.date,
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.date)}</span>,
    },
    {
      id: 'to',
      header: 'To',
      accessorFn: (t) => t.to?.name ?? '',
      cell: ({ row }) =>
        row.original.to ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-xs font-semibold text-primary-soft-foreground">
              {row.original.to.code}
            </span>
            {row.original.to.name}
          </span>
        ) : (
          '—'
        ),
    },
    {
      id: 'requestNo',
      header: 'Request no',
      accessorFn: (t) => t.requestNo ?? '',
      cell: ({ row }) =>
        row.original.requestNo ? (
          <span className="font-mono text-xs">{row.original.requestNo}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'items',
      header: 'Products',
      accessorFn: (t) => t.products,
      meta: { align: 'right' },
      cell: ({ row }) => <span className="tabular-nums">{row.original.products}</span>,
    },
    {
      id: 'qty',
      header: 'Quantity',
      accessorFn: (t) => Number(t.qty),
      meta: { align: 'right' },
      cell: ({ row }) => <span className="tabular-nums">{formatQuantity(row.original.qty)}</span>,
    },
    {
      id: 'serials',
      header: 'Labels scanned',
      accessorFn: (t) => t.serials,
      meta: { align: 'right' },
      cell: ({ row }) => <span className="tabular-nums">{row.original.serials}</span>,
    },
    {
      id: 'sentBy',
      header: 'Sent by',
      accessorFn: (t) => t.sentBy?.name ?? '',
      cell: ({ row }) =>
        row.original.sentBy ? (
          <div className="min-w-0">
            <div className="font-medium whitespace-nowrap">{row.original.sentBy.name}</div>
            <div className="text-xs text-muted-foreground">{roleLabel(row.original.sentBy.role)}</div>
          </div>
        ) : (
          '—'
        ),
    },
    {
      id: 'status',
      header: 'Received',
      accessorFn: (t) => (t.receivedAt ? `Received by ${t.receivedBy ?? ''}` : 'On the way'),
      cell: ({ row }) =>
        row.original.receivedAt ? (
          <div className="space-y-1">
            <StatusBadge tone="success">Received</StatusBadge>
            <div className="text-xs whitespace-nowrap text-muted-foreground">
              {row.original.receivedBy ?? '—'} · {formatDateTime(row.original.receivedAt)}
            </div>
          </div>
        ) : (
          <StatusBadge tone="warning">On the way</StatusBadge>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Out Report"
        description="Every transfer sent from stock: where it went, against which request, the labels scanned, who sent it and who received it. Open a row for the items and labels."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Transfers" value={String(rows.length)} />
        <StatCard label="Quantity sent" value={formatQuantity(String(totalQty))} />
        <StatCard label="Labels scanned" value={String(totalSerials)} />
        <StatCard label="On the way" value={String(waiting)} />
      </div>
      <DataTable
        columns={columns}
        data={report.data}
        isLoading={report.isLoading}
        isFetching={report.isFetching}
        error={report.error}
        onRetry={() => void report.refetch()}
        getRowId={(t) => t.transferNo}
        onRowClick={setOpen}
        exportFileName="stock-out-report"
        searchPlaceholder="Search transfer, request, branch or person…"
        emptyTitle="No transfers"
        emptyDescription="Stock sent against approved requests shows here."
        toolbar={
          <>
            <Tabs value={status} onValueChange={(v) => setStatus(v as StockOutReportStatus)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="on_the_way">On the way</TabsTrigger>
                <TabsTrigger value="received">Received</TabsTrigger>
              </TabsList>
            </Tabs>
            <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
            <Select value={toBranchId} onValueChange={setToBranchId}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
      <TransferSheet transfer={open} onClose={() => setOpen(null)} />
    </div>
  );
}
