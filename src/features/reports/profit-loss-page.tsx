import { AlertTriangle, Download, Printer } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth/auth-context';
import { useBranchOptions } from '@/lib/auth/branches';
import { formatCompactMoney, formatMoney, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { downloadXlsx } from '@/lib/xlsx';
import { useGetProfitLossQuery, type ProfitFigures, type ProfitLossData } from '@redux/features/reports';

const ALL = 'all';
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const TOOLTIP_STYLE = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--popover-foreground)',
  fontSize: 12,
};
const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' };

const SERIES = [
  { key: 'revenue', label: 'Revenue', color: 'var(--chart-1)' },
  { key: 'cost', label: 'Cost', color: 'var(--chart-3)' },
  { key: 'profit', label: 'Profit', color: 'var(--chart-5)' },
] as const;

const LOSS_COLOR = 'var(--destructive)';
const profitTone = (value: string) => (Number(value) < 0 ? 'text-destructive' : '');

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-2xl font-semibold tracking-tight tabular-nums', tone)}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-xs print:break-inside-auto print:overflow-visible print:rounded-none print:shadow-none">
      <header className="border-b px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

function FigureCells({ row }: { row: ProfitFigures }) {
  return (
    <>
      <td className="px-3 py-2 text-right tabular-nums print:px-1 print:py-1">{formatMoney(row.revenue)}</td>
      <td className="px-3 py-2 text-right tabular-nums print:px-1 print:py-1">{formatMoney(row.cost)}</td>
      <td
        className={cn(
          'px-3 py-2 text-right font-semibold tabular-nums print:px-1 print:py-1',
          profitTone(row.profit),
        )}
      >
        {formatMoney(row.profit)}
      </td>
    </>
  );
}

const FIGURE_HEADERS = ['Revenue', 'Cost', 'Profit'];

function exportRows(data: ProfitLossData, periodName: string, branchName: string) {
  const figures = (r: ProfitFigures) => [Number(r.revenue), Number(r.cost), Number(r.profit)];
  return [
    [`Profit & loss · ${periodName} · ${branchName}`],
    [],
    ['Summary'],
    ['Received', Number(data.summary.received)],
    ['Refunds', Number(data.summary.refunds)],
    ['Revenue', Number(data.summary.revenue)],
    ['Cost of goods', Number(data.summary.cost)],
    ['Profit', Number(data.summary.profit)],
    ['Not received yet', Number(data.summary.notReceived)],
    [],
    ['Month', ...FIGURE_HEADERS],
    ...data.months.map((m) => [m.label, ...figures(m)]),
    [],
    [
      'Product',
      'Sold',
      'Returned',
      'List price',
      'Last cost',
      'Avg sale price',
      'Avg cost',
      ...FIGURE_HEADERS,
      'Cost estimated',
    ],
    ...data.products.map((p) => [
      p.product,
      Number(p.qtySold),
      Number(p.qtyReturned),
      p.listPrice ? Number(p.listPrice) : null,
      p.lastCost ? Number(p.lastCost) : null,
      p.avgSalePrice ? Number(p.avgSalePrice) : null,
      p.avgCost ? Number(p.avgCost) : null,
      ...figures(p),
      Number(p.estimatedQty) + Number(p.unknownQty) > 0 ? 'Yes' : '',
    ]),
    ...(data.branches.length
      ? [
          [],
          ['Branch', ...FIGURE_HEADERS],
          ...data.branches.map((b) => [`${b.code} ${b.name}`, ...figures(b)]),
        ]
      : []),
  ];
}

