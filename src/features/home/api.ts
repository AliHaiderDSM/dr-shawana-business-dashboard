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

export function useDashboard(year: number) {
  return useQuery({
    queryKey: ['dashboard', year],
    queryFn: () =>
      unwrap(api.GET('/branch/dashboard', { params: { query: { year } } })).then(
        (r) => r.data as unknown as DashboardData,
      ),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}
