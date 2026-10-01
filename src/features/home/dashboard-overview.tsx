import {
  CalendarDays,
  PackageX,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCompactMoney, formatCount, formatDate, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { isCustomPeriod, periodLabel, useDashboard, type DashboardData } from './api';
import { BranchComparison, PendingDeliveries, StockAlerts, TopProducts } from './dashboard-insights';

const SERIES = {
  sales: { label: 'Sales', color: 'var(--chart-1)' },
  appointments: { label: 'Appointments', color: 'var(--chart-2)' },
} as const;

const TOOLTIP_STYLE = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--popover-foreground)',
  fontSize: 12,
  boxShadow: 'var(--shadow-md)',
};

const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' };

type Tone = 'primary' | 'success' | 'info' | 'warning';

const CHIP_TONES: Record<Tone, string> = {
  primary: 'bg-primary-soft text-primary-soft-foreground',
  success: 'bg-success-soft text-success-soft-foreground',
  info: 'bg-info-soft text-info-soft-foreground',
  warning: 'bg-warning-soft text-warning-soft-foreground',
};

function Trend({ current, previous }: { current: number; previous: number }) {
  if (previous <= 0) return null;
  const change = ((current - previous) / previous) * 100;
  const up = change >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
        up
          ? 'bg-success-soft text-success-soft-foreground'
          : 'bg-destructive-soft text-destructive-soft-foreground',
      )}
    >
      <Icon className="size-3" />
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  footer,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone: Tone;
  footer?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <span
          className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', CHIP_TONES[tone])}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div className="text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
      {footer ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{footer}</div>
      ) : null}
    </div>
  );
}

function ChartCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col rounded-xl border bg-card shadow-xs', className)}>
      <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </header>
      <div className="flex-1 p-5">{children}</div>
    </section>
  );
}

const monthIndex = (data: DashboardData) => Number(data.month.slice(5, 7)) - 1;

function monthlyRevenue(data: DashboardData, index: number) {
  return Number(data.charts.salesAmount?.[index] ?? 0) + Number(data.charts.appointmentAmount?.[index] ?? 0);
}

function KpiRow({ data }: { data: DashboardData }) {
  const currentYear = Number(data.month.slice(0, 4)) === data.charts.year;
  const index = monthIndex(data);
  const revenueNow = Number(data.sales?.month.revenue ?? 0) + Number(data.appointments?.month.amount ?? 0);
  const custom = isCustomPeriod(data);
  const revenuePrevious = !custom && currentYear && index > 0 ? monthlyRevenue(data, index - 1) : 0;
  const suffix = custom ? 'in period' : 'this month';
  const hasRevenue = Boolean(data.sales || data.appointments);

  const cards: ReactNode[] = [];
  if (data.appointments)
    cards.push(
      <KpiCard
        key="appointments"
        label={`Appointments ${suffix}`}
        value={formatCount(data.appointments.month.count ?? 0)}
        icon={CalendarDays}
        tone="primary"
        footer={`${formatCount(data.appointments.today.count ?? 0)} today`}
      />,
    );
  cards.push(
    <KpiCard
      key="patients"
      label="Patients"
      value={formatCount(data.counts.patients)}
      icon={Users}
      tone="success"
      footer={data.scope === 'branch' ? 'Seen in or added by this branch' : 'Across all branches'}
    />,
  );
  if (hasRevenue)
    cards.push(
      <KpiCard
        key="revenue"
        label={`Revenue ${suffix}`}
        value={formatMoney(revenueNow)}
        icon={Wallet}
        tone="warning"
        footer={
          revenuePrevious > 0 ? (
            <>
              <Trend current={revenueNow} previous={revenuePrevious} />
              from last month
            </>
          ) : (
            'Sales and appointment payments'
          )
        }
      />,
    );
  if (data.stock)
    cards.push(
      <KpiCard
        key="low-stock"
        label="Low stock"
        value={formatCount(data.stock.lowStockCount)}
        icon={PackageX}
        tone="info"
        footer="Products at or below their alert level"
      />,
    );
  else if (data.pendingDeliveries !== undefined)
    cards.push(
      <KpiCard
        key="deliveries"
        label="Pending deliveries"
        value={formatCount(data.pendingDeliveries)}
        icon={Truck}
        tone="info"
        footer="Sales waiting to be delivered"
      />,
    );

  return (
    <div
      className={cn(
        'grid gap-px overflow-hidden rounded-xl border bg-border shadow-xs sm:grid-cols-2',
        cards.length >= 4 ? 'xl:grid-cols-4' : cards.length === 3 ? 'xl:grid-cols-3' : '',
      )}
    >
      {cards}
    </div>
  );
}

