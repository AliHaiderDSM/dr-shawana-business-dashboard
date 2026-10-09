import type { ColumnDef } from '@tanstack/react-table';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {
  Ban,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Eye,
  PackageCheck,
  Printer,
  Tag,
  Truck,
  Undo2,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth/auth-context';
import { formatCount, formatDate, formatMoney, formatQuantity, isoDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useDeliveries, useDeliveryCalendar, type DeliveryDay, type DeliveryOrder } from './api';
import { DeliveryBadge, useOrderActions } from './delivery-actions';
import { BulkDispatchDialog } from './bulk-dispatch';
import { slipPrintPath } from './delivery-report';

type View = 'order' | 'dispatch' | 'awaiting';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function DayCell({
  day,
  date,
  inMonth,
  selected,
  today,
  onSelect,
}: {
  day: DeliveryDay | undefined;
  date: Date;
  inMonth: boolean;
  selected: boolean;
  today: boolean;
  onSelect: () => void;
}) {
  const chips = day
    ? ([
        ['dispatched', day.dispatched + day.delivered, 'bg-success'],
        ['returned', day.returned, 'bg-muted-foreground'],
      ] as const)
    : [];
  return (
    <button
      type="button"
      disabled={!inMonth}
      onClick={onSelect}
      className={cn(
        'relative flex min-h-24 flex-col gap-1 border-t border-l p-2 text-left transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        inMonth ? 'bg-card hover:bg-accent/60' : 'cursor-default bg-muted/30 text-muted-foreground/50',
        selected &&
          'relative z-10 bg-primary-soft/50 ring-2 ring-primary ring-inset hover:bg-primary-soft/50',
      )}
    >
      <span
        className={cn(
          'flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums',
          today && 'bg-primary text-primary-foreground',
        )}
      >
        {format(date, 'd')}
      </span>
      {inMonth && day && day.awaiting > 0 ? (
        <span
          className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-destructive px-1.5 py-0.5 text-[11px] font-semibold text-destructive-foreground shadow-xs"
          title={`${day.awaiting} still waiting for dispatch`}
        >
          <CalendarClock className="size-3" />
          {day.awaiting} left
        </span>
      ) : null}
      {inMonth && day && day.orders > 0 ? (
        <span className="text-xs font-semibold">
          {day.orders} {day.orders === 1 ? 'order' : 'orders'}
        </span>
      ) : null}
      {inMonth && day ? (
        <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
          {chips
            .filter(([, count]) => count > 0)
            .map(([key, count, dot]) => (
              <span key={key} className="inline-flex items-center gap-1" title={key}>
                <span className={cn('size-1.5 rounded-full', dot)} />
                {count}
              </span>
            ))}
        </span>
      ) : null}
      {inMonth && day && day.dispatchedOn > 0 ? (
        <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-medium text-info">
          <Truck className="size-3" />
          {day.dispatchedOn} sent
        </span>
      ) : null}
    </button>
  );
}

export function DeliveriesPage() {
  const navigate = useNavigate();
  const [bulk, setBulk] = useState(false);
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const todayIso = isoDate();
  const month = params.get('month') ?? todayIso.slice(0, 7);
  const selected = params.get('date') ?? (month === todayIso.slice(0, 7) ? todayIso : `${month}-01`);
  const view = (params.get('view') as View | null) ?? 'awaiting';
  const calendar = useDeliveryCalendar(month);
  const orders = useDeliveries(
    view === 'awaiting'
      ? { status: 'pending' }
      : { date: selected, by: view === 'dispatch' ? 'dispatch' : 'order' },
  );
  const actions = useOrderActions();
  const canUpdate = can('sales.update');

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

  const monthStart = parseISO(`${month}-01`);
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(monthStart), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 }),
  });
  const byDate = new Map((calendar.data?.days ?? []).map((d) => [d.date, d]));
  const sum = (key: 'orders' | 'dispatchedOn' | 'delivered' | 'awaiting') =>
    (calendar.data?.days ?? []).reduce((total, d) => total + d[key], 0);
  const goMonth = (offset: number) => {
    const next = format(addMonths(monthStart, offset), 'yyyy-MM');
    set({ month: next, date: next === todayIso.slice(0, 7) ? todayIso : `${next}-01` });
  };

  const rows = orders.data ?? [];
  const columns: ColumnDef<DeliveryOrder, unknown>[] = [
    {
      id: 'invoiceNo',
      header: 'Order',
      accessorKey: 'invoiceNo',
      meta: { hideable: false },
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.invoiceNo}</div>
          <div className="text-xs text-muted-foreground">booked {formatDate(row.original.date)}</div>
        </div>
      ),
    },
    {
      id: 'customer',
      header: 'Customer',
      accessorFn: (o) => `${o.customer?.name ?? ''} ${o.customer?.phone ?? ''}`,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.customer?.name ?? '—'}</div>
          <div className="text-xs text-muted-foreground tabular-nums">{row.original.customer?.phone}</div>
        </div>
      ),
    },
    {
      id: 'address',
      header: 'Deliver to',
      accessorFn: (o) => [o.customer?.address, o.city].filter(Boolean).join(', '),
      cell: ({ row }) => (
        <span
          className="block max-w-56 truncate text-sm"
          title={[row.original.customer?.address, row.original.city].filter(Boolean).join(', ') || undefined}
        >
          {[row.original.customer?.address, row.original.city].filter(Boolean).join(', ') || '—'}
        </span>
      ),
    },
    {
      id: 'items',
      header: 'Items',
      accessorFn: (o) => o.items.map((i) => `${i.name} x ${Number(i.qty)}`).join('; '),
      cell: ({ row }) => (
        <ul className="space-y-0.5 text-sm">
          {row.original.items.map((item, index) => (
            <li key={`${item.productId}-${index}`} className="flex items-center gap-1.5 whitespace-nowrap">
              {item.tracked ? <Tag className="size-3 text-muted-foreground" aria-label="Labelled" /> : null}
              {item.name}
              <span className="text-muted-foreground tabular-nums">× {formatQuantity(item.qty)}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      accessorKey: 'total',
      meta: { align: 'right' },
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{formatMoney(row.original.total)}</div>
          <StatusBadge status={row.original.paymentStatus} className="mt-1" />
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (o) => o.deliveryStatus ?? '',
      cell: ({ row }) => (
        <div>
          <DeliveryBadge status={row.original.deliveryStatus} />
          {row.original.dispatchedOn ? (
            <div className="mt-0.5 text-xs text-muted-foreground">
              sent {formatDate(row.original.dispatchedOn)}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right', hideable: false },
      cell: ({ row }) => {
        const o = row.original;
        return (
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            {o.deliveryStatus === 'pending' && canUpdate ? (
              <Button size="sm" onClick={() => actions.dispatch(o)}>
                <Truck />
                Dispatch
              </Button>
            ) : null}
            <RowActions
              actions={[
                { label: 'Open order', icon: Eye, onSelect: () => void navigate(`/sales/${o.id}`) },
                {
                  label: 'Print slip',
                  icon: Printer,
                  hidden: o.deliveryStatus === 'pending',
                  onSelect: () => void navigate(slipPrintPath(o)),
                },
                {
                  label: 'Mark returned',
                  icon: Undo2,
                  separatorBefore: true,
                  hidden:
                    !canUpdate || (o.deliveryStatus !== 'dispatched' && o.deliveryStatus !== 'delivered'),
                  onSelect: () => actions.returned(o),
                },
                {
                  label: 'Cancel order',
                  icon: Ban,
                  destructive: true,
                  separatorBefore: true,
                  hidden: !canUpdate || o.deliveryStatus !== 'pending',
                  onSelect: () => actions.cancel(o),
                },
              ]}
            />
          </div>
        );
      },
    },
  ];

  const selectedLabel = format(parseISO(selected), 'EEE d MMM');
  const dispatchedRows = rows.filter(
    (o) => o.deliveryStatus === 'dispatched' || o.deliveryStatus === 'delivered',
  );
  const pendingRows = rows.filter((o) => o.deliveryStatus === 'pending');
  const awaiting = calendar.data?.awaiting;

  return (
    <>
      <PageHeader
        title="Deliveries"
        description="Online orders by the day they were booked. Dispatch an order by scanning it; its stock leaves the inventory on the dispatch day."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <button type="button" className="text-left" onClick={() => set({ view: undefined })}>
          <StatCard
            label="Awaiting dispatch"
            value={awaiting ? formatCount(awaiting.orders) : '…'}
            hint={awaiting?.oldest ? `Oldest booked ${formatDate(awaiting.oldest)}` : 'Nothing waiting'}
            icon={CalendarClock}
            tone={awaiting && awaiting.orders > 0 ? 'warning' : undefined}
            className="h-full transition-colors hover:border-border-strong"
          />
        </button>
        <StatCard label="Booked this month" value={formatCount(sum('orders'))} icon={PackageCheck} />
        <StatCard label="Dispatched this month" value={formatCount(sum('dispatchedOn'))} icon={Truck} />
      </div>

      <section className="mb-6 overflow-hidden rounded-xl border bg-card shadow-xs">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Previous month"
              onClick={() => goMonth(-1)}
            >
              <ChevronLeft />
            </Button>
            <h2 className="min-w-36 text-center text-sm font-semibold">{format(monthStart, 'MMMM yyyy')}</h2>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Next month"
              onClick={() => goMonth(1)}
            >
              <ChevronRight />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => set({ month: todayIso.slice(0, 7), date: todayIso, view: 'order' })}
            >
              Today
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {(
              [
                ['Left to dispatch', 'bg-destructive'],
                ['Dispatched', 'bg-success'],
                ['Returned', 'bg-muted-foreground'],
              ] as const
            ).map(([label, dot]) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <span className={cn('size-2 rounded-full', dot)} />
                {label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-info">
              <Truck className="size-3.5" />
              Sent that day
            </span>
          </div>
        </header>
        {calendar.isLoading ? (
          <Skeleton className="m-4 h-96" />
        ) : (
          <div className="grid grid-cols-7 border-r border-b">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="border-t border-l bg-muted/50 px-2 py-1.5 text-xs font-medium text-muted-foreground"
              >
                {d}
              </div>
            ))}
            {days.map((date) => {
              const iso = format(date, 'yyyy-MM-dd');
              return (
                <DayCell
                  key={iso}
                  date={date}
                  day={byDate.get(iso)}
                  inMonth={isSameMonth(date, monthStart)}
                  selected={view !== 'awaiting' && iso === selected}
                  today={iso === todayIso}
                  onSelect={() => set({ date: iso, view: view === 'awaiting' ? 'order' : view })}
                />
              );
            })}
          </div>
        )}
      </section>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => set({ view: v === 'awaiting' ? undefined : v })}>
          <TabsList>
            <TabsTrigger value="awaiting">
              All awaiting dispatch{awaiting?.orders ? ` (${awaiting.orders})` : ''}
            </TabsTrigger>
            <TabsTrigger value="order">Booked {selectedLabel}</TabsTrigger>
            <TabsTrigger value="dispatch">Sent {selectedLabel}</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground">
          {view === 'order'
            ? 'Orders booked on this day, whenever they are dispatched.'
            : view === 'dispatch'
              ? 'Orders that left the inventory on this day.'
              : 'Every booked order still waiting, oldest first. Their stock is booked but still on the shelf.'}
        </p>
      </div>
      <DataTable
        columns={columns}
        data={orders.data ? rows : undefined}
        isLoading={orders.isLoading}
        isFetching={orders.isFetching}
        error={orders.error}
        onRetry={() => void orders.refetch()}
        getRowId={(o) => o.id}
        onRowClick={(o) => void navigate(`/sales/${o.id}`)}
        exportFileName={`deliveries-${view === 'awaiting' ? 'awaiting' : selected}`}
        emptyTitle={view === 'awaiting' ? 'Nothing is waiting for dispatch' : 'No online orders on this day'}
        totalsRow={{
          invoiceNo: `Total · ${rows.length} orders`,
          amount: formatMoney(rows.reduce((total, o) => total + Number(o.total), 0)),
        }}
        toolbar={
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            disabled={rows.length === 0}
            title={
              pendingRows.length
                ? 'Scan the labels of the waiting orders, dispatch them together and print their slips'
                : 'Print the slips of the dispatched orders in this list'
            }
            onClick={() =>
              pendingRows.length
                ? setBulk(true)
                : void navigate(`/print/delivery-slips?saleIds=${dispatchedRows.map((o) => o.id).join(',')}`)
            }
          >
            <Printer />
            {pendingRows.length
              ? `Scan & print ${pendingRows.length}`
              : `Print ${dispatchedRows.length || ''} slips`}
          </Button>
        }
      />
      {actions.dialogs}
      {bulk ? <BulkDispatchDialog orders={pendingRows} onClose={() => setBulk(false)} /> : null}
    </>
  );
}
