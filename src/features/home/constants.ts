import type { DashboardData } from '@redux/features/home/types';

export function isCustomPeriod(data: Pick<DashboardData, 'period' | 'month' | 'date'>) {
  return data.period.from !== `${data.month}-01` || data.period.to !== data.date;
}

export function periodLabel(data: Pick<DashboardData, 'period' | 'month' | 'date'>) {
  if (!isCustomPeriod(data)) return 'This month';
  const format = (value: string) => {
    const [y, m, d] = value.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };
  return data.period.from === data.period.to
    ? format(data.period.from)
    : `${format(data.period.from)} – ${format(data.period.to)}`;
}
