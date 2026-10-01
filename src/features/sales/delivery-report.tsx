import { Printer, Truck } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { PrintPage } from '@/components/shared/print-document';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatQuantity, isoDate } from '@/lib/format';
import { useDeliverySlips, type DeliverySlip, type DeliverySlipsQuery } from './api';

const ALL = '__all__';

function readQuery(params: URLSearchParams): DeliverySlipsQuery {
  const number = (key: string) => (params.get(key) ? Number(params.get(key)) : undefined);
  const saleType = params.get('saleType');
  return {
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    saleType: saleType === 'office' || saleType === 'online' ? saleType : undefined,
    invoiceFrom: number('invoiceFrom'),
    invoiceTo: number('invoiceTo'),
  };
}

function Slip({ slip }: { slip: DeliverySlip }) {
  return (
    <article className="flex h-[138mm] flex-col gap-3 overflow-hidden rounded-lg border-2 border-dashed p-5 text-sm print:rounded-none">
      <div className="flex items-start justify-between border-b pb-2">
        <div className="text-lg font-semibold">ORD#{slip.invoiceNo}</div>
        <div className="text-right text-xs text-muted-foreground">
          {formatDate(slip.date, 'dd-MM-yyyy')}
          <div>{slip.saleType === 'online' ? 'Online sale' : 'Office sale'}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">To</div>
          <div className="text-base font-semibold">{slip.to.name}</div>
          <div className="tabular-nums">{slip.to.phone}</div>
          <div>{[slip.to.address, slip.to.city].filter(Boolean).join(', ')}</div>
        </div>
        <div>
          <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">From</div>
          <div className="font-semibold">{slip.from.name}</div>
          <div className="tabular-nums">{slip.from.phone}</div>
          <div>{[slip.from.address, slip.from.city].filter(Boolean).join(', ')}</div>
        </div>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted">
            <th className="border px-2 py-1 text-left">Product</th>
            <th className="w-20 border px-2 py-1 text-right">Qty</th>
          </tr>
        </thead>
        <tbody>
          {slip.items.map((item, index) => (
            <tr key={index}>
              <td className="border px-2 py-1">{item.name}</td>
              <td className="border px-2 py-1 text-right tabular-nums">{formatQuantity(item.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

export function DeliveryReportPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = readQuery(params);
  const effective = {
    ...query,
    from: query.from ?? (query.invoiceFrom || query.invoiceTo ? undefined : isoDate()),
  };
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
        description="Choose the orders, then print the delivery slips, two per A4 page."
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
        <div className="space-y-1.5">
          <Label>Date</Label>
          <DateRangePicker
            from={params.get('from') ?? undefined}
            to={params.get('to') ?? undefined}
            placeholder="Today"
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
      {slips.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : slips.error ? (
        <ErrorState error={slips.error} onRetry={() => void slips.refetch()} />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState icon={Truck} title="No orders" description="No sales match these filters." />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((slip) => (
            <Slip key={slip.saleId} slip={slip} />
          ))}
        </div>
      )}
    </>
  );
}

export function DeliverySlipsPrint() {
  const [params] = useSearchParams();
  const query = readQuery(params);
  const slips = useDeliverySlips({
    ...query,
    from: query.from ?? (query.invoiceFrom || query.invoiceTo ? undefined : isoDate()),
  });
  return (
    <PrintPage isLoading={slips.isLoading} error={slips.error} onRetry={() => void slips.refetch()}>
      {() => (
        <div className="space-y-4">
          {(slips.data?.slips ?? []).map((slip, index) => (
            <Fragment key={slip.saleId}>
              <Slip slip={slip} />
              {index % 2 === 1 ? <div className="break-after-page" /> : null}
            </Fragment>
          ))}
        </div>
      )}
    </PrintPage>
  );
}
