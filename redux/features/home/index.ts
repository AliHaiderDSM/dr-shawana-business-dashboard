import { baseApi, fromApi } from '@redux/api/baseApi';
import { BRANCH_OPTIONS_STALE_SECONDS, useGetBranchOptionsQuery } from '@redux/features/branches';
import { api, unwrap } from '@/lib/api/client';
import type { DashboardArgs, DashboardData, DashboardPeriod } from './types';

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
  }),
  overrideExisting: false,
});

export const { useGetDashboardQuery } = homeApi;

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
