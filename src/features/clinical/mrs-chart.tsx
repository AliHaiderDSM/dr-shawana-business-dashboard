import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useMrsHistory } from '@/features/consultations/api';
import { formatDate } from '@/lib/format';

const SERIES = [
  { key: 'total', label: 'Total', color: 'var(--chart-1)' },
  { key: 'somatic', label: 'Somatic', color: 'var(--chart-2)' },
  { key: 'psychological', label: 'Psychological', color: 'var(--chart-3)' },
  { key: 'urogenital', label: 'Urogenital', color: 'var(--chart-4)' },
] as const;

export function MrsChart({ patientId }: { patientId: string }) {
  const history = useMrsHistory(patientId);
  if (history.isLoading) return <Skeleton className="h-56 w-full" />;
  const points = (history.data ?? []).map((entry) => ({
    date: formatDate(entry.date, 'dd MMM yy'),
    ...entry.scores,
  }));
  if (points.length === 0)
    return <p className="py-6 text-center text-sm text-muted-foreground">No MRS assessments saved yet.</p>;
  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 44]}
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--popover-foreground)',
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={s.key === 'total' ? 2.5 : 1.5}
              dot={{ r: 3, fill: s.color }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
