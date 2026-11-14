import { addDays, parseISO } from 'date-fns';
import {
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  HandCoins,
  Printer,
  Undo2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Fragment, useState, type CSSProperties, type ReactNode } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { PageNumbers } from '@/components/shared/page-numbers';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge, type Tone } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth/auth-context';
import { useBranchOptions } from '@/lib/auth/branches';
import { formatAmount, formatDate, formatMoney, isoDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { downloadXlsx } from '@/lib/xlsx';
import {
  useGetAppointmentMoneyQuery,
  type AppointmentMoneyEntry,
  type AppointmentMoneyLedger,
  type AppointmentMoneyState,
} from '@redux/features/reports';

const ALL = 'all';
const PALETTE = 8;

const STATE: Record<AppointmentMoneyState, { label: string; tone: Tone }> = {
  unpaid: { label: 'Unpaid', tone: 'danger' },
  advance: { label: 'Advance paid', tone: 'warning' },
  paid: { label: 'Fully paid', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  held: { label: 'Cancelled · held', tone: 'warning' },
  refunded: { label: 'Refunded', tone: 'info' },
};

const isCompleted = (r: AppointmentMoneyEntry) => r.kind !== 'refund' && r.appointment.status === 'completed';

const entryOf = (r: AppointmentMoneyEntry): { label: string; tone: Tone } =>
  r.kind === 'refund'
    ? { label: 'Refund', tone: 'danger' }
    : isCompleted(r)
      ? { label: 'Completed', tone: 'success' }
      : { label: 'Booking', tone: 'neutral' };

const DUE = { label: 'Due', tone: 'warning' as Tone };

const stateIn = (r: AppointmentMoneyEntry, afterVisit: boolean) =>
  afterVisit && isCompleted(r) && r.stateAfter === 'advance' ? DUE : STATE[r.stateAfter];

type Group = 'booked' | 'advance' | 'sale' | 'refund';
const groupOf = (r: AppointmentMoneyEntry): Group =>
  r.kind === 'balance' || r.kind === 'advance'
    ? r.stateAfter === 'paid'
      ? 'sale'
      : 'advance'
    : r.kind === 'booked' || r.kind === 'visit'
      ? 'booked'
      : r.kind;

interface TabContext {
  completed: Set<number>;
  gdn: Set<number>;
}

function latestPerAppointment(rows: AppointmentMoneyEntry[], keep: (r: AppointmentMoneyEntry) => boolean) {
  const latest = new Map<string, AppointmentMoneyEntry>();
  for (const r of rows) {
    if (r.kind === 'refund' || !keep(r)) continue;
    const seen = latest.get(r.appointment.id);
    if (!seen || r.sr > seen.sr) latest.set(r.appointment.id, r);
  }
  return [...latest.values()];
}

const isDues = (r: AppointmentMoneyEntry) => r.kind === 'balance' && r.date > r.appointment.visitDate;
const isDuesCleared = (r: AppointmentMoneyEntry) =>
  (r.kind === 'balance' || r.kind === 'advance') && r.stateAfter === 'paid' && r.fullyPaidHere;

function tabContext(
  rows: AppointmentMoneyEntry[],
  visits: AppointmentMoneyEntry[],
  period: { from: string; to: string } | null,
): TabContext {
  const inPeriod = (day: string) => !period || (day >= period.from && day <= period.to);
  const gdn = [...rows, ...visits].filter(
    (r) => isCompleted(r) && (inPeriod(r.appointment.visitDate) || isDues(r)),
  );
  return {
    completed: new Set(latestPerAppointment([...rows, ...visits], isCompleted).map((r) => r.sr)),
    gdn: new Set(gdn.map((r) => r.sr)),
  };
}

type Tab = 'all' | Group | 'dues' | 'completed' | 'gdn';
const TABS: {
  key: Tab;
  label: string;
  match: (r: AppointmentMoneyEntry, ctx: TabContext) => boolean;
}[] = [
  { key: 'all', label: 'All entries', match: (r) => r.kind !== 'visit' },
  { key: 'gdn', label: 'GDN', match: (r, ctx) => ctx.gdn.has(r.sr) },
  {
    key: 'booked',
    label: 'Bookings',
    match: (r) => r.kind === 'booked' && r.appointment.status !== 'completed',
  },
  { key: 'advance', label: 'Advance', match: (r) => groupOf(r) === 'advance' },
  {
    key: 'dues',
    label: 'Dues received',
    match: isDuesCleared,
  },
  {
    key: 'completed',
    label: 'Completed appointments',
    match: (r, ctx) => ctx.completed.has(r.sr),
  },
  { key: 'refund', label: 'Refunds', match: (r) => r.kind === 'refund' },
];
const matchOf = (tab: Tab, ctx: TabContext) => (r: AppointmentMoneyEntry) =>
  TABS.find((t) => t.key === tab)!.match(r, ctx);
const totalOf = (rows: AppointmentMoneyEntry[], group: Group) =>
  rows.filter((r) => groupOf(r) === group).reduce((total, r) => total + Number(r.amount), 0);
const countOf = (rows: AppointmentMoneyEntry[], group: Group) =>
  rows.filter((r) => groupOf(r) === group).length;

const shift = (date: string, days: number) => isoDate(addDays(parseISO(date), days));
const monthEnd = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
};

const colorOf = (appointmentNo: number) => `var(--booked-${(appointmentNo % PALETTE) + 1})`;
const tint = (appointmentNo: number, percent: number): CSSProperties => ({
  backgroundColor: `color-mix(in oklch, ${colorOf(appointmentNo)} ${percent}%, transparent)`,
});
const amount = (value: string) => (Number(value) ? formatAmount(value) : '—');
const PAGE_SIZE = 25;

function linksOf(rows: AppointmentMoneyEntry[]) {
  const byAppointment = new Map<string, AppointmentMoneyEntry[]>();
  for (const r of rows)
    byAppointment.set(r.appointment.id, [...(byAppointment.get(r.appointment.id) ?? []), r]);
  return (r: AppointmentMoneyEntry) => {
    const all = (byAppointment.get(r.appointment.id) ?? []).slice().sort((a, b) => a.sr - b.sr);
    return {
      part: `${all.findIndex((x) => x.sr === r.sr) + 1} of ${all.length}`,
      others: all
        .filter((x) => x.sr !== r.sr)
        .map((x) => x.sr)
        .join(', '),
    };
  };
}

function PaymentBreakdown({ entry }: { entry: AppointmentMoneyEntry }) {
  const signed = entry.appointment.history.map((m) =>
    m.kind === 'refund' ? -Number(m.amount) : Number(m.amount),
  );
  const lines = entry.appointment.history.map((m, index) => ({
    ...m,
    paidSoFar: signed.slice(0, index + 1).reduce((sum, value) => sum + value, 0),
  }));
  const fee = Number(entry.appointment.fee);
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-1 pr-3 text-left font-medium">Date</th>
            <th className="px-3 py-1 text-left font-medium">Payment</th>
            <th className="px-3 py-1 text-center font-medium">Amount</th>
            <th className="px-3 py-1 text-center font-medium">Method · account</th>
            <th className="px-3 py-1 text-center font-medium">Paid so far</th>
            <th className="px-3 py-1 text-center font-medium">Remaining</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {lines.map((m, index) => (
            <tr key={m.id} className={cn(m.id === entry.id && 'font-semibold')}>
              <td className="py-1.5 pr-3 whitespace-nowrap">{formatDate(m.date, 'dd MMM yyyy')}</td>
              <td className="px-3 py-1.5 whitespace-nowrap">
                {m.kind === 'refund'
                  ? 'Refund'
                  : m.paidSoFar >= fee && index > 0
                    ? 'Dues received'
                    : m.date < entry.appointment.visitDate
                      ? m.paidSoFar >= fee
                        ? 'Paid in full before the visit'
                        : 'Advance before the visit'
                      : m.paidSoFar >= fee
                        ? 'Paid in full'
                        : 'Part of the dues'}
                {m.id === entry.id ? <span className="ml-1 text-muted-foreground">(this entry)</span> : null}
              </td>
              <td
                className={cn(
                  'px-3 py-1.5 text-center tabular-nums',
                  m.kind === 'refund' && 'text-destructive',
                )}
              >
                {m.kind === 'refund' ? '− ' : ''}
                {formatAmount(m.amount)}
              </td>
              <td className="px-3 py-1.5 text-center">
                {m.method === 'online' ? 'Online' : m.method ? 'Cash' : '—'}
                {m.method === 'online' && m.account ? (
                  <span className="text-muted-foreground"> · {m.account}</span>
                ) : null}
              </td>
              <td className="px-3 py-1.5 text-center tabular-nums">{formatAmount(m.paidSoFar)}</td>
              <td className="px-3 py-1.5 text-center tabular-nums">
                {fee - m.paidSoFar > 0 ? formatAmount(fee - m.paidSoFar) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PatientName({ name }: { name: string | null }) {
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);
  if (!name) return <div className="font-medium">—</div>;
  return (
    <Tooltip open={open && cut} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <div
          className="max-w-30 truncate font-medium print:max-w-none print:whitespace-normal"
          onMouseEnter={(e) => setCut(e.currentTarget.scrollWidth > e.currentTarget.clientWidth)}
          onFocus={(e) => setCut(e.currentTarget.scrollWidth > e.currentTarget.clientWidth)}
        >
          {name}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" align="start">
        {name}
      </TooltipContent>
    </Tooltip>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint: ReactNode;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className={cn('flex size-7 items-center justify-center rounded-lg', accent)}>
          <Icon className="size-4" />
        </span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function exportRows(
  data: AppointmentMoneyLedger,
  rows: AppointmentMoneyEntry[],
  title: string,
  allBranches: boolean,
  afterVisit: boolean,
) {
  const link = linksOf([...data.rows, ...(data.visits ?? [])]);
  return [
    [title],
    [],
    [
      'Sr.',
      'Date',
      'Appointment',
      'Entry of appointment',
      'Other entries (Sr.)',
      'Visit date',
      'Patient',
      'Phone',
      'Doctor',
      ...(allBranches ? ['Branch'] : []),
      'Entry',
      'Amount',
      'Method',
      'Account',
      'Fee',
      'Paid so far',
      'Remaining',
      'Status',
    ],
    ...rows.map((r) => [
      r.sr,
      r.date,
      `APP#${r.appointment.appointmentNo}`,
      link(r).part,
      link(r).others || '—',
      r.appointment.visitDate,
      r.patient.name,
      r.patient.phone,
      r.doctor,
      ...(allBranches ? [r.branch.name] : []),
      entryOf(r).label,
      r.kind === 'refund' ? -Number(r.amount) : Number(r.amount),
      r.method,
      r.account,
      Number(r.appointment.fee),
      Number(r.paidAfter),
      Number(r.remainingAfter),
      stateIn(r, afterVisit).label,
    ]),
    [],
    ['Advance (not yet fully paid)', totalOf(data.rows, 'advance')],
    ['Sales (payments that cleared the fee)', totalOf(data.rows, 'sale')],
    ['Refunds', -Number(data.summary.refundAmount)],
    ['Net received', Number(data.summary.net)],
  ];
}

export function AppointmentMoneyPage() {
  const { isSuperAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const branches = useBranchOptions(isSuperAdmin);
  const selling = (branches.data ?? []).filter((b) => b.kind === 'branch');
  const today = isoDate();
  const viewParam = params.get('view');
  const view = viewParam === 'month' || viewParam === 'day' ? viewParam : 'all';
  const date = params.get('date') ?? today;
  const month = params.get('month') ?? today.slice(0, 7);
  const branchId = params.get('branch');
  const from = view === 'day' ? date : `${month}-01`;
  const to = view === 'day' ? date : monthEnd(month);
  const report = useGetAppointmentMoneyQuery(
    view === 'all' ? { all: 'true', branchId } : { from, to, branchId },
    { skip: !isSuperAdmin },
  );
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(1);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setOpened((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const set = (changes: Record<string, string | null>) => {
    setPage(1);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
  };

  const data = report.data;
  const allBranches = branchId === null;
  const title =
    view === 'all'
      ? 'Appointment payments · All dates'
      : view === 'day'
        ? `Appointment payments · ${formatDate(date, 'EEEE, dd MMMM yyyy')}`
        : `Appointment payments · ${formatDate(`${month}-01`, 'MMMM yyyy')}`;
  const visits = data?.visits ?? [];
  const pool = [...(data?.rows ?? []), ...visits];
  const context = tabContext(data?.rows ?? [], visits, view === 'all' ? null : { from, to });
  const rows = pool.filter(matchOf(tab, context)).sort((a, b) => b.date.localeCompare(a.date) || b.sr - a.sr);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const onPage = (index: number) => Math.floor(index / PAGE_SIZE) + 1 === current;
  const sumOf = (group: Group) => totalOf(rows, group);
  const advanceCount = countOf(data?.rows ?? [], 'advance');
  const saleCount = countOf(data?.rows ?? [], 'sale');

  return (
    <div className="space-y-6 [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:space-y-3">
      <style>{'@media print { @page { size: A4 landscape; margin: 8mm; } }'}</style>
      <PageHeader
        className="print:hidden"
        title="Appointment payments"
        description="Every booking, payment and refund as its own line; lines of one appointment share a colour, and Status is the payment state after that line. Bookings are not completed yet, Advance left the fee part paid, Dues received cleared it (click Fully paid for the breakdown), GDN is the completed visits and their dues."
      />
      <div className="-mt-2 flex flex-wrap items-center gap-2 print:hidden">
        <ToggleGroup
          type="single"
          variant="outline"
          value={view}
          onValueChange={(v) => v && set({ view: v === 'all' ? null : v })}
          aria-label="Report view"
        >
          {(['all', 'day', 'month'] as const).map((key) => (
            <ToggleGroupItem
              key={key}
              value={key}
              className="h-9 px-4 data-[state=on]:border-primary data-[state=on]:bg-primary-soft data-[state=on]:text-primary-soft-foreground"
            >
              {key === 'all' ? 'All' : key === 'day' ? 'Day' : 'Month'}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Select value={branchId ?? ALL} onValueChange={(v) => set({ branch: v === ALL ? null : v })}>
          <SelectTrigger className="w-48" aria-label="Branch">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All branches</SelectItem>
            {selling.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {view === 'day' ? (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous day"
              onClick={() => set({ date: shift(date, -1) })}
            >
              <ChevronLeft />
            </Button>
            <Input
              type="date"
              className="w-40"
              value={date}
              max={today}
              onChange={(e) =>
                e.target.value && set({ date: e.target.value === today ? null : e.target.value })
              }
              aria-label="Report date"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Next day"
              disabled={date >= today}
              onClick={() => set({ date: shift(date, 1) === today ? null : shift(date, 1) })}
            >
              <ChevronRight />
            </Button>
          </div>
        ) : view === 'month' ? (
          <Input
            type="month"
            className="w-44"
            value={month}
            max={today.slice(0, 7)}
            onChange={(e) => e.target.value && set({ month: e.target.value })}
            aria-label="Report month"
          />
        ) : null}
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            disabled={!data || rows.length === 0}
            onClick={() =>
              data &&
              downloadXlsx(
                exportRows(data, rows, title, allBranches, tab === 'gdn' || tab === 'completed'),
                view === 'all' ? 'appointment-payments-all' : `appointment-payments-${from}`,
                'Payments',
              )
            }
          >
            <Download />
            Excel
          </Button>
          <Button onClick={() => window.print()} disabled={!data}>
            <Printer />
            Print
          </Button>
        </div>
      </div>

      <div className="hidden text-base font-semibold print:block">{title}</div>

      {report.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : report.error || !data ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 print:hidden">
            <Kpi
              label="Bookings"
              value={data.summary.bookings}
              hint="Appointments booked in this period"
              icon={CalendarPlus}
              accent="bg-neutral-soft text-neutral-soft-foreground"
            />
            <Kpi
              label="Advance"
              value={formatMoney(totalOf(data.rows, 'advance'))}
              hint={`${advanceCount} entr${advanceCount === 1 ? 'y' : 'ies'} · fee still part paid after it`}
              icon={HandCoins}
              accent="bg-info-soft text-info-soft-foreground"
            />
            <Kpi
              label="Received"
              value={formatMoney(totalOf(data.rows, 'sale'))}
              hint={`${saleCount} entr${saleCount === 1 ? 'y' : 'ies'} · payments that cleared the fee`}
              icon={Wallet}
              accent="bg-primary-soft text-primary-soft-foreground"
            />
            <Kpi
              label="Refunds"
              value={formatMoney(data.summary.refundAmount)}
              hint={`${data.summary.refunds} refund${data.summary.refunds === 1 ? '' : 's'} on cancelled visits`}
              icon={Undo2}
              accent="bg-destructive-soft text-destructive-soft-foreground"
            />
            <Kpi
              label="Net received"
              value={formatMoney(data.summary.net)}
              hint="Advance + sales − refunds"
              icon={CheckCircle2}
              accent="bg-success-soft text-success-soft-foreground"
            />
          </div>

          <section className="overflow-hidden rounded-xl border bg-card shadow-xs print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
            <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2 print:hidden" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => {
                    setTab(t.key);
                    setPage(1);
                  }}
                  className={cn(
                    'rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground',
                    tab === t.key &&
                      'border-primary/30 bg-primary-soft font-semibold text-primary-soft-foreground hover:bg-primary-soft hover:text-primary-soft-foreground',
                  )}
                >
                  {t.label}{' '}
                  <span className="tabular-nums">({pool.filter((r) => t.match(r, context)).length})</span>
                </button>
              ))}
            </div>
            {rows.length === 0 ? (
              <EmptyState
                title="No entries"
                description="No appointment was booked, paid or refunded in this period."
              />
            ) : (
              <>
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-xs print:text-[9px]">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                        <th className="py-2 pr-2 pl-5 text-left font-medium">Sr.</th>
                        {view !== 'day' ? <th className="px-3 py-2 text-left font-medium">Date</th> : null}
                        <th className="px-3 py-2 text-left font-medium">Appointment</th>
                        <th className="px-3 py-2 text-left font-medium">Patient</th>
                        <th
                          className={cn(
                            'px-3 py-2 font-medium',
                            view !== 'day' ? 'text-center' : 'text-left',
                          )}
                        >
                          Doctor{allBranches ? ' · branch' : ''}
                        </th>
                        <th className="px-3 py-2 text-center font-medium">Entry</th>
                        <th className="px-3 py-2 text-center font-medium">Amount</th>
                        <th className="px-3 py-2 text-center font-medium">Method · account</th>
                        <th className="px-3 py-2 text-center font-medium">Fee</th>
                        <th className="px-3 py-2 text-center font-medium">Paid so far</th>
                        <th className="px-3 py-2 text-center font-medium">Remaining</th>
                        <th className="px-3 py-2 text-center font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, index) => {
                        const no = r.appointment.appointmentNo;
                        const key = `${r.kind}-${r.id}`;
                        const expandable = tab === 'dues' && r.stateAfter === 'paid';
                        const open = expandable && opened.has(key);
                        return (
                          <Fragment key={key}>
                            <tr
                              className={cn(
                                'border-b align-top last:border-b-0 print:table-row print:break-inside-avoid',
                                !onPage(index) && 'hidden',
                              )}
                              style={tint(no, 6)}
                            >
                              <td
                                className="py-2.5 pr-2 pl-4 text-muted-foreground tabular-nums"
                                style={{ borderLeft: `4px solid ${colorOf(no)}` }}
                              >
                                {r.sr}
                              </td>
                              {view !== 'day' ? (
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  {formatDate(r.date, view === 'all' ? 'dd MMM yyyy' : 'EEE dd MMM')}
                                </td>
                              ) : null}
                              <td className="px-3 py-2.5">
                                <span
                                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold whitespace-nowrap"
                                  style={tint(no, 20)}
                                >
                                  <span
                                    className="size-2 rounded-full"
                                    style={{ backgroundColor: colorOf(no) }}
                                  />
                                  APP#{no}
                                </span>
                                <div className="mt-1 whitespace-nowrap text-muted-foreground">
                                  Visit {formatDate(r.appointment.visitDate, 'dd MMM')}
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <PatientName name={r.patient.name} />
                                <div className="text-muted-foreground tabular-nums">{r.patient.phone}</div>
                              </td>
                              <td className={cn('px-3 py-2.5', view !== 'day' && 'text-center')}>
                                <div>{r.doctor ?? '—'}</div>
                                {allBranches ? (
                                  <div className="text-muted-foreground">{r.branch.name}</div>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <StatusBadge tone={entryOf(r).tone}>{entryOf(r).label}</StatusBadge>
                              </td>
                              <td
                                className={cn(
                                  'px-3 py-2.5 text-center font-semibold whitespace-nowrap tabular-nums',
                                  r.kind === 'refund' && 'text-destructive',
                                )}
                              >
                                {r.kind === 'booked' || r.kind === 'visit'
                                  ? '—'
                                  : `${r.kind === 'refund' ? '− ' : ''}${formatAmount(r.amount)}`}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {r.method ? (
                                  <span className="capitalize">
                                    {r.method === 'online' ? 'Online' : 'Cash'}
                                  </span>
                                ) : (
                                  '—'
                                )}
                                {r.method === 'online' && r.account ? (
                                  <div className="text-muted-foreground">{r.account}</div>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5 text-center tabular-nums">
                                {amount(r.appointment.fee)}
                              </td>
                              <td className="px-3 py-2.5 text-center tabular-nums">{amount(r.paidAfter)}</td>
                              <td className="px-3 py-2.5 text-center tabular-nums">
                                {amount(r.remainingAfter)}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {expandable ? (
                                  <button
                                    type="button"
                                    aria-expanded={open}
                                    onClick={() => toggle(key)}
                                    className="inline-flex items-center gap-1 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                  >
                                    <StatusBadge tone={STATE[r.stateAfter].tone}>
                                      {STATE[r.stateAfter].label}
                                    </StatusBadge>
                                    <ChevronDown
                                      className={cn(
                                        'size-3.5 text-muted-foreground transition-transform',
                                        open && 'rotate-180',
                                      )}
                                    />
                                  </button>
                                ) : (
                                  <StatusBadge tone={stateIn(r, tab === 'gdn' || tab === 'completed').tone}>
                                    {stateIn(r, tab === 'gdn' || tab === 'completed').label}
                                  </StatusBadge>
                                )}
                              </td>
                            </tr>
                            {open && onPage(index) ? (
                              <tr className="border-b print:hidden" style={tint(no, 3)}>
                                <td
                                  colSpan={view !== 'day' ? 12 : 11}
                                  className="px-4 py-3"
                                  style={{ borderLeft: `4px solid ${colorOf(no)}` }}
                                >
                                  <PaymentBreakdown entry={r} />
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30 font-semibold">
                        <td className="py-2 pr-3 pl-5" colSpan={view !== 'day' ? 6 : 5}>
                          {rows.length} entr{rows.length === 1 ? 'y' : 'ies'}
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap tabular-nums">
                          {formatAmount(sumOf('advance') + sumOf('sale') - sumOf('refund'))}
                        </td>
                        <td colSpan={5} className="px-3 py-2 text-center font-normal text-muted-foreground">
                          Advance {formatAmount(sumOf('advance'))} · Sales {formatAmount(sumOf('sale'))} ·
                          Refunds {formatAmount(sumOf('refund'))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {rows.length ? (
                  <div className="flex items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground print:hidden">
                    <span>
                      {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, rows.length)} of{' '}
                      {rows.length}
                    </span>
                    <PageNumbers page={current} totalPages={pages} onChange={setPage} />
                  </div>
                ) : null}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