function RevenueChart({
  data,
  year,
  years,
  onYearChange,
}: {
  data: DashboardData;
  year: number;
  years: number[];
  onYearChange: (year: number) => void;
}) {
  const showSales = Boolean(data.charts.salesAmount);
  const showAppointments = Boolean(data.charts.appointmentAmount);
  const points = data.charts.months.map((month, i) => ({
    month: formatDate(`${month}-01`, 'MMM'),
    sales: Number(data.charts.salesAmount?.[i] ?? 0),
    appointments: Number(data.charts.appointmentAmount?.[i] ?? 0),
  }));
  const empty = points.every((p) => p.sales === 0 && p.appointments === 0);

  return (
    <ChartCard
      title="Monthly revenue"
      description="Payments received per month"
      className="xl:col-span-2"
      actions={
        <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
          <SelectTrigger size="sm" className="w-24" aria-label="Year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="relative h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(v: number) => formatCompactMoney(v)}
              domain={[0, (max: number) => Math.max(max, 1000)]}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
              formatter={(value, name) => [formatMoney(Number(value)), String(name)]}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: 12, paddingBottom: 12 }}
            />
            {showSales ? (
              <Line
                type="monotone"
                dataKey="sales"
                name={SERIES.sales.label}
                stroke={SERIES.sales.color}
                strokeWidth={2}
                dot={{ r: 4, fill: SERIES.sales.color, stroke: 'var(--card)', strokeWidth: 2 }}
                activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2 }}
              />
            ) : null}
            {showAppointments ? (
              <Line
                type="monotone"
                dataKey="appointments"
                name={SERIES.appointments.label}
                stroke={SERIES.appointments.color}
                strokeWidth={2}
                dot={{ r: 4, fill: SERIES.appointments.color, stroke: 'var(--card)', strokeWidth: 2 }}
                activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2 }}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
        {empty ? (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            No payments recorded in {year}.
          </p>
        ) : null}
      </div>
    </ChartCard>
  );
}

function RevenueSplit({ data }: { data: DashboardData }) {
  const slices = [
    {
      key: 'sales',
      ...SERIES.sales,
      value: Number(data.revenueSplit?.sales ?? data.sales?.month.revenue ?? 0),
    },
    {
      key: 'appointments',
      ...SERIES.appointments,
      value: Number(data.revenueSplit?.consultations ?? data.appointments?.month.amount ?? 0),
    },
  ].filter((s) => (s.key === 'sales' ? data.sales : data.appointments));
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  return (
    <ChartCard
      title="Revenue split"
      description={
        isCustomPeriod(data)
          ? periodLabel(data)
          : `This month · ${formatDate(`${data.month}-01`, 'MMMM yyyy')}`
      }
    >
      <div className="relative h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={
                total > 0 ? slices : [{ key: 'empty', label: 'No revenue', value: 1, color: 'var(--muted)' }]
              }
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={total > 0 && slices.length > 1 ? 2 : 0}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {(total > 0 ? slices : [{ key: 'empty', color: 'var(--muted)' }]).map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
            {total > 0 ? (
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value, name) => [formatMoney(Number(value)), String(name)]}
              />
            ) : null}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-lg font-semibold tabular-nums">{formatCompactMoney(total)}</span>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="ml-auto font-medium tabular-nums">{formatMoney(s.value)}</span>
            <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
              {total > 0 ? `${Math.round((s.value / total) * 100)}%` : '—'}
            </span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

