import { baseApi, fromApi, toApi } from '@redux/api/baseApi';
import type { TagType } from '@redux/api/tagTypes';
import { api, unwrap } from '@/lib/api/client';
import type { DecideReturnItemArgs, ResolveReturnItemArgs, ReturnInput, SetReturnRefundArgs } from './types';

export type * from './types';

const INVALIDATES: TagType[] = ['returns', 'stock', 'products', 'dashboard', 'sales', 'sidebar-badges'];

const invalidate = (_result: unknown, error: unknown) => (error ? [] : INVALIDATES);

const requestReturns = (query: Record<string, unknown>) =>
  unwrap(api.GET('/branch/returns', { params: { query } }));

const requestReturn = (id: string) =>
  unwrap(api.GET('/branch/returns/{id}', { params: { path: { id } } })).then((r) => r.data);

const requestReturnable = (saleId: string) =>
  unwrap(api.GET('/branch/returns/sale/{saleId}/returnable', { params: { path: { saleId } } })).then(
    (r) => r.data,
  );

const requestSaleSearch = (term: string) =>
  unwrap(
    api.GET('/branch/sales', {
      params: { query: { pageSize: 10, sort: '-date', ...(term ? { search: term } : {}) } },
    }),
  ).then((r) => r.data);

const requestCreateReturn = (body: ReturnInput) =>
  unwrap(api.POST('/branch/returns', { body })).then((r) => r.data);

const requestResolveReturnItem = ({ returnId, itemId, disposition, note }: ResolveReturnItemArgs) =>
  unwrap(
    api.POST('/branch/returns/{id}/items/{itemId}/resolve', {
      params: { path: { id: returnId, itemId } },
      body: { disposition, note },
    }),
  ).then((r) => r.data);

const requestDecideReturnItem = ({ returnId, itemId, approve, note, asSuperAdmin }: DecideReturnItemArgs) => {
  const init = { params: { path: { id: returnId, itemId } }, body: { note: note ?? null } };
  if (asSuperAdmin) {
    return unwrap(
      approve
        ? api.POST('/admin/returns/{id}/items/{itemId}/approve', init)
        : api.POST('/admin/returns/{id}/items/{itemId}/reject', init),
    ).then((r) => r.data);
  }
  return unwrap(
    approve
      ? api.POST('/branch/returns/{id}/items/{itemId}/approve', init)
      : api.POST('/branch/returns/{id}/items/{itemId}/reject', init),
  ).then((r) => r.data);
};

const requestSetReturnRefund = ({ returnId, refund }: SetReturnRefundArgs) =>
  unwrap(
    api.PUT('/branch/returns/{id}/refund', { params: { path: { id: returnId } }, body: { refund } }),
  ).then((r) => r.data);

const requestRemoveReturn = (id: string) =>
  unwrap(api.DELETE('/branch/returns/{id}', { params: { path: { id } } }));

type Result<F extends (...args: never[]) => Promise<unknown>> = Awaited<ReturnType<F>>;

export const returnsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getReturns: build.query<Result<typeof requestReturns>, Record<string, unknown>>({
      queryFn: (query) => fromApi(() => requestReturns(query)),
      providesTags: ['returns'],
    }),
    getReturn: build.query<Result<typeof requestReturn>, string>({
      queryFn: (id) => fromApi(() => requestReturn(id)),
      providesTags: ['returns'],
    }),
    getReturnable: build.query<Result<typeof requestReturnable>, string>({
      queryFn: (saleId) => fromApi(() => requestReturnable(saleId)),
      providesTags: ['returns'],
    }),
    searchSalesForReturn: build.query<Result<typeof requestSaleSearch>, string>({
      queryFn: (term) => fromApi(() => requestSaleSearch(term)),
      providesTags: ['sales'],
    }),
    createReturn: build.mutation<Result<typeof requestCreateReturn>, ReturnInput>({
      queryFn: (body) => toApi(() => requestCreateReturn(body)),
      invalidatesTags: invalidate,
    }),
    resolveReturnItem: build.mutation<Result<typeof requestResolveReturnItem>, ResolveReturnItemArgs>({
      queryFn: (args) => toApi(() => requestResolveReturnItem(args)),
      invalidatesTags: invalidate,
    }),
    decideReturnItem: build.mutation<Result<typeof requestDecideReturnItem>, DecideReturnItemArgs>({
      queryFn: (args) => toApi(() => requestDecideReturnItem(args)),
      invalidatesTags: invalidate,
    }),
    setReturnRefund: build.mutation<Result<typeof requestSetReturnRefund>, SetReturnRefundArgs>({
      queryFn: (args) => toApi(() => requestSetReturnRefund(args)),
      invalidatesTags: invalidate,
    }),
    removeReturn: build.mutation<unknown, string>({
      queryFn: (id) => toApi(() => requestRemoveReturn(id)),
      invalidatesTags: invalidate,
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetReturnsQuery,
  useGetReturnQuery,
  useGetReturnableQuery,
  useSearchSalesForReturnQuery,
  useCreateReturnMutation,
  useResolveReturnItemMutation,
  useDecideReturnItemMutation,
  useSetReturnRefundMutation,
  useRemoveReturnMutation,
} = returnsApi;

export function useReturns(query: Record<string, unknown>) {
  return useGetReturnsQuery(query);
}

export function useReturn(id: string | undefined) {
  return useGetReturnQuery(id ?? '', { skip: !id });
}

export function useReturnable(saleId: string | null) {
  return useGetReturnableQuery(saleId ?? '', { skip: !saleId });
}

export function useSaleSearch(search: string, enabled: boolean) {
  return useSearchSalesForReturnQuery(search.trim(), { skip: !enabled });
}
