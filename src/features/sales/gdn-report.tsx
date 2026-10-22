import { addDays, parseISO } from 'date-fns';
import {
  ArrowRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  History,
  PackagePlus,
  Printer,
  Truck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Panel } from '@/components/shared/panel';
import { StatusBadge, type Tone } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCount, formatDate, formatMoney, isoDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo-hd.png';
import { useGdnReport, type GdnOrder, type GdnReport } from '@redux/features/sales';

const PAYMENT: Record<string, { label: string; tone: Tone }> = {
  paid: { label: 'Paid', tone: 'success' },
  partial: { label: 'Partly paid', tone: 'warning' },
  unpaid: { label: 'Unpaid', tone: 'danger' },
};

const shift = (date: string, days: number) => isoDate(addDays(parseISO(date), days));

const waited = (days: number) => (days === 0 ? 'Same day' : days === 1 ? '1 day' : `${days} days`);

function FlowCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  strong,
}: {
  label: string;
  value: number;
  hint: ReactNode;
  icon: LucideIcon;
  tone: 'neutral' | 'info' | 'success' | 'danger' | 'warning';
  strong?: boolean;
}) {
  const tones = {
    neutral: 'bg-neutral-soft text-neutral-soft-foreground',
    info: 'bg-info-soft text-info-soft-foreground',
    success: 'bg-success-soft text-success-soft-foreground',
    danger: 'bg-destructive-soft text-destructive-soft-foreground',
    warning: 'bg-warning-soft text-warning-soft-foreground',
  };
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-2 rounded-xl border bg-card p-4 shadow-xs print:shadow-none',
        strong && 'ring-2 ring-primary/30',
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', tones[tone])}>
          <Icon className="size-4" />
        </span>
        <span className="text-sm leading-tight font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="text-3xl font-semibold tracking-tight tabular-nums">{formatCount(value)}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function Flow({ report }: { report: GdnReport }) {
  const s = report.summary;
  const next = formatDate(shift(report.date, 1));
  return (
    <div className="space-y-3">
      <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
        <FlowCard
          label="Pending from earlier days"
          value={s.opening}
          hint={s.opening ? `Worth ${formatMoney(s.openingAmount)}` : 'Nothing was waiting'}
          icon={History}
          tone="warning"
        />
        <span className="hidden text-lg text-muted-foreground lg:block">+</span>
        <FlowCard
          label="New orders today"
          value={s.newOrders}
          hint={s.newOrders ? `Worth ${formatMoney(s.newAmount)}` : 'No order booked'}
          icon={PackagePlus}
          tone="info"
        />
        <ArrowRight className="hidden size-5 shrink-0 text-muted-foreground lg:block" />
        <FlowCard
          label="Dispatched today"
          value={s.dispatched}
          hint={
            s.dispatched ? (
              <>
                <span className="font-medium text-foreground">{s.dispatchedFromOpening}</span> from earlier
                days · <span className="font-medium text-foreground">{s.dispatchedFromNew}</span> of today
              </>
            ) : (
              'Nothing sent'
            )
          }
          icon={Truck}
          tone="success"
          strong
        />
        <FlowCard
          label="Cancelled today"
          value={s.cancelled}
          hint={s.cancelled ? 'Taken off the list' : 'None'}
          icon={XCircle}
          tone="danger"
        />
        <ArrowRight className="hidden size-5 shrink-0 text-muted-foreground lg:block" />
        <FlowCard
          label={`Carried to ${next}`}
          value={s.closing}
          hint={
            s.closing
              ? `${s.closingFromOpening} still from earlier days${s.oldestPending ? ` · oldest ${formatDate(s.oldestPending)}` : ''}`
              : 'All cleared'
          }
          icon={CalendarClock}
          tone={s.closing ? 'warning' : 'neutral'}
        />
      </div>
      <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-2 text-center text-sm text-muted-foreground tabular-nums">
        {s.opening} earlier + {s.newOrders} new − {s.dispatched} dispatched − {s.cancelled} cancelled ={' '}
        <span className="font-semibold text-foreground">{s.closing} carried to the next day</span>
      </p>
    </div>
  );
}

