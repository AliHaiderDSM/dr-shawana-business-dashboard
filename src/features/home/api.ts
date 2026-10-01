import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';

interface PeriodAmount {
  count?: number;
  amount?: string;
  bills?: number;
  qty?: string;
  revenue?: string;
}

export interface DashboardData {
  date: string;
  month: string;
  period: { from: string; to: string };
  scope: 'branch' | 'all_branches';
  counts: { patients: number; products: number };
  sales?: { today: PeriodAmount; month: PeriodAmount };
  pendingDeliveries?: number;
  appointments?: { today: PeriodAmount; month: PeriodAmount };
  revenueSplit?: { month: string; sales: string; consultations: string };
  stock?: {
    today: { stockIn: string; stockOut: string };
    month: { stockIn: string; stockOut: string };
    lowStockCount: number;
  };
  charts: {
    year: number;
    months: string[];
    salesAmount?: string[];
    appointmentAmount?: string[];
    productSales?: { product: string; qty: string[] }[];
  };
  byBranch?: { branch: string; name: string; salesMonth: string; appointmentsMonth: string }[];
}

export interface DashboardPeriod {
  from?: string;
  to?: string;
}

export function useDashboard(year: number, period: DashboardPeriod = {}) {
  return useQuery({
    queryKey: ['dashboard', year, period.from ?? null, period.to ?? null],
    queryFn: () =>
      unwrap(api.GET('/branch/dashboard', { params: { query: { year, ...period } } })).then(
        (r) => r.data as unknown as DashboardData,
      ),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

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