export function ProfitLossPage() {
  const { isSuperAdmin } = useAuth();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState<number | null>(new Date().getMonth() + 1);
  const [branchId, setBranchId] = useState<string | null>(null);
  const branches = useBranchOptions(isSuperAdmin);
  const sellingBranches = (branches.data ?? []).filter((b) => b.kind === 'branch');
  const report = useGetProfitLossQuery({ year, month, branchId }, { skip: !isSuperAdmin });

  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const data = report.data;
  const periodName = month ? `${MONTHS[month - 1]} ${year}` : `Year ${year}`;
  const branchName = branchId
    ? (sellingBranches.find((b) => b.id === branchId)?.name ?? 'Branch')
    : 'All branches';
  const flagged = data ? Number(data.summary.estimatedCostUnits) + Number(data.summary.unknownCostUnits) : 0;

  return (
    <div className="space-y-6 [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:space-y-3">
      <style>{'@media print { @page { size: A4 landscape; margin: 8mm; } }'}</style>
      <PageHeader
        title="Profit & loss"
        description="Product profit from the money received. Office sales count on their sale date, online orders on the day they are dispatched; cost is the unit cost of the batch that was sold."
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28" aria-label="Year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => thisYear - i).map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={month ? String(month) : ALL}
              onValueChange={(v) => setMonth(v === ALL ? null : Number(v))}
            >
              <SelectTrigger className="w-36" aria-label="Month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Whole year</SelectItem>
                {MONTHS.map((name, i) => (
                  <SelectItem key={name} value={String(i + 1)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={branchId ?? ALL} onValueChange={(v) => setBranchId(v === ALL ? null : v)}>
              <SelectTrigger className="w-44" aria-label="Branch">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All branches</SelectItem>
                {sellingBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={!data}
              onClick={() =>
                data &&
                downloadXlsx(
                  exportRows(data, periodName, branchName),
                  `profit-loss-${year}${month ? `-${String(month).padStart(2, '0')}` : ''}`,
                  'Profit & loss',
                )
              }
            >
              <Download />
              Excel
            </Button>
            <Button variant="outline" disabled={!data} onClick={() => window.print()}>
              <Printer />
              Print
            </Button>
          </div>
        }
      />

      {report.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : report.error || !data ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{periodName}</span> · {branchName} ·{' '}
            {data.summary.sales} sale{data.summary.sales === 1 ? '' : 's'}
          </div>

          {flagged > 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground print:hidden">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                {formatQuantity(data.summary.estimatedCostUnits)} unit(s) were sold from batches without a
                unit cost; the last known cost of the product is used for them.
                {Number(data.summary.unknownCostUnits) > 0
                  ? ` ${formatQuantity(data.summary.unknownCostUnits)} unit(s) have no cost at all and count as zero.`
                  : ''}{' '}
                These products are marked ⚠ below.
              </span>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 print:hidden">
            <Kpi
              label="Revenue"
              value={formatMoney(data.summary.revenue)}
              hint={`${formatMoney(data.summary.received)} received − ${formatMoney(data.summary.refunds)} refunds`}
            />
            <Kpi
              label="Cost of goods"
              value={formatMoney(data.summary.cost)}
              hint="Unit cost of the batches sold, less returns"
            />
            <Kpi
              label="Profit"
              value={formatMoney(data.summary.profit)}
              hint={
                Number(data.summary.profit) < 0
                  ? 'Loss: cost is more than the revenue'
                  : 'Revenue − cost of goods'
              }
              tone={Number(data.summary.profit) < 0 ? 'text-destructive' : 'text-success'}
            />
            <Kpi label="Billed" value={formatMoney(data.summary.invoiced)} hint="Sales value of the period" />
            <Kpi
              label="Not received yet"
              value={formatMoney(data.summary.notReceived)}
              hint="Unpaid or awaiting approval; not counted in revenue"
            />
          </div>

          <Section
            title={`Month by month · ${year}`}
            description="Revenue, cost and profit of every month of the year"
          >
            <div className="h-72 px-3 pt-4 print:hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.months.map((m) => ({
                    ...m,
                    revenue: Number(m.revenue),
                    cost: Number(m.cost),
                    profit: Number(m.profit),
                  }))}
                  barGap={2}
                  barCategoryGap="22%"
                >
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    tickFormatter={(v: number) => formatCompactMoney(v)}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
                    formatter={(value, name) => [formatMoney(Number(value)), String(name)]}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    itemSorter={(item) => SERIES.findIndex((series) => series.label === item.value)}
                    wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
                  />
                  {SERIES.map((s) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.label}
                      fill={s.color}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={18}
                    >
                      {s.key === 'profit'
                        ? data.months.map((m) => (
                            <Cell key={m.month} fill={Number(m.profit) < 0 ? LOSS_COLOR : s.color} />
                          ))
                        : null}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-sm print:text-[9px]">
                <thead>
                  <tr className="border-y bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-5 py-2 text-left font-medium print:px-1 print:py-1">Month</th>
                    {FIGURE_HEADERS.map((h) => (
                      <th key={h} className="px-3 py-2 text-right font-medium print:px-1 print:py-1">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.months.map((m, i) => (
                    <tr
                      key={m.month}
                      className={cn(
                        'border-b last:border-b-0',
                        month === i + 1 && 'bg-primary-soft/50 font-medium',
                      )}
                    >
                      <td className="px-5 py-2 print:px-1 print:py-1">{MONTHS[i]}</td>
                      <FigureCells row={m} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            title="Products"
            description={`${periodName} · most profitable first. ⚠ = cost estimated from the last known cost`}
          >
            {data.products.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                No product was sold in this period.
              </p>
            ) : (
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-sm print:text-[9px]">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                      <th className="px-5 py-2 text-left font-medium print:px-1 print:py-1">Product</th>
                      <th className="px-3 py-2 text-right font-medium print:px-1 print:py-1">Sold</th>
                      <th className="px-3 py-2 text-right font-medium print:px-1 print:py-1">Returned</th>
                      <th className="px-3 py-2 text-right font-medium print:px-1 print:py-1">List price</th>
                      <th className="px-3 py-2 text-right font-medium print:px-1 print:py-1">Last cost</th>
                      <th className="px-3 py-2 text-right font-medium print:px-1 print:py-1">
                        Avg sale price
                      </th>
                      <th className="px-3 py-2 text-right font-medium print:px-1 print:py-1">Avg cost</th>
                      {FIGURE_HEADERS.map((h) => (
                        <th key={h} className="px-3 py-2 text-right font-medium print:px-1 print:py-1">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((p) => {
                      const flaggedRow = Number(p.estimatedQty) + Number(p.unknownQty) > 0;
                      return (
                        <tr key={p.product} className="border-b last:border-b-0">
                          <td className="px-5 py-2 font-medium print:px-1 print:py-1">
                            {p.product}
                            {flaggedRow ? (
                              <span
                                className="ml-1 text-warning"
                                title="Cost estimated from the last known cost"
                              >
                                ⚠
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums print:px-1 print:py-1">
                            {formatQuantity(p.qtySold)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums print:px-1 print:py-1">
                            {Number(p.qtyReturned) ? formatQuantity(p.qtyReturned) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums print:px-1 print:py-1">
                            {p.listPrice ? formatMoney(p.listPrice) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums print:px-1 print:py-1">
                            {p.lastCost ? formatMoney(p.lastCost) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums print:px-1 print:py-1">
                            {p.avgSalePrice ? formatMoney(p.avgSalePrice) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums print:px-1 print:py-1">
                            {p.avgCost ? formatMoney(p.avgCost) : '—'}
                          </td>
                          <FigureCells row={p} />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {data.branches.length ? (
            <Section title="Branches" description={periodName}>
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-sm print:text-[9px]">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                      <th className="px-5 py-2 text-left font-medium print:px-1 print:py-1">Branch</th>
                      {FIGURE_HEADERS.map((h) => (
                        <th key={h} className="px-3 py-2 text-right font-medium print:px-1 print:py-1">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.branches.map((b) => (
                      <tr key={b.code} className="border-b last:border-b-0">
                        <td className="px-5 py-2 print:px-1 print:py-1">
                          <span className="font-medium">{b.name}</span>{' '}
                          <span className="text-xs text-muted-foreground">{b.code}</span>
                        </td>
                        <FigureCells row={b} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          ) : null}
        </>
      )}
    </div>
  );
}
