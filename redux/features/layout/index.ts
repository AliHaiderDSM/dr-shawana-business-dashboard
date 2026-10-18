import { baseApi, toApi } from '@redux/api/baseApi';
import { api, unwrap } from '@/lib/api/client';
import type { SidebarBadges } from './types';

export const SIDEBAR_BADGES_POLL_MS = 30_000;

export const layoutApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSidebarBadges: build.query<SidebarBadges, void>({
      queryFn: () => toApi<SidebarBadges>(() => unwrap(api.GET('/branch/badges')).then((r) => r.data)),
      providesTags: ['sidebar-badges'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetSidebarBadgesQuery } = layoutApi;

export function useSidebarBadges(enabled: boolean) {
  return useGetSidebarBadgesQuery(undefined, {
    skip: !enabled,
    pollingInterval: SIDEBAR_BADGES_POLL_MS,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
  });
}
