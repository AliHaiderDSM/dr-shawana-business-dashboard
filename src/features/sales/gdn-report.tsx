import { addDays, parseISO } from 'date-fns';
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  History,
  PackagePlus,
  Printer,
  Store,
  Truck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge, type Tone } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuth } from '@/lib/auth/auth-context';
import { useBranchOptions } from '@/lib/auth/branches';
import { formatCount, formatDate, formatMoney, isoDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo-hd.png';
import { useGdnReport, type GdnOrder, type GdnOrderStatus, type GdnReportType } from '@redux/features/sales';

type View = 'all' | GdnOrderStatus;

const PALETTE = 8;

const ALL_PRODUCTS = '__all__';

const TOGGLE_LABELS: Record<GdnReportType, string> = { online: 'Online', office: 'Office', all: 'All' };

const TYPES: Record<GdnReportType, string> = {
  online: 'Online orders',
  office: 'Office sales',
  all: 'Online + office',
};

const PAYMENT: Record<string, { label: string; tone: Tone }> = {
  paid: { label: 'Paid', tone: 'success' },
  partial: { label: 'Partly paid', tone: 'warning' },
  unpaid: { label: 'Unpaid', tone: 'danger' },
};

const STATUS_ORDER: Record<GdnOrderStatus, number> = { dispatched: 0, pending: 1, cancelled: 2 };

const shift = (date: string, days: number) => isoDate(addDays(parseISO(date), days));

const dayColor = (date: string) => {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return `var(--booked-${(((day % PALETTE) + PALETTE) % PALETTE) + 1})`;
};

const tint = (date: string, percent: number): CSSProperties => ({
  backgroundColor: `color-mix(in oklch, ${dayColor(date)} ${percent}%, transparent)`,
});

const ago = (days: number) => (days === 0 ? 'Booked today' : days === 1 ? '1 day ago' : `${days} days ago`);

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  hint: ReactNode;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs print:shadow-none">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className={cn('flex size-7 items-center justify-center rounded-lg', accent)}>
          <Icon className="size-4" />
        </span>
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{formatCount(value)}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function BookedChip({ date, reportDate }: { date: string; reportDate: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-foreground"
      style={tint(date, 18)}
    >
      <span className="size-2 rounded-full" style={{ backgroundColor: dayColor(date) }} />
      {date === reportDate ? 'Today' : formatDate(date, 'EEE dd MMM')}
    </span>
  );
}

function Status({ order }: { order: GdnOrder }) {
  if (order.saleType === 'office')
    return (
      <div className="space-y-0.5">
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
          <Store className="size-4" />
          Handed over
        </span>
        <div className="text-xs text-muted-foreground tabular-nums">{order.gdnNo ?? '—'}</div>
      </div>
    );
  if (order.status === 'dispatched')
    return (
      <div className="space-y-0.5">
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
          <CheckCircle2 className="size-4" />
          Dispatched
        </span>
        <div className="text-xs text-muted-foreground tabular-nums">{order.gdnNo ?? '—'}</div>
      </div>
    );
  if (order.status === 'cancelled')
    return (
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-destructive">
        <XCircle className="size-4" />
        Cancelled
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-warning-soft-foreground">
      <Clock className="size-4" />
      Waiting
    </span>
  );
}

export function GdnReportPage() {
  const [params, setParams] = useSearchParams();
  const today = isoDate();
  const date = params.get('date') ?? today;
  const { isSuperAdmin, branchId: currentBranch } = useAuth();
  const branches = useBranchOptions(isSuperAdmin);
  const choices = (branches.data ?? []).filter((b) => b.kind !== 'warehouse');
  const dispatchBranch = choices.find((b) => b.kind === 'dispatch');
  const current = choices.find((b) => b.id === currentBranch);
  const onDispatch = current?.kind === 'dispatch';
  const picked = isSuperAdmin
    ? onDispatch
      ? current.id
      : (params.get('branch') ?? dispatchBranch?.id ?? current?.id)
    : undefined;
  const typeParam = params.get('type');
  const type: GdnReportType =
    isSuperAdmin && (typeParam === 'office' || typeParam === 'all') ? typeParam : 'online';
  const report = useGdnReport(date, type, picked, !isSuperAdmin || Boolean(picked));
  const data = report.data;
  const [view, setView] = useState<View>('all');
  const [day, setDay] = useState<string | null>(null);
  const product = params.get('product');

  const setParam = (key: string, value: string | null) =>
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);
        if (value === null) copy.delete(key);
        else copy.set(key, value);
        return copy;
      },
      { replace: true },
    );

  const go = (next: string) => {
    setDay(null);
    setParam('date', next === today ? null : next);
  };

  const products = [...new Set((data?.orders ?? []).flatMap((o) => o.items.map((i) => i.name)))].sort(
    (a, b) => a.localeCompare(b),
  );
  const orders = [...(data?.orders ?? [])]
    .filter((o) => !product || o.items.some((i) => i.name === product))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        a.invoiceNo.localeCompare(b.invoiceNo),
    );
  const days = [...new Set(orders.map((o) => o.date))];
  const byDay = days.map((d) => {
    const mine = orders.filter((o) => o.date === d);
    return {
      date: d,
      sent: mine.filter((o) => o.status === 'dispatched').length,
      waiting: mine.filter((o) => o.status === 'pending').length,
      cancelled: mine.filter((o) => o.status === 'cancelled').length,
    };
  });
  const count = (v: View) => orders.filter((o) => v === 'all' || o.status === v).length;
  const rows = orders.filter((o) => (view === 'all' || o.status === view) && (!day || o.date === day));
  const total = rows.reduce((sum, o) => sum + Number(o.total), 0);
  const next = formatDate(shift(date, 1), 'dd MMM');
  const amount = (list: GdnOrder[]) => list.reduce((sum, o) => sum + Number(o.total), 0);
  const earlier = orders.filter((o) => o.fromBefore);
  const fresh = orders.filter((o) => !o.fromBefore);
  const sent = orders.filter((o) => o.status === 'dispatched');
  const left = orders.filter((o) => o.status === 'pending');
  const s = data
    ? {
        opening: earlier.length,
        openingAmount: amount(earlier),
        newOrders: fresh.length,
        newAmount: amount(fresh),
        dispatched: sent.length,
        office: sent.filter((o) => o.saleType === 'office').length,
        dispatchedFromOpening: sent.filter((o) => o.fromBefore).length,
        dispatchedFromNew: sent.filter((o) => !o.fromBefore).length,
        cancelled: orders.filter((o) => o.status === 'cancelled').length,
        closing: left.length,
      }
    : null;
  const units = (o: GdnOrder) =>
    o.items.filter((i) => i.name === product).reduce((sum, i) => sum + Number(i.qty), 0);

  const tabs: { key: View; label: string }[] = [
    { key: 'all', label: 'All orders' },
    { key: 'dispatched', label: 'Dispatched today' },
    { key: 'pending', label: 'Still waiting' },
    ...(count('cancelled') ? [{ key: 'cancelled' as const, label: 'Cancelled' }] : []),
  ];

  return (
    <div className="space-y-6 [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:space-y-3">
      <style>{'@media print { @page { size: A4 landscape; margin: 10mm; } }'}</style>
      <PageHeader
        className="print:hidden"
        title="GDN report"
        description="One view of the day: every online order that was waiting or booked, what went out and what is still waiting, and for a branch the office sales handed over at the counter. Each booking day has its own colour, so an old order dispatched today shows the colour of the day it was booked."
      />
      <div className="-mt-2 flex flex-wrap items-center gap-2 print:hidden">
        {isSuperAdmin ? (
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={type}
            onValueChange={(v) => v && setParam('type', v === 'online' ? null : v)}
            aria-label="Sales to show"
          >
            {(Object.keys(TYPES) as GdnReportType[]).map((key) => (
              <ToggleGroupItem
                key={key}
                value={key}
                className="h-9 px-3 text-sm data-[state=on]:border-primary data-[state=on]:bg-primary-soft data-[state=on]:text-primary-soft-foreground"
              >
                {TOGGLE_LABELS[key]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
        {products.length ? (
          <Select
            value={product ?? ALL_PRODUCTS}
            onValueChange={(v) => setParam('product', v === ALL_PRODUCTS ? null : v)}
          >
            <SelectTrigger className="w-48" aria-label="Product">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PRODUCTS}>All products</SelectItem>
              {products.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {isSuperAdmin && choices.length && !onDispatch ? (
          <Select value={picked ?? ''} onValueChange={(id) => setParam('branch', id)}>
            <SelectTrigger className="w-48" aria-label="Branch">
              <SelectValue placeholder="Choose branch" />
            </SelectTrigger>
            <SelectContent>
              {choices.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                  {b.kind === 'dispatch' ? ' (dispatch)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => go(shift(date, -1))}>
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
        <Button className="ml-auto" onClick={() => window.print()} disabled={!data}>
          <Printer />
          Print
        </Button>
      </div>

      {report.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : !data || !s ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            title="Report not available"
            description={report.error instanceof Error ? report.error.message : 'Try again in a moment.'}
          />
        </div>
      ) : (
        <>
          <div className="hidden items-center justify-between border-b pb-2 print:flex">
            <img src={logo} alt="Dr Shawana DSM" className="h-9 w-auto" />
            <div className="text-right">
              <div className="text-base font-semibold">
                GDN day-end report · {data.branch.name} · {TYPES[data.type]}
              </div>
              <div className="text-xs">
                {formatDate(data.date, 'EEEE, dd MMMM yyyy')}
                {product ? ` · ${product}` : ''} · {s.opening} from earlier days + {s.newOrders} booked ·{' '}
                {s.dispatched} dispatched · {s.closing} still waiting
              </div>
            </div>
          </div>
          <div
            className={cn(
              'flex flex-wrap items-center gap-2 text-sm text-muted-foreground print:hidden',
              !product && 'hidden',
            )}
          >
            {product ? (
              <>
                <StatusBadge tone="info">Orders with {product}</StatusBadge>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => setParam('product', null)}
                >
                  Show all products
                </button>
              </>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
            <Kpi
              label="Waiting from earlier days"
              value={s.opening}
              hint={
                s.opening
                  ? `Left over at the start of the day · ${formatMoney(s.openingAmount)}`
                  : 'Nothing was left over'
              }
              icon={History}
              accent="bg-warning-soft text-warning-soft-foreground"
            />
            <Kpi
              label="Booked today"
              value={s.newOrders}
              hint={s.newOrders ? formatMoney(s.newAmount) : 'No new order'}
              icon={PackagePlus}
              accent="bg-info-soft text-info-soft-foreground"
            />
            <Kpi
              label="Dispatched today"
              value={s.dispatched}
              hint={
                s.dispatched
                  ? s.office === s.dispatched
                    ? `${s.office} handed over at the counter`
                    : `${s.dispatchedFromOpening} from earlier days · ${s.dispatchedFromNew - s.office} booked today${s.office ? ` · ${s.office} at the counter` : ''}`
                  : 'Nothing went out'
              }
              icon={Truck}
              accent="bg-success-soft text-success-soft-foreground"
            />
            <Kpi
              label="Still waiting tonight"
              value={s.closing}
              hint={
                s.closing
                  ? `Moves to ${next}${s.cancelled ? ` · ${s.cancelled} cancelled today` : ''}`
                  : s.cancelled
                    ? `All cleared · ${s.cancelled} cancelled today`
                    : 'All cleared'
              }
              icon={CalendarClock}
              accent="bg-neutral-soft text-neutral-soft-foreground"
            />
          </div>

          {orders.length === 0 ? (
            <div className="rounded-xl border bg-card">
              <EmptyState
                title={
                  product
                    ? `No order with ${product} on this day`
                    : `No ${TYPES[data.type].toLowerCase()} on this day`
                }
                description={
                  data.branch.dispatch || !dispatchBranch || data.type !== 'online'
                    ? `Nothing was waiting, booked or sent at ${data.branch.name}.`
                    : `Nothing at ${data.branch.name}. Online orders are sent by ${dispatchBranch.name}; choose it above.`
                }
              />
            </div>
          ) : (
            <section className="overflow-hidden rounded-xl border bg-card shadow-xs print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
              <div className="space-y-3 border-b p-4 print:hidden">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Orders by booking day</h2>
                  <span className="text-xs text-muted-foreground print:hidden">
                    Click a day to see only its orders
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {byDay.map((d) => {
                    const on = day === d.date;
                    return (
                      <button
                        key={d.date}
                        type="button"
                        onClick={() => setDay(on ? null : d.date)}
                        aria-pressed={on}
                        className={cn(
                          'flex min-w-40 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-shadow hover:shadow-sm',
                          on && 'ring-2 ring-ring',
                          day && !on && 'opacity-50',
                        )}
                        style={{ borderLeft: `4px solid ${dayColor(d.date)}`, ...tint(d.date, 8) }}
                      >
                        <div>
                          <div className="text-sm font-semibold">
                            {d.date === data.date ? 'Booked today' : formatDate(d.date, 'EEE dd MMM')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {d.sent ? <span className="font-medium text-success">{d.sent} sent</span> : null}
                            {d.sent && (d.waiting || d.cancelled) ? ' · ' : ''}
                            {d.waiting ? (
                              <span className="font-medium text-warning-soft-foreground">
                                {d.waiting} waiting
                              </span>
                            ) : null}
                            {d.waiting && d.cancelled ? ' · ' : ''}
                            {d.cancelled ? (
                              <span className="text-destructive">{d.cancelled} cancelled</span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                className="flex flex-wrap items-center gap-1 border-b px-4 py-2 print:hidden"
                role="tablist"
              >
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={view === t.key}
                    onClick={() => setView(t.key)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
                      view === t.key && 'bg-muted text-foreground',
                    )}
                  >
                    {t.label} <span className="tabular-nums">({count(t.key)})</span>
                  </button>
                ))}
                {day ? (
                  <button
                    type="button"
                    onClick={() => setDay(null)}
                    className="ml-auto text-xs font-medium text-primary hover:underline"
                  >
                    Show every booking day
                  </button>
                ) : null}
              </div>

              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-sm print:text-[11px]">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-2 pl-5 font-medium">Sr.</th>
                      <th className="px-3 py-2 font-medium">Booked</th>
                      <th className="px-3 py-2 font-medium">Order</th>
                      <th className="px-3 py-2 font-medium">Customer</th>
                      <th className="px-3 py-2 font-medium">City · booked at</th>
                      <th className="px-3 py-2 font-medium">Items</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                      <th className="px-3 py-2 font-medium">Today</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((o, index) => {
                      const pay = PAYMENT[o.paymentStatus] ?? {
                        label: o.paymentStatus,
                        tone: 'neutral' as Tone,
                      };
                      return (
                        <tr
                          key={o.id}
                          className={cn(
                            'border-b align-top last:border-b-0 print:break-inside-avoid',
                            o.status === 'cancelled' && 'text-muted-foreground',
                          )}
                          style={tint(o.date, 5)}
                        >
                          <td
                            className="py-2.5 pr-2 pl-4 text-muted-foreground tabular-nums"
                            style={{ borderLeft: `4px solid ${dayColor(o.date)}` }}
                          >
                            {index + 1}
                          </td>
                          <td className="px-3 py-2.5">
                            <BookedChip date={o.date} reportDate={data.date} />
                            <div className="mt-1">
                              {o.saleType === 'office' ? (
                                <StatusBadge tone="info">Office</StatusBadge>
                              ) : (
                                <StatusBadge tone="neutral">Online</StatusBadge>
                              )}
                            </div>
                            <div
                              className={cn(
                                'mt-1 text-xs text-muted-foreground',
                                o.status === 'pending' &&
                                  o.waitingDays >= 2 &&
                                  'font-semibold text-destructive',
                              )}
                            >
                              {ago(o.waitingDays)}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 font-medium whitespace-nowrap">{o.invoiceNo}</td>
                          <td className="px-3 py-2.5">
                            <div className="font-medium">{o.customer.name ?? '—'}</div>
                            <div className="text-xs text-muted-foreground tabular-nums">
                              {o.customer.phone}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div>{o.city ?? '—'}</div>
                            <div className="text-xs text-muted-foreground">
                              {o.bookedAt?.name ?? o.bookedAt?.code ?? '—'}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <ul className="min-w-40 space-y-0.5 text-xs print:min-w-0 print:text-[10px]">
                              {o.items.map((item, i) => (
                                <li
                                  key={i}
                                  className={cn(product && item.name === product && 'font-semibold')}
                                >
                                  {item.name} <span className="text-muted-foreground">× {item.qty}</span>
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                            <div className="font-medium">{formatMoney(o.total)}</div>
                            <div className="mt-0.5 print:hidden">
                              <StatusBadge tone={pay.tone}>{pay.label}</StatusBadge>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <Status order={o} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="print:table-row-group">
                    <tr className="border-t bg-muted/30 text-sm font-semibold">
                      <td className="py-2 pr-3 pl-5" colSpan={6}>
                        {rows.length} order{rows.length === 1 ? '' : 's'}
                        {product
                          ? ` · ${formatCount(rows.reduce((sum, o) => sum + units(o), 0))} × ${product}`
                          : ''}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(total)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}

          <div className="hidden grid-cols-2 gap-16 pt-12 text-sm print:grid">
            <div className="border-t pt-2 text-center">Dispatched by</div>
            <div className="border-t pt-2 text-center">Checked by</div>
          </div>
        </>
      )}
    </div>
  );
}
