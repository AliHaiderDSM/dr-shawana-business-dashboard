import { addDays, parseISO } from 'date-fns';
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  HandCoins,
  History,
  Printer,
  Undo2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge, type Tone } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuth } from '@/lib/auth/auth-context';
import { useBranchOptions } from '@/lib/auth/branches';
import { formatDate, formatMoney, isoDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { downloadXlsx } from '@/lib/xlsx';
import {
  useGetAppointmentMoneyDayQuery,
  useGetAppointmentMoneyMonthQuery,
  type AppointmentMoneyDay,
  type AppointmentMoneyRow,
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

type DayView = 'all' | 'advance' | 'balance' | 'refunds' | 'due';

const shift = (date: string, days: number) => isoDate(addDays(parseISO(date), days));

const dayColor = (date: string) => {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return `var(--booked-${(((day % PALETTE) + PALETTE) % PALETTE) + 1})`;
};

const tint = (date: string, percent: number): CSSProperties => ({
  backgroundColor: `color-mix(in oklch, ${dayColor(date)} ${percent}%, transparent)`,
});

const money = (value: string) => (Number(value) ? formatMoney(value) : '—');

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

function dayExport(data: AppointmentMoneyDay, rows: AppointmentMoneyRow[], allBranches: boolean) {
  return [
    [`Appointment payments · ${formatDate(data.date, 'dd MMM yyyy')}`],
    [],
    [
      'Sr.',
      'Appointment',
      'Booked on',
      'Visit date',
      'Patient',
      'Phone',
      'Doctor',
      ...(allBranches ? ['Branch'] : []),
      'Fee',
      'Advance',
      'Paid today',
      'Refund today',
      'Total paid',
      'Remaining',
      'Held',
      'Status',
    ],
    ...rows.map((r) => [
      r.sr,
      `APP#${r.appointmentNo}`,
      r.bookedOn,
      r.visitDate,
      r.patient.name,
      r.patient.phone,
      r.doctor,
      ...(allBranches ? [r.branch.name] : []),
      Number(r.fee),
      Number(r.advance),
      Number(r.advanceToday) + Number(r.balanceToday),
      Number(r.refundToday),
      Number(r.totalPaid),
      Number(r.remaining),
      Number(r.held),
      STATE[r.state].label,
    ]),
  ];
}

function DayReport({
  date,
  branchId,
  onDate,
}: {
  date: string;
  branchId: string | null;
  onDate: (d: string) => void;
}) {
  const today = isoDate();
  const report = useGetAppointmentMoneyDayQuery({ date, branchId });
  const [view, setView] = useState<DayView>('all');
  const data = report.data;

  if (report.isLoading) return <Skeleton className="h-96 w-full" />;
  if (report.error || !data) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />;

  const s = data.summary;
  const allBranches = branchId === null;
  const tabs: { key: DayView; label: string; match: (r: AppointmentMoneyRow) => boolean }[] = [
    { key: 'all', label: 'All', match: () => true },
    { key: 'advance', label: 'Advance today', match: (r) => Number(r.advanceToday) > 0 },
    { key: 'balance', label: 'Balance today', match: (r) => Number(r.balanceToday) > 0 },
    { key: 'refunds', label: 'Refunds', match: (r) => Number(r.refundToday) > 0 },
    { key: 'due', label: 'Still due', match: (r) => Number(r.dueAfter) > 0 },
  ];
  const rows = data.rows.filter(tabs.find((t) => t.key === view)!.match);
  const total = (pick: (r: AppointmentMoneyRow) => number) => rows.reduce((sum, r) => sum + pick(r), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous day"
            onClick={() => onDate(shift(date, -1))}
          >
            <ChevronLeft />
          </Button>
          <Input
            type="date"
            className="w-40"
            value={date}
            max={today}
            onChange={(e) => e.target.value && onDate(e.target.value)}
            aria-label="Report date"
          />
          <Button
            variant="outline"
            size="icon"
            aria-label="Next day"
            disabled={date >= today}
            onClick={() => onDate(shift(date, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
        {date !== today ? (
          <Button variant="ghost" onClick={() => onDate(today)}>
            Today
          </Button>
        ) : null}
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            disabled={rows.length === 0}
            onClick={() =>
              downloadXlsx(dayExport(data, rows, allBranches), `appointment-payments-${date}`, 'Day')
            }
          >
            <Download />
            Excel
          </Button>
          <Button onClick={() => window.print()}>
            <Printer />
            Print
          </Button>
        </div>
      </div>

      <div className="hidden text-base font-semibold print:block">
        Appointment payments · {formatDate(data.date, 'EEEE, dd MMMM yyyy')}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 print:hidden">
        <Kpi
          label="Due from earlier days"
          value={s.opening}
          hint={
            s.opening ? `${formatMoney(s.openingAmount)} owed at the start of the day` : 'Nothing was owed'
          }
          icon={History}
          accent="bg-warning-soft text-warning-soft-foreground"
        />
        <Kpi
          label="Advance today"
          value={formatMoney(s.advanceAmount)}
          hint={`${s.advance} appointment(s) paid before the visit · ${s.booked} booked today`}
          icon={HandCoins}
          accent="bg-info-soft text-info-soft-foreground"
        />
        <Kpi
          label="Balance today"
          value={formatMoney(s.balanceAmount)}
          hint={`${s.balance} appointment(s) paid on or after the visit`}
          icon={Wallet}
          accent="bg-primary-soft text-primary-soft-foreground"
        />
        <Kpi
          label="Fully paid today"
          value={s.fullyPaid}
          hint="Appointments whose whole fee came in today"
          icon={CheckCircle2}
          accent="bg-success-soft text-success-soft-foreground"
        />
        <Kpi
          label="Refunds today"
          value={formatMoney(s.refundAmount)}
          hint={`${s.refunds} cancelled appointment(s) · net received ${formatMoney(s.net)}`}
          icon={Undo2}
          accent="bg-destructive-soft text-destructive-soft-foreground"
        />
        <Kpi
          label="Still due tonight"
          value={s.closing}
          hint={
            s.closing
              ? `${formatMoney(s.closingAmount)} moves to ${formatDate(shift(date, 1), 'dd MMM')}`
              : 'All cleared'
          }
          icon={CalendarClock}
          accent="bg-neutral-soft text-neutral-soft-foreground"
        />
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-xs print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2 print:hidden" role="tablist">
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
              {t.label} <span className="tabular-nums">({data.rows.filter(t.match).length})</span>
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title="Nothing here"
            description="No appointment money moved for this view on this day."
          />
        ) : (
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-sm print:text-[10px]">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2 pl-5 font-medium">Sr.</th>
                  <th className="px-3 py-2 font-medium">Booked</th>
                  <th className="px-3 py-2 font-medium">Appointment</th>
                  <th className="px-3 py-2 font-medium">Patient</th>
                  <th className="px-3 py-2 font-medium">Doctor{allBranches ? ' · branch' : ''}</th>
                  <th className="px-3 py-2 text-right font-medium">Fee</th>
                  <th className="px-3 py-2 text-right font-medium">Advance</th>
                  <th className="px-3 py-2 text-right font-medium">Paid today</th>
                  <th className="px-3 py-2 text-right font-medium">Refund</th>
                  <th className="px-3 py-2 text-right font-medium">Total paid</th>
                  <th className="px-3 py-2 text-right font-medium">Remaining</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, index) => (
                  <tr
                    key={r.id}
                    className="border-b align-top last:border-b-0 print:break-inside-avoid"
                    style={tint(r.bookedOn, 5)}
                  >
                    <td
                      className="py-2.5 pr-2 pl-4 text-muted-foreground tabular-nums"
                      style={{ borderLeft: `4px solid ${dayColor(r.bookedOn)}` }}
                    >
                      {index + 1}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={tint(r.bookedOn, 18)}
                      >
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: dayColor(r.bookedOn) }}
                        />
                        {r.bookedOn === data.date ? 'Today' : formatDate(r.bookedOn, 'EEE dd MMM')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium whitespace-nowrap">APP#{r.appointmentNo}</div>
                      <div
                        className={cn(
                          'text-xs text-muted-foreground',
                          Number(r.dueAfter) > 0 && r.waitingDays >= 2 && 'font-semibold text-destructive',
                        )}
                      >
                        Visit {formatDate(r.visitDate, 'dd MMM')}
                        {Number(r.dueAfter) > 0 && r.waitingDays > 0 ? ` · ${r.waitingDays} day(s) ago` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{r.patient.name ?? '—'}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{r.patient.phone}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div>{r.doctor ?? '—'}</div>
                      {allBranches ? (
                        <div className="text-xs text-muted-foreground">{r.branch.name}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(r.fee)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(r.advance)}</td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                      {money(String(Number(r.advanceToday) + Number(r.balanceToday)))}
                      {r.methods.length ? (
                        <div className="text-xs font-normal text-muted-foreground capitalize">
                          {r.methods.join(', ')}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right text-destructive tabular-nums">
                      {money(r.refundToday)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(r.totalPaid)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                      {r.state === 'held' ? (
                        <span title="Received for a cancelled visit and not refunded">
                          held {formatMoney(r.held)}
                        </span>
                      ) : (
                        money(r.remaining)
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge tone={STATE[r.state].tone}>{STATE[r.state].label}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 font-semibold">
                  <td className="py-2 pr-3 pl-5" colSpan={5}>
                    {rows.length} appointment{rows.length === 1 ? '' : 's'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(total((r) => Number(r.fee)))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(total((r) => Number(r.advance)))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(total((r) => Number(r.advanceToday) + Number(r.balanceToday)))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(total((r) => Number(r.refundToday)))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(total((r) => Number(r.totalPaid)))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(total((r) => Number(r.remaining)))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function MonthReport({
  month,
  branchId,
  onMonth,
  onOpenDay,
}: {
  month: string;
  branchId: string | null;
  onMonth: (m: string) => void;
  onOpenDay: (d: string) => void;
}) {
  const report = useGetAppointmentMoneyMonthQuery({ month, branchId });
  const data = report.data;
  const thisMonth = isoDate().slice(0, 7);

  if (report.isLoading) return <Skeleton className="h-96 w-full" />;
  if (report.error || !data) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />;

  const t = data.totals;
  const exportRows = [
    [`Appointment payments · ${formatDate(`${month}-01`, 'MMMM yyyy')}`],
    [],
    [
      'Date',
      'Booked',
      'Advance',
      'Balance',
      'Refunds',
      'Net received',
      'Fully paid',
      'Still due',
      'Due amount',
    ],
    ...data.days.map((d) => [
      d.date,
      d.booked,
      Number(d.advance),
      Number(d.balance),
      Number(d.refunds),
      Number(d.net),
      d.fullyPaid,
      d.due,
      Number(d.dueAmount),
    ]),
    ['Total', t.booked, Number(t.advance), Number(t.balance), Number(t.refunds), Number(t.net), t.fullyPaid],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Input
          type="month"
          className="w-44"
          value={month}
          max={thisMonth}
          onChange={(e) => e.target.value && onMonth(e.target.value)}
          aria-label="Report month"
        />
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            onClick={() => downloadXlsx(exportRows, `appointment-payments-${month}`, 'Month')}
          >
            <Download />
            Excel
          </Button>
          <Button onClick={() => window.print()}>
            <Printer />
            Print
          </Button>
        </div>
      </div>

      <div className="hidden text-base font-semibold print:block">
        Appointment payments · {formatDate(`${month}-01`, 'MMMM yyyy')}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 print:hidden">
        <Kpi
          label="Booked"
          value={t.booked}
          hint="Appointments booked this month"
          icon={CalendarClock}
          accent="bg-neutral-soft text-neutral-soft-foreground"
        />
        <Kpi
          label="Advance"
          value={formatMoney(t.advance)}
          hint="Paid before the visit day"
          icon={HandCoins}
          accent="bg-info-soft text-info-soft-foreground"
        />
        <Kpi
          label="Balance"
          value={formatMoney(t.balance)}
          hint="Paid on or after the visit day"
          icon={Wallet}
          accent="bg-primary-soft text-primary-soft-foreground"
        />
        <Kpi
          label="Refunds"
          value={formatMoney(t.refunds)}
          hint="Paid back for cancelled visits"
          icon={Undo2}
          accent="bg-destructive-soft text-destructive-soft-foreground"
        />
        <Kpi
          label="Net received"
          value={formatMoney(t.net)}
          hint={`${t.fullyPaid} appointment(s) fully paid`}
          icon={CheckCircle2}
          accent="bg-success-soft text-success-soft-foreground"
        />
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-xs print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-sm print:text-[10px]">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 pl-5 font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Booked</th>
                <th className="px-3 py-2 text-right font-medium">Advance</th>
                <th className="px-3 py-2 text-right font-medium">Balance</th>
                <th className="px-3 py-2 text-right font-medium">Refunds</th>
                <th className="px-3 py-2 text-right font-medium">Net received</th>
                <th className="px-3 py-2 text-right font-medium">Fully paid</th>
                <th className="px-3 py-2 text-right font-medium">Still due tonight</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((d) => {
                const quiet =
                  !d.booked && !Number(d.advance) && !Number(d.balance) && !Number(d.refunds) && !d.due;
                return (
                  <tr
                    key={d.date}
                    className={cn(
                      'cursor-pointer border-b last:border-b-0 hover:bg-muted/40',
                      quiet && 'text-muted-foreground',
                    )}
                    onClick={() => onOpenDay(d.date)}
                    title="Open this day"
                  >
                    <td className="py-2 pr-3 pl-5 whitespace-nowrap">{formatDate(d.date, 'EEE dd MMM')}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{d.booked || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(d.advance)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(d.balance)}</td>
                    <td className="px-3 py-2 text-right text-destructive tabular-nums">{money(d.refunds)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{money(d.net)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{d.fullyPaid || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {d.due ? `${d.due} · ${formatMoney(d.dueAmount)}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td className="py-2 pr-3 pl-5">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{t.booked}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(t.advance)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(t.balance)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(t.refunds)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(t.net)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{t.fullyPaid}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

export function AppointmentMoneyPage() {
  const { isSuperAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const branches = useBranchOptions(isSuperAdmin);
  const selling = (branches.data ?? []).filter((b) => b.kind === 'branch');
  const today = isoDate();
  const view = params.get('view') === 'month' ? 'month' : 'day';
  const date = params.get('date') ?? today;
  const month = params.get('month') ?? today.slice(0, 7);
  const branchId = params.get('branch');

  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const set = (changes: Record<string, string | null>) =>
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

  return (
    <div className="space-y-6 [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:space-y-3">
      <style>{'@media print { @page { size: A4 landscape; margin: 8mm; } }'}</style>
      <PageHeader
        className="print:hidden"
        title="Appointment payments"
        description="Advances are payments taken before the visit day, balances on or after it. Fully paid means the whole fee came in. Refunds are paid back for cancelled visits."
      />
      <div className="-mt-2 flex flex-wrap items-center gap-2 print:hidden">
        <ToggleGroup
          type="single"
          variant="outline"
          value={view}
          onValueChange={(v) => v && set({ view: v === 'day' ? null : v })}
          aria-label="Report view"
        >
          {(['day', 'month'] as const).map((key) => (
            <ToggleGroupItem
              key={key}
              value={key}
              className="h-9 px-4 data-[state=on]:border-primary data-[state=on]:bg-primary-soft data-[state=on]:text-primary-soft-foreground"
            >
              {key === 'day' ? 'Day' : 'Month'}
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
      </div>
      {view === 'day' ? (
        <DayReport date={date} branchId={branchId} onDate={(d) => set({ date: d === today ? null : d })} />
      ) : (
        <MonthReport
          month={month}
          branchId={branchId}
          onMonth={(m) => set({ month: m })}
          onOpenDay={(d) => set({ view: null, date: d })}
        />
      )}
    </div>
  );
}