function OrdersTable({
  orders,
  showGdn,
  showFrom,
}: {
  orders: GdnOrder[];
  showGdn?: boolean;
  showFrom?: boolean;
}) {
  if (orders.length === 0)
    return <p className="px-5 py-6 text-center text-sm text-muted-foreground">None.</p>;
  const total = orders.reduce((sum, o) => sum + Number(o.total), 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">#</th>
            {showGdn ? <th className="px-3 py-2 font-medium">GDN no.</th> : null}
            <th className="px-3 py-2 font-medium">Order no.</th>
            <th className="px-3 py-2 font-medium">Booked on</th>
            <th className="px-3 py-2 font-medium">{showGdn ? 'Waited' : 'Waiting'}</th>
            <th className="px-3 py-2 font-medium">Customer</th>
            <th className="px-3 py-2 font-medium">City</th>
            <th className="px-3 py-2 font-medium">Booked at</th>
            <th className="px-3 py-2 font-medium">Items</th>
            <th className="px-3 py-2 text-right font-medium">Amount</th>
            <th className="px-3 py-2 font-medium print:hidden">Payment</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o, index) => {
            const pay = PAYMENT[o.paymentStatus] ?? { label: o.paymentStatus, tone: 'neutral' as Tone };
            return (
              <tr key={o.id} className="border-b align-top last:border-b-0 print:break-inside-avoid">
                <td className="px-3 py-2 text-muted-foreground tabular-nums">{index + 1}</td>
                {showGdn ? (
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{o.gdnNo ?? '—'}</td>
                ) : null}
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="font-medium">{o.invoiceNo}</div>
                  {showFrom ? (
                    <StatusBadge tone={o.fromBefore ? 'warning' : 'info'}>
                      {o.fromBefore ? 'Earlier day' : 'New today'}
                    </StatusBadge>
                  ) : null}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(o.date, 'dd-MM-yyyy')}</td>
                <td
                  className={cn(
                    'px-3 py-2 whitespace-nowrap tabular-nums',
                    o.waitingDays >= 2 && 'font-semibold text-destructive',
                  )}
                >
                  {waited(o.waitingDays)}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{o.customer.name ?? '—'}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">{o.customer.phone}</div>
                </td>
                <td className="px-3 py-2">{o.city ?? '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{o.bookedAt?.name ?? o.bookedAt?.code ?? '—'}</td>
                <td className="px-3 py-2">
                  <ul className="min-w-44 space-y-0.5 text-xs">
                    {o.items.map((item, i) => (
                      <li key={i}>
                        {item.name} <span className="text-muted-foreground">× {item.qty}</span>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="px-3 py-2 text-right font-medium whitespace-nowrap tabular-nums">
                  {formatMoney(o.total)}
                </td>
                <td className="px-3 py-2 print:hidden">
                  <StatusBadge tone={pay.tone}>{pay.label}</StatusBadge>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/30 text-sm font-semibold">
            <td className="px-3 py-2" colSpan={showGdn ? 9 : 8}>
              {orders.length} order{orders.length === 1 ? '' : 's'}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">{formatMoney(total)}</td>
            <td className="print:hidden" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function GdnReportPage() {
  const [params, setParams] = useSearchParams();
  const today = isoDate();
  const date = params.get('date') ?? today;
  const report = useGdnReport(date);
  const data = report.data;

  const go = (next: string) =>
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);
        if (next === today) copy.delete('date');
        else copy.set('date', next);
        return copy;
      },
      { replace: true },
    );

  const orders = data?.orders ?? [];
  const sentEarlier = orders.filter((o) => o.status === 'dispatched' && o.fromBefore);
  const sentToday = orders.filter((o) => o.status === 'dispatched' && !o.fromBefore);
  const pending = orders.filter((o) => o.status === 'pending');
  const cancelled = orders.filter((o) => o.status === 'cancelled');
  const next = formatDate(shift(date, 1));

  return (
    <div className="space-y-6">
      <PageHeader
        title="GDN report"
        description="Day-end dispatch report of online orders: what was waiting from earlier days, what was dispatched today and what carries to the next day."
        actions={
          <>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous day"
                onClick={() => go(shift(date, -1))}
              >
                <ChevronLeft />
              </Button>
              <Input
                type="date"
                className="w-40"
                value={date}
                max={today}
                onChange={(e) => e.target.value && go(e.target.value)}
                aria-label="Report date"
              />
              <Button
                variant="outline"
                size="icon"
                aria-label="Next day"
                disabled={date >= today}
                onClick={() => go(shift(date, 1))}
              >
                <ChevronRight />
              </Button>
            </div>
            {date !== today ? (
              <Button variant="ghost" onClick={() => go(today)}>
                Today
              </Button>
            ) : null}
            <Button onClick={() => window.print()} disabled={!data}>
              <Printer />
              Print report
            </Button>
          </>
        }
      />

      {report.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !data ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            title="Report not available"
            description={report.error instanceof Error ? report.error.message : 'Try again in a moment.'}
          />
        </div>
      ) : (
        <>
          <div className="hidden items-center justify-between border-b pb-3 print:flex">
            <img src={logo} alt="Dr Shawana DSM" className="h-10 w-auto" />
            <div className="text-right">
              <div className="text-lg font-semibold">GDN day-end report · {data.branch.name}</div>
              <div className="text-sm">{formatDate(data.date, 'EEEE, dd MMMM yyyy')}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground print:hidden">
            <span className="font-medium text-foreground">{data.branch.name}</span>
            <span>·</span>
            <span>{formatDate(data.date, 'EEEE, dd MMMM yyyy')}</span>
            <span>·</span>
            <span>
              {data.branch.dispatch
                ? 'Orders this department dispatches'
                : 'Online orders booked at this branch'}
            </span>
          </div>

          <Flow report={data} />

          <Panel
            title={`Dispatched today from earlier days (${sentEarlier.length})`}
            description="Orders booked before today that were waiting and went out today."
            bodyClassName="p-0"
            className="print:break-inside-avoid-page"
          >
            <OrdersTable orders={sentEarlier} showGdn />
          </Panel>

          <Panel
            title={`Dispatched today from today's orders (${sentToday.length})`}
            description="Orders booked today that also went out today."
            bodyClassName="p-0"
          >
            <OrdersTable orders={sentToday} showGdn />
          </Panel>

          <Panel
            title={`Still pending, carried to ${next} (${pending.length})`}
            description="Not dispatched by the end of the day. They open the next day's report as pending from earlier days."
            bodyClassName="p-0"
          >
            <OrdersTable orders={pending} showFrom />
          </Panel>

          {cancelled.length ? (
            <Panel title={`Cancelled today (${cancelled.length})`} bodyClassName="p-0">
              <OrdersTable orders={cancelled} showFrom />
            </Panel>
          ) : null}

          <div className="hidden grid-cols-2 gap-16 pt-12 text-sm print:grid">
            <div className="border-t pt-2 text-center">Dispatched by</div>
            <div className="border-t pt-2 text-center">Checked by</div>
          </div>
        </>
      )}
    </div>
  );
}
