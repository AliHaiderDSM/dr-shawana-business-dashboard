import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Panel } from '@/components/shared/panel';
import { formatQuantity, titleCase } from '@/lib/format';
import type { ReportData, ReportValue } from './api';

const TOOLTIP_STYLE = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--popover-foreground)',
};
const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' };
const PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
const PREFERRED = [/amount/i, /total/i, /received/i, /closing/i, /debit/i, /qty|quantity/i];
const MAX_DAYS = 45;

const toNumber = (value: ReportValue | undefined) => {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

function toIsoDate(value: ReportValue | undefined) {
  const text = String(value ?? '');
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const local = /^(\d{2})-(\d{2})-(\d{4})/.exec(text);
  return local ? `${local[3]}-${local[2]}-${local[1]}` : null;
}

function valueKeyOf(data: ReportData) {
  const numeric = Object.entries(data.totals ?? {})
    .filter(([, v]) => toNumber(v) !== null)
    .map(([k]) => k);
  for (const pattern of PREFERRED) {
    const match = numeric.find((k) => pattern.test(k));
    if (match) return match;
  }
  return numeric[0] ?? null;
}

const compact = (v: number) =>
  Math.abs(v) >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : Math.abs(v) >= 1000
      ? `${(v / 1000).toFixed(1)}K`
      : String(v);

function labelOf(data: ReportData, key: string) {
  return data.columns.find((c) => c.key === key)?.label ?? titleCase(key.replace(/([A-Z])/g, ' $1'));
}

function trendOf(data: ReportData, valueKey: string) {
  const dateKey = data.columns.find(
    (c) => /date/i.test(c.key) && data.rows.some((r) => toIsoDate(r[c.key])),
  )?.key;
  if (!dateKey) return null;
  const byDay = new Map<string, number>();
  for (const row of data.rows) {
    const day = toIsoDate(row[dateKey]);
    const value = toNumber(row[valueKey]);
    if (!day || value === null) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + value);
  }
  if (byDay.size < 2) return null;
  const monthly = byDay.size > MAX_DAYS;
  const grouped = new Map<string, number>();
  for (const [day, value] of byDay) {
    const key = monthly ? day.slice(0, 7) : day;
    grouped.set(key, (grouped.get(key) ?? 0) + value);
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ label: monthly ? key : key.slice(5), value: Math.round(value * 100) / 100 }));
}

function branchesOf(data: ReportData, valueKey: string) {
  if (!data.byBranch?.length) return null;
  const keys = Object.keys(data.byBranch[0] ?? {}).filter((k) => k !== 'branch');
  const key = keys.includes(valueKey)
    ? valueKey
    : keys.find((k) => toNumber(data.byBranch?.[0]?.[k]) !== null);
  if (!key) return null;
  return {
    key,
    points: data.byBranch.map((row) => ({ label: String(row.branch ?? ''), value: toNumber(row[key]) ?? 0 })),
  };
}

export function ReportCharts({ data }: { data: ReportData }) {
  const valueKey = valueKeyOf(data);
  if (!valueKey) return null;
  const trend = trendOf(data, valueKey);
  const branches = branchesOf(data, valueKey);
  if (!trend && !branches) return null;
  const valueLabel = labelOf(data, valueKey);
  const format = (v: number) => formatQuantity(v);

  return (
    <div className="mb-6 grid gap-6 lg:grid-cols-2">
      {trend ? (
        <Panel title={`${valueLabel} over time`} className={branches ? undefined : 'lg:col-span-2'}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <YAxis
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={compact}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
                  formatter={(value) => [format(Number(value)), valueLabel]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--chart-1)', stroke: 'var(--card)', strokeWidth: 2 }}
                  activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      ) : null}
      {branches ? (
        <Panel
          title={`${labelOf(data, branches.key)} by branch`}
          className={trend ? undefined : 'lg:col-span-2'}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={branches.points}
                margin={{ top: 8, right: 12, bottom: 0, left: 4 }}
                barCategoryGap="30%"
              >
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <YAxis
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={compact}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: 'var(--muted)' }}
                  formatter={(value) => [format(Number(value)), labelOf(data, branches.key)]}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {branches.points.map((point, index) => (
                    <Cell key={point.label} fill={PALETTE[index % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
