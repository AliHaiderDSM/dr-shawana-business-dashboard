import type { ColumnDef } from '@tanstack/react-table';
import { Printer } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { PageHeader } from '@/components/shared/page-header';
import { PrintPage } from '@/components/shared/print-document';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { endOfMonth, startOfMonth } from 'date-fns';
import { useAuth } from '@/lib/auth/auth-context';
import { useBranchOptions } from '@/lib/auth/branches';
import { formatDate, formatQuantity, isoDate } from '@/lib/format';
import logo from '@/assets/logo-hd.png';
import { useDeliverySlips, type DeliverySlip, type DeliverySlipsQuery } from './api';

const ALL = '__all__';

const totalQty = (slip: DeliverySlip) => slip.items.reduce((sum, item) => sum + Number(item.qty), 0);

const slipColumns: ColumnDef<DeliverySlip, unknown>[] = [
  {
    id: 'invoiceNo',
    header: 'Order no.',
    accessorKey: 'invoiceNo',
    meta: { hideable: false },
    cell: ({ row }) => <span className="font-medium">{row.original.invoiceNo}</span>,
  },
  {
    id: 'date',
    header: 'Booked on',
    accessorKey: 'date',
    cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.date)}</span>,
  },
  {
    id: 'dispatchedOn',
    header: 'Dispatched on',
    accessorFn: (r) => r.dispatchedOn ?? '',
    cell: ({ row }) =>
      row.original.dispatchedOn ? (
        <div className="whitespace-nowrap">
          {formatDate(row.original.dispatchedOn)}
          {row.original.saleType === 'office' ? (
            <div className="text-xs text-muted-foreground">Handed over at the counter</div>
          ) : null}
        </div>
      ) : (
        <span className="text-muted-foreground">Not sent yet</span>
      ),
  },
  {
    id: 'type',
    header: 'Type',
    accessorFn: (r) => (r.saleType === 'online' ? 'Online' : 'Office'),
    cell: ({ row }) => (
      <StatusBadge tone={row.original.saleType === 'online' ? 'info' : 'neutral'}>
        {row.original.saleType === 'online' ? 'Online' : 'Office'}
      </StatusBadge>
    ),
  },
  {
    id: 'customer',
    header: 'Customer',
    accessorFn: (r) => `${r.to.name} ${r.to.phone}`,
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.to.name}</div>
        <div className="text-xs text-muted-foreground tabular-nums">{row.original.to.phone}</div>
      </div>
    ),
  },
  {
    id: 'address',
    header: 'Delivery address',
    accessorFn: (r) => [r.to.address, r.to.city].filter(Boolean).join(', '),
    cell: ({ row }) => (
      <span className="line-clamp-2 max-w-64">
        {[row.original.to.address, row.original.to.city].filter(Boolean).join(', ') || '—'}
      </span>
    ),
  },
  {
    id: 'products',
    header: 'Products',
    accessorFn: (r) => r.items.map((i) => `${i.name} x ${Number(i.qty)}`).join('; '),
    cell: ({ row }) => (
      <ul className="space-y-0.5">
        {row.original.items.map((item, index) => (
          <li key={index} className="whitespace-nowrap">
            {item.name}{' '}
            <span className="text-muted-foreground tabular-nums">× {formatQuantity(item.qty)}</span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    id: 'qty',
    header: 'Total qty',
    accessorFn: totalQty,
    meta: { align: 'right' },
    cell: ({ row }) => formatQuantity(totalQty(row.original)),
  },
];

function readQuery(params: URLSearchParams): DeliverySlipsQuery {
  const number = (key: string) => (params.get(key) ? Number(params.get(key)) : undefined);
  const saleType = params.get('saleType');
  return {
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    saleType: saleType === 'office' || saleType === 'online' ? saleType : undefined,
    invoiceFrom: number('invoiceFrom'),
    invoiceTo: number('invoiceTo'),
    dateBy: params.get('dateBy') === 'dispatched' ? 'dispatched' : undefined,
    branchId: params.get('branchId') ?? undefined,
  };
}

function withMonth(query: DeliverySlipsQuery): DeliverySlipsQuery {
  if (query.from || query.invoiceFrom || query.invoiceTo) return query;
  const now = new Date();
  return { ...query, from: isoDate(startOfMonth(now)), to: isoDate(endOfMonth(now)) };
}

const branchColumn: ColumnDef<DeliverySlip, unknown> = {
  id: 'branch',
  header: 'Branch',
  accessorFn: (r) => r.branch?.name ?? '',
  cell: ({ row }) => <span className="whitespace-nowrap">{row.original.branch?.name ?? '—'}</span>,
};

export const slipQuery = (order: { invoiceNo: string; date: string }): DeliverySlipsQuery => {
  const seq = Number(order.invoiceNo.split('-').pop());
  return { saleType: 'online', from: order.date, to: order.date, invoiceFrom: seq, invoiceTo: seq };
};

export const slipPrintPath = (order: { invoiceNo: string; date: string }) => {
  const query = slipQuery(order);
  return `/print/delivery-slips?saleType=online&from=${query.from}&to=${query.to}&invoiceFrom=${query.invoiceFrom}&invoiceTo=${query.invoiceTo}`;
};

function SlipRule() {
  return (
    <div className="h-px bg-linear-to-r from-transparent via-foreground to-transparent [-webkit-print-color-adjust:exact] [print-color-adjust:exact]" />
  );
}

function SlipField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-semibold">{value || '—'}</span>
    </div>
  );
}

function SlipParty({ title, party }: { title: string; party: DeliverySlip['to'] | DeliverySlip['from'] }) {
  return (
    <div className="space-y-2">
      <div className="font-semibold">{title},</div>
      <div className="grid grid-cols-3 gap-4">
        <SlipField label="Name" value={party.name} />
        <SlipField label="Phone" value={party.phone} />
        <SlipField label="City" value={party.city} />
      </div>
      <SlipField label="Address" value={party.address} />
    </div>
  );
}

function Slip({ slip }: { slip: DeliverySlip }) {
  return (
    <article className="flex h-[128mm] break-inside-avoid flex-col gap-3 overflow-hidden text-[13px]">
      <img src={logo} alt="Dr Shawana DSM" className="mx-auto h-20 w-auto" />
      <SlipRule />
      <SlipField label="Order No" value={`ORD#${slip.invoiceNo}`} />
      <SlipParty title="To" party={slip.to} />
      <ol className="space-y-0.5 text-xs font-semibold">
        {slip.items.map((item, index) => (
          <li key={index}>
            {index + 1}: {item.name} x {formatQuantity(item.qty)}
          </li>
        ))}
      </ol>
      <SlipRule />
      <SlipParty title="From" party={slip.from} />
    </article>
  );
}

export function DeliveryReportPage() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const branches = useBranchOptions(isSuperAdmin);
  const [params, setParams] = useSearchParams();
  const query = readQuery(params);
  const effective = withMonth(query);
  const slips = useDeliverySlips(effective);
  const [invoiceFrom, setInvoiceFrom] = useState(params.get('invoiceFrom') ?? '');
  const [invoiceTo, setInvoiceTo] = useState(params.get('invoiceTo') ?? '');

  const set = (changes: Record<string, string | undefined>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );

  const rows = slips.data?.slips ?? [];

  return (
    <>
      <PageHeader
        title="Delivery report"
        description="This month by default. Booking date: orders by the day they were booked. Dispatch / hand-over date: online orders by the day they were sent, and office sales by their sale day (handed over at the counter). Prints two slips per A4 page."
        actions={
          <Button
            disabled={rows.length === 0}
            onClick={() => void navigate(`/print/delivery-slips?${params.toString()}`)}
          >
            <Printer />
            Print {rows.length ? `${rows.length} slips` : 'slips'}
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-xs">
        {isSuperAdmin ? (
          <div className="space-y-1.5">
            <Label>Branch</Label>
            <Select
              value={params.get('branchId') ?? ALL}
              onValueChange={(v) => set({ branchId: v === ALL ? undefined : v })}
            >
              <SelectTrigger className="h-9 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All branches</SelectItem>
                {(branches.data ?? [])
                  .filter((b) => b.kind === 'branch')
                  .map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label>Date by</Label>
          <Select
            value={params.get('dateBy') ?? 'booked'}
            onValueChange={(v) => set({ dateBy: v === 'dispatched' ? v : undefined })}
          >
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="booked">Booking date</SelectItem>
              <SelectItem value="dispatched">Dispatch / hand-over date</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{params.get('dateBy') === 'dispatched' ? 'Dispatched on' : 'Booked on'}</Label>
          <DateRangePicker
            from={params.get('from') ?? undefined}
            to={params.get('to') ?? undefined}
            placeholder="This month"
            onChange={({ from, to }) => set({ from, to: to ?? from })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Sale type</Label>
          <Select
            value={params.get('saleType') ?? ALL}
            onValueChange={(v) => set({ saleType: v === ALL ? undefined : v })}
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Office & online</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="office">Office</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invoice-from">Order no. from</Label>
          <Input
            id="invoice-from"
            inputMode="numeric"
            className="h-9 w-32"
            value={invoiceFrom}
            onChange={(e) => /^\d*$/.test(e.target.value) && setInvoiceFrom(e.target.value)}
            onBlur={() => set({ invoiceFrom: invoiceFrom || undefined })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invoice-to">Order no. to</Label>
          <Input
            id="invoice-to"
            inputMode="numeric"
            className="h-9 w-32"
            value={invoiceTo}
            onChange={(e) => /^\d*$/.test(e.target.value) && setInvoiceTo(e.target.value)}
            onBlur={() => set({ invoiceTo: invoiceTo || undefined })}
          />
        </div>
      </div>
      <DataTable
        columns={isSuperAdmin ? [branchColumn, ...slipColumns] : slipColumns}
        data={slips.data ? rows : undefined}
        isLoading={slips.isLoading}
        isFetching={slips.isFetching}
        error={slips.error}
        onRetry={() => void slips.refetch()}
        getRowId={(r) => r.saleId}
        onRowClick={(r) => void navigate(`/sales/${r.saleId}`)}
        exportFileName="delivery-report"
        emptyTitle="No orders"
        emptyDescription="No sales match these filters."
        totalsRow={{
          invoiceNo: `Total · ${rows.length} orders`,
          qty: formatQuantity(rows.reduce((sum, r) => sum + totalQty(r), 0)),
        }}
      />
    </>
  );
}

export function DeliverySlipsPrint() {
  const [params] = useSearchParams();
  const query = readQuery(params);
  const slips = useDeliverySlips(withMonth(query));
  return (
    <PrintPage isLoading={slips.isLoading} error={slips.error} onRetry={() => void slips.refetch()}>
      {() => {
        const list = slips.data?.slips ?? [];
        const pages = Array.from({ length: Math.ceil(list.length / 2) }, (_, i) =>
          list.slice(i * 2, i * 2 + 2),
        );
        return (
          <>
            <style>{'@page { size: A4; margin: 10mm; }'}</style>
            {pages.map((pair, index) => (
              <section
                key={pair[0]?.saleId ?? index}
                className="flex flex-col gap-[8mm] border-b border-dashed pb-8 not-last:mb-8 last:border-b-0 last:pb-0 print:mb-0 print:border-b-0 print:pb-0 print:not-last:break-after-page"
              >
                {pair.map((slip) => (
                  <Slip key={slip.saleId} slip={slip} />
                ))}
              </section>
            ))}
          </>
        );
      }}
    </PrintPage>
  );
}
