import { baseApi, fromApi, toApi } from '@redux/api/baseApi';
import type { TagType } from '@redux/api/tagTypes';
import { api, unwrap } from '@/lib/api/client';
import type {
  AskDiscountInput,
  DecideDiscountArgs,
  DiscountRequest,
  DiscountRequestsArg,
  DiscountRequestsQuery,
} from './types';

export type * from './types';

const INVALIDATES: TagType[] = ['discount-requests', 'sidebar-badges'];

const invalidate = (_result: unknown, error: unknown) => (error ? [] : INVALIDATES);

const requestAskDiscount = (body: AskDiscountInput) =>
  unwrap(api.POST('/branch/discount-requests', { body })).then((r) => r.data);

const requestWithdrawDiscount = (id: string) =>
  unwrap(api.POST('/branch/discount-requests/{id}/cancel', { params: { path: { id } } })).then((r) => r.data);

const requestDecideDiscount = ({ id, approve, note }: DecideDiscountArgs) =>
  unwrap(
    approve
      ? api.POST('/admin/discount-requests/{id}/approve', {
          params: { path: { id } },
          body: { note: note ?? null },
        })
      : api.POST('/admin/discount-requests/{id}/reject', {
          params: { path: { id } },
          body: { note: note ?? null },
        }),
  ).then((r) => r.data);

export const discountRequestsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDiscountRequests: build.query<DiscountRequest[], DiscountRequestsArg>({
      queryFn: ({ status, ids }) =>
        fromApi<DiscountRequest[]>(() =>
          unwrap(
            api.GET('/branch/discount-requests', {
              params: { query: { ...(status ? { status } : {}), ...(ids ? { ids } : {}) } },
            }),
          ).then((r) => r.data),
        ),
      providesTags: ['discount-requests'],
    }),
    getPendingDiscountCount: build.query<number, void>({
      queryFn: () =>
        fromApi<number>(() =>
          unwrap(api.GET('/admin/discount-requests/pending-count')).then((r) => r.data.pending),
        ),
      providesTags: ['discount-requests'],
    }),
    askDiscount: build.mutation<Awaited<ReturnType<typeof requestAskDiscount>>, AskDiscountInput>({
      queryFn: (body) => toApi(() => requestAskDiscount(body)),
      invalidatesTags: invalidate,
    }),
    withdrawDiscount: build.mutation<Awaited<ReturnType<typeof requestWithdrawDiscount>>, string>({
      queryFn: (id) => toApi(() => requestWithdrawDiscount(id)),
      invalidatesTags: invalidate,
    }),
    decideDiscount: build.mutation<Awaited<ReturnType<typeof requestDecideDiscount>>, DecideDiscountArgs>({
      queryFn: (args) => toApi(() => requestDecideDiscount(args)),
      invalidatesTags: invalidate,
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetDiscountRequestsQuery,
  useGetPendingDiscountCountQuery,
  useAskDiscountMutation,
  useWithdrawDiscountMutation,
  useDecideDiscountMutation,
} = discountRequestsApi;

export function useDiscountRequests(query: DiscountRequestsQuery, enabled = true) {
  const arg: DiscountRequestsArg = {
    status: query.status ?? null,
    ids: query.ids?.length ? query.ids.join(',') : null,
  };
  return useGetDiscountRequestsQuery(arg, { skip: !enabled });
}

export function usePendingDiscountCount(enabled: boolean) {
  return useGetPendingDiscountCountQuery(undefined, { skip: !enabled });
}