function BranchRevenue({ rows, label }: { rows: NonNullable<DashboardData['byBranch']>; label: string }) {
  const points = rows.map((r) => ({
    branch: r.branch,
    name: r.name,
    sales: Number(r.salesMonth),
    appointments: Number(r.appointmentsMonth),
  }));
  return (
    <ChartCard
      title="Revenue by branch"
      description={`${label}, sales and appointment payments`}
      className="xl:col-span-3"
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 4 }} barCategoryGap="30%">
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="branch" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(v: number) => formatCompactMoney(v)}
              domain={[0, (max: number) => Math.max(max, 1000)]}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
              labelFormatter={(code) => points.find((p) => p.branch === code)?.name ?? String(code)}
              formatter={(value, name) => [formatMoney(Number(value)), String(name)]}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: 12, paddingBottom: 12 }}
            />
            <Bar
              dataKey="sales"
              name={SERIES.sales.label}
              stackId="revenue"
              fill={SERIES.sales.color}
              stroke="var(--card)"
              strokeWidth={2}
              maxBarSize={48}
            />
            <Bar
              dataKey="appointments"
              name={SERIES.appointments.label}
              stackId="revenue"
              fill={SERIES.appointments.color}
              stroke="var(--card)"
              strokeWidth={2}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function DashboardOverview() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [params, setParams] = useSearchParams();
  const period = { from: params.get('from') ?? undefined, to: params.get('to') ?? undefined };
  const dashboard = useDashboard(year, period);
  const setPeriod = ({ from, to }: { from?: string; to?: string }) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries({ from, to: to ?? from })) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  const years = Array.from({ length: 5 }, (_, i) => thisYear - i);

  if (dashboard.isLoading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="grid gap-6 xl:grid-cols-3">
          <Skeleton className="h-96 rounded-xl xl:col-span-2" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  if (dashboard.error || !dashboard.data)
    return <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />;

  const data = dashboard.data;
  const hasCharts = Boolean(data.charts.salesAmount || data.charts.appointmentAmount);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
        <DateRangePicker
          from={period.from}
          to={period.to}
          onChange={setPeriod}
          placeholder="This month"
          className="mr-auto sm:mr-2"
        />
        <span>
          {data.scope === 'all_branches' ? 'All branches' : 'This branch'} · updated at{' '}
          {formatDate(new Date(dashboard.dataUpdatedAt), 'h:mm a')}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Refresh dashboard"
          disabled={dashboard.isFetching}
          onClick={() => void dashboard.refetch()}
        >
          <RefreshCw className={cn(dashboard.isFetching && 'animate-spin')} />
        </Button>
      </div>
      <KpiRow data={data} />
      {hasCharts ? (
        <div className="grid gap-6 xl:grid-cols-3">
          <RevenueChart data={data} year={year} years={years} onYearChange={setYear} />
          <RevenueSplit data={data} />
          {data.byBranch?.length ? <BranchRevenue rows={data.byBranch} label={periodLabel(data)} /> : null}
          {data.byBranch?.length ? <BranchComparison rows={data.byBranch} label={periodLabel(data)} /> : null}
        </div>
      ) : null}
      {data.scope === 'branch' &&
      (data.charts.productSales || data.stock || data.pendingDeliveries !== undefined) ? (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {data.charts.productSales ? <TopProducts data={data} /> : null}
          {data.stock ? <StockAlerts data={data} /> : null}
          {data.pendingDeliveries !== undefined ? <PendingDeliveries count={data.pendingDeliveries} /> : null}
        </div>
      ) : null}
    </div>
  );
}
