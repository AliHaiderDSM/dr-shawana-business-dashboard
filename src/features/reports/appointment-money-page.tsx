import { addDays, parseISO } from 'date-fns';
import {
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  HandCoins,
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
import { formatAmount, formatDate, formatMoney, isoDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { downloadXlsx } from '@/lib/xlsx';
import {
  useGetAppointmentMoneyQuery,
  type AppointmentMoneyEntry,
  type AppointmentMoneyKind,
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

const KIND: Record<AppointmentMoneyKind, { label: string; tone: Tone }> = {
  booked: { label: 'Booked', tone: 'neutral' },
  advance: { label: 'Advance', tone: 'info' },
  balance: { label: 'Balance', tone: 'success' },
  refund: { label: 'Refund', tone: 'danger' },
};

type Tab = 'all' | AppointmentMoneyKind;
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All entries' },
  { key: 'booked', label: 'Booked' },
  { key: 'advance', label: 'Advance' },
  { key: 'balance', label: 'Balance' },
  { key: 'refund', label: 'Refunds' },
];

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
) {
  const link = linksOf(data.rows);
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
      KIND[r.kind].label,
      r.kind === 'refund' ? -Number(r.amount) : Number(r.amount),
      r.method,
      r.account,
      Number(r.appointment.fee),
      Number(r.paidAfter),
      Number(r.remainingAfter),
      STATE[r.stateAfter].label,
    ]),
    [],
    ['Advance', Number(data.summary.advanceAmount)],
    ['Balance', Number(data.summary.balanceAmount)],
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
  const view = params.get('view') === 'month' ? 'month' : 'day';
  const date = params.get('date') ?? today;
  const month = params.get('month') ?? today.slice(0, 7);
  const branchId = params.get('branch');
  const from = view === 'day' ? date : `${month}-01`;
  const to = view === 'day' ? date : monthEnd(month);
  const report = useGetAppointmentMoneyQuery({ from, to, branchId }, { skip: !isSuperAdmin });
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(1);

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
    view === 'day'
      ? `Appointment payments · ${formatDate(date, 'EEEE, dd MMMM yyyy')}`
      : `Appointment payments · ${formatDate(`${month}-01`, 'MMMM yyyy')}`;
  const rows = (data?.rows ?? []).filter((r) => tab === 'all' || r.kind === tab).reverse();
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const onPage = (index: number) => Math.floor(index / PAGE_SIZE) + 1 === current;
  const sumOf = (kind: AppointmentMoneyKind) =>
    rows.filter((r) => r.kind === kind).reduce((total, r) => total + Number(r.amount), 0);

  return (
    <div className="space-y-6 [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:space-y-3">
      <style>{'@media print { @page { size: A4 landscape; margin: 8mm; } }'}</style>
      <PageHeader
        className="print:hidden"
        title="Appointment payments"
        description="Every booking, advance, balance and refund as its own entry. Entries of the same appointment share a colour. An advance is paid before the visit day, a balance on or after it."
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
        ) : (
          <Input
            type="month"
            className="w-44"
            value={month}
            max={today.slice(0, 7)}
            onChange={(e) => e.target.value && set({ month: e.target.value })}
            aria-label="Report month"
          />
        )}
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            disabled={!data || rows.length === 0}
            onClick={() =>
              data &&
              downloadXlsx(
                exportRows(data, rows, title, allBranches),
                `appointment-payments-${from}`,
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
              value={formatMoney(data.summary.advanceAmount)}
              hint={`${data.summary.advance} entr${data.summary.advance === 1 ? 'y' : 'ies'} before the visit day`}
              icon={HandCoins}
              accent="bg-info-soft text-info-soft-foreground"
            />
            <Kpi
              label="Balance"
              value={formatMoney(data.summary.balanceAmount)}
              hint={`${data.summary.balance} entr${data.summary.balance === 1 ? 'y' : 'ies'} · ${data.summary.fullyPaid} fully paid`}
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
              hint="Advance + balance − refunds"
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
                    'rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
                    tab === t.key && 'bg-muted text-foreground',
                  )}
                >
                  {t.label}{' '}
                  <span className="tabular-nums">
                    ({(data.rows ?? []).filter((r) => t.key === 'all' || r.kind === t.key).length})
                  </span>
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
                        {view === 'month' ? <th className="px-3 py-2 text-left font-medium">Date</th> : null}
                        <th className="px-3 py-2 text-left font-medium">Appointment</th>
                        <th className="px-3 py-2 text-left font-medium">Patient</th>
                        <th
                          className={cn(
                            'px-3 py-2 font-medium',
                            view === 'month' ? 'text-center' : 'text-left',
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
                        return (
                          <tr
                            key={`${r.kind}-${r.id}`}
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
                            {view === 'month' ? (
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                {formatDate(r.date, 'EEE dd MMM')}
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
                              <div className="font-medium">{r.patient.name ?? '—'}</div>
                              <div className="text-muted-foreground tabular-nums">{r.patient.phone}</div>
                            </td>
                            <td className={cn('px-3 py-2.5', view === 'month' && 'text-center')}>
                              <div>{r.doctor ?? '—'}</div>
                              {allBranches ? (
                                <div className="text-muted-foreground">{r.branch.name}</div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <StatusBadge tone={KIND[r.kind].tone}>{KIND[r.kind].label}</StatusBadge>
                            </td>
                            <td
                              className={cn(
                                'px-3 py-2.5 text-center font-semibold whitespace-nowrap tabular-nums',
                                r.kind === 'refund' && 'text-destructive',
                              )}
                            >
                              {r.kind === 'booked'
                                ? '—'
                                : `${r.kind === 'refund' ? '− ' : ''}${formatAmount(r.amount)}`}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {r.method ? <span className="capitalize">{r.method}</span> : '—'}
                              {r.account ? <div className="text-muted-foreground">{r.account}</div> : null}
                            </td>
                            <td className="px-3 py-2.5 text-center tabular-nums">
                              {amount(r.appointment.fee)}
                            </td>
                            <td className="px-3 py-2.5 text-center tabular-nums">{amount(r.paidAfter)}</td>
                            <td className="px-3 py-2.5 text-center tabular-nums">
                              {amount(r.remainingAfter)}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <StatusBadge tone={STATE[r.stateAfter].tone}>
                                {STATE[r.stateAfter].label}
                              </StatusBadge>
                              {r.fullyPaidHere ? (
                                <div className="mt-1 font-medium text-success">Cleared with this payment</div>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30 font-semibold">
                        <td className="py-2 pr-3 pl-5" colSpan={view === 'month' ? 6 : 5}>
                          {rows.length} entr{rows.length === 1 ? 'y' : 'ies'}
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap tabular-nums">
                          {formatAmount(sumOf('advance') + sumOf('balance') - sumOf('refund'))}
                        </td>
                        <td colSpan={5} className="px-3 py-2 text-center font-normal text-muted-foreground">
                          Advance {formatAmount(sumOf('advance'))} · Balance {formatAmount(sumOf('balance'))}{' '}
                          · Refunds {formatAmount(sumOf('refund'))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {pages > 1 ? (
                  <div className="flex items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground print:hidden">
                    <span>
                      {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, rows.length)} of{' '}
                      {rows.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label="Previous page"
                        disabled={current <= 1}
                        onClick={() => setPage(current - 1)}
                      >
                        <ChevronLeft />
                      </Button>
                      <span className="px-2 tabular-nums">
                        Page {current} of {pages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label="Next page"
                        disabled={current >= pages}
                        onClick={() => setPage(current + 1)}
                      >
                        <ChevronRight />
                      </Button>
                    </div>
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
