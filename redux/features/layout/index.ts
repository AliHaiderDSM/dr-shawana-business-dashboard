import { baseApi, toApi } from '@redux/api/baseApi';
import { api, unwrap } from '@/lib/api/client';
import type { TagType } from '@redux/api/tagTypes';
import type { BrowserSubscription } from '@/lib/web-push';
import type { SidebarBadges, StaffRealtime } from './types';

export const STAFF_PING_TAGS: TagType[] = [
  'sidebar-badges',
  'stock-requests',
  'incoming-stock',
  'stock',
  'discount-requests',
  'returns',
  'patient-requests',
];

export const layoutApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSidebarBadges: build.query<SidebarBadges, void>({
      queryFn: () => toApi<SidebarBadges>(() => unwrap(api.GET('/branch/badges')).then((r) => r.data)),
      providesTags: ['sidebar-badges'],
    }),
    getStaffRealtimeConfig: build.query<StaffRealtime | null, void>({
      queryFn: () =>
        toApi<StaffRealtime | null>(() => unwrap(api.GET('/branch/realtime/staff')).then((r) => r.data)),
      keepUnusedDataFor: 3600,
    }),
    getPushPublicKey: build.query<string | null, void>({
      queryFn: () =>
        toApi<string | null>(() =>
          unwrap(api.GET('/branch/push/public-key')).then((r) => r.data?.publicKey ?? null),
        ),
      keepUnusedDataFor: 3600,
    }),
    savePushSubscription: build.mutation<unknown, BrowserSubscription>({
      queryFn: (body) => toApi<unknown>(() => unwrap(api.POST('/branch/push/subscriptions', { body }))),
    }),
    removePushSubscription: build.mutation<unknown, string>({
      queryFn: (endpoint) =>
        toApi<unknown>(() => unwrap(api.POST('/branch/push/unsubscribe', { body: { endpoint } }))),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSidebarBadgesQuery,
  useGetStaffRealtimeConfigQuery,
  useGetPushPublicKeyQuery,
  useSavePushSubscriptionMutation,
  useRemovePushSubscriptionMutation,
} = layoutApi;

export function useSidebarBadges(enabled: boolean) {
  return useGetSidebarBadgesQuery(undefined, { skip: !enabled, refetchOnFocus: true });
}
