import { baseApi, fromApi } from '@redux/api/baseApi';
import { BRANCH_OPTIONS_STALE_SECONDS, useGetBranchOptionsQuery } from '@redux/features/branches';
import { api, unwrap } from '@/lib/api/client';
import type {
  DailyRevenueData,
  DashboardArgs,
  DashboardData,
  DashboardPeriod,
  TopProductsData,
  TopProductsRange,
} from './types';

export type * from './types';

export const homeApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDashboard: build.query<DashboardData, DashboardArgs>({
      queryFn: ({ year, from, to }) =>
        fromApi<DashboardData>(() =>
          unwrap(
            api.GET('/branch/dashboard', {
              params: {
                query: { year, ...(from !== null ? { from } : {}), ...(to !== null ? { to } : {}) },
              },
            }),
          ).then((r) => r.data as unknown as DashboardData),
        ),
      providesTags: ['dashboard'],
    }),
    getDailyRevenue: build.query<DailyRevenueData, string>({
      queryFn: (month) =>
        fromApi<DailyRevenueData>(() =>
          unwrap(api.GET('/branch/dashboard/daily-revenue', { params: { query: { month } } })).then(
            (r) => r.data as unknown as DailyRevenueData,
          ),
        ),
      providesTags: ['dashboard'],
    }),
    getTopProducts: build.query<TopProductsData, TopProductsRange>({
      queryFn: (range) =>
        fromApi<TopProductsData>(() =>
          unwrap(api.GET('/branch/dashboard/top-products', { params: { query: { range } } })).then(
            (r) => r.data as unknown as TopProductsData,
          ),
        ),
      providesTags: ['dashboard'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetDashboardQuery, useGetTopProductsQuery, useGetDailyRevenueQuery } = homeApi;

export function useDailyRevenue(month: string | null) {
  return useGetDailyRevenueQuery(month ?? '', { skip: !month });
}

export const MAX_COMPARISONS = 5;

export function useComparedRevenue(months: string[]) {
  const first = useDailyRevenue(months[0] ?? null);
  const second = useDailyRevenue(months[1] ?? null);
  const third = useDailyRevenue(months[2] ?? null);
  const fourth = useDailyRevenue(months[3] ?? null);
  const fifth = useDailyRevenue(months[4] ?? null);
  return [first, second, third, fourth, fifth].slice(0, Math.min(months.length, MAX_COMPARISONS));
}

export function useTopProducts(range: TopProductsRange) {
  return useGetTopProductsQuery(range, {
    pollingInterval: 60_000,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
  });
}

export function useDashboard(year: number, period: DashboardPeriod = {}) {
  return useGetDashboardQuery(
    { year, from: period.from ?? null, to: period.to ?? null },
    { pollingInterval: 60_000, skipPollingIfUnfocused: true, refetchOnFocus: true },
  );
}

export function useBranchCodes() {
  const query = useGetBranchOptionsQuery(undefined, {
    refetchOnMountOrArgChange: BRANCH_OPTIONS_STALE_SECONDS,
  });
  return { branches: new Map((query.data ?? []).map((b) => [b.code, b.id])) };
}
