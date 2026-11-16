import { useState } from 'react';
import { baseApi, fromApi, toApi } from '@redux/api/baseApi';
import { idempotencyHeaders } from '@/lib/api/idempotency';
import type { TagType } from '@redux/api/tagTypes';
import { api, jsonFormData, unwrap, uploadForm } from '@/lib/api/client';
import type {
  CreateReplacementArgs,
  CreateReturnArgs,
  CreateSaleReplacementArgs,
  DecideReplacementArgs,
  SaleReplacement,
  DecideReturnItemArgs,
  LabDecisionArgs,
  ResolveReturnItemArgs,
  SendReplacementArgs,
  SetReturnRefundArgs,
} from './types';

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

const SALE_PAGE = 25;

const requestSaleSearch = ({ term, page }: { term: string; page: number }) =>
  unwrap(
    api.GET('/branch/sales', {
      params: { query: { page, pageSize: SALE_PAGE, sort: '-date', ...(term ? { search: term } : {}) } },
    }),
  ).then((r) => ({ items: r.data, hasMore: page * SALE_PAGE < (r.meta?.total ?? 0) }));

const requestCreateReturn = ({ idempotencyKey, ...body }: CreateReturnArgs) =>
  unwrap(api.POST('/branch/returns', { body, headers: idempotencyHeaders(idempotencyKey) })).then(
    (r) => r.data,
  );

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

const requestReplacements = (query: Record<string, unknown>) =>
  unwrap(api.GET('/branch/replacements', { params: { query } }));

const requestReplacement = (id: string) =>
  unwrap(api.GET('/branch/replacements/{id}', { params: { path: { id } } })).then((r) => r.data);

const requestCreateReplacement = ({ returnId, idempotencyKey, files, ...body }: CreateReplacementArgs) =>
  uploadForm<SaleReplacement>(
    `/branch/returns/${returnId}/replacements`,
    jsonFormData(body, { files }),
    'POST',
    idempotencyHeaders(idempotencyKey),
  );

const requestCreateSaleReplacement = ({
  saleId,
  idempotencyKey,
  files,
  ...body
}: CreateSaleReplacementArgs) =>
  uploadForm<SaleReplacement>(
    `/branch/sales/${saleId}/replacements`,
    jsonFormData(body, { files }),
    'POST',
    idempotencyHeaders(idempotencyKey),
  );

const requestReplaceable = (saleId: string) =>
  unwrap(api.GET('/branch/sales/{id}/replaceable', { params: { path: { id: saleId } } })).then((r) => r.data);

const requestDecideReplacement = ({ replacementId, approve, note }: DecideReplacementArgs) =>
  unwrap(
    approve
      ? api.POST('/admin/replacements/{id}/approve', {
          params: { path: { id: replacementId } },
          body: { note },
        })
      : api.POST('/admin/replacements/{id}/reject', {
          params: { path: { id: replacementId } },
          body: { note },
        }),
  ).then((r) => r.data);

export const replacementFileUrl = (id: string, fileId: string) =>
  unwrap(api.GET('/branch/replacements/{id}/files/{fileId}/url', { params: { path: { id, fileId } } })).then(
    (r) => r.data,
  );

const requestSendReplacement = ({ replacementId, ...body }: SendReplacementArgs) =>
  unwrap(api.POST('/branch/replacements/{id}/send', { params: { path: { id: replacementId } }, body })).then(
    (r) => r.data,
  );

const requestRemoveReplacement = (id: string) =>
  unwrap(api.DELETE('/branch/replacements/{id}', { params: { path: { id } } }));

const requestLabReturns = (status: 'waiting' | 'done') =>
  unwrap(api.GET('/branch/lab-returns', { params: { query: { status } } })).then((r) => r.data);

const requestLabDecision = ({ itemId, ...body }: LabDecisionArgs) =>
  unwrap(api.POST('/branch/lab-returns/{itemId}/decide', { params: { path: { itemId } }, body })).then(
    (r) => r.data,
  );

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
    searchSalesForReturn: build.query<Result<typeof requestSaleSearch>, { term: string; page: number }>({
      queryFn: (args) => fromApi(() => requestSaleSearch(args)),
      serializeQueryArgs: ({ queryArgs }) => queryArgs.term,
      merge: (cached, incoming, { arg }) =>
        arg.page === 1
          ? incoming
          : { items: [...cached.items, ...incoming.items], hasMore: incoming.hasMore },
      forceRefetch: ({ currentArg, previousArg }) =>
        currentArg?.page !== previousArg?.page || currentArg?.term !== previousArg?.term,
      providesTags: ['sales'],
    }),
    createReturn: build.mutation<Result<typeof requestCreateReturn>, CreateReturnArgs>({
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
    getReplacements: build.query<Result<typeof requestReplacements>, Record<string, unknown>>({
      queryFn: (query) => fromApi(() => requestReplacements(query)),
      providesTags: ['returns'],
    }),
    getReplacement: build.query<Result<typeof requestReplacement>, string>({
      queryFn: (id) => fromApi(() => requestReplacement(id)),
      providesTags: ['returns'],
    }),
    createReplacement: build.mutation<Result<typeof requestCreateReplacement>, CreateReplacementArgs>({
      queryFn: (args) => toApi(() => requestCreateReplacement(args)),
      invalidatesTags: invalidate,
    }),
    createSaleReplacement: build.mutation<
      Result<typeof requestCreateSaleReplacement>,
      CreateSaleReplacementArgs
    >({
      queryFn: (args) => toApi(() => requestCreateSaleReplacement(args)),
      invalidatesTags: invalidate,
    }),
    getReplaceable: build.query<Result<typeof requestReplaceable>, string>({
      queryFn: (saleId) => fromApi(() => requestReplaceable(saleId)),
      providesTags: ['returns'],
    }),
    decideReplacement: build.mutation<Result<typeof requestDecideReplacement>, DecideReplacementArgs>({
      queryFn: (args) => toApi(() => requestDecideReplacement(args)),
      invalidatesTags: invalidate,
    }),
    sendReplacement: build.mutation<Result<typeof requestSendReplacement>, SendReplacementArgs>({
      queryFn: (args) => toApi(() => requestSendReplacement(args)),
      invalidatesTags: invalidate,
    }),
    removeReplacement: build.mutation<unknown, string>({
      queryFn: (id) => toApi(() => requestRemoveReplacement(id)),
      invalidatesTags: invalidate,
    }),
    getLabReturns: build.query<Result<typeof requestLabReturns>, 'waiting' | 'done'>({
      queryFn: (status) => fromApi(() => requestLabReturns(status)),
      providesTags: ['returns'],
    }),
    decideLabReturn: build.mutation<Result<typeof requestLabDecision>, LabDecisionArgs>({
      queryFn: (args) => toApi(() => requestLabDecision(args)),
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
  useGetReplacementsQuery,
  useGetReplacementQuery,
  useCreateReplacementMutation,
  useCreateSaleReplacementMutation,
  useGetReplaceableQuery,
  useDecideReplacementMutation,
  useSendReplacementMutation,
  useRemoveReplacementMutation,
  useGetLabReturnsQuery,
  useDecideLabReturnMutation,
} = returnsApi;

export function useReplacements(query: Record<string, unknown>, skip = false) {
  return useGetReplacementsQuery(query, { skip });
}

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
  const term = search.trim();
  const [paging, setPaging] = useState({ term, page: 1 });
  const page = paging.term === term ? paging.page : 1;
  const query = useSearchSalesForReturnQuery({ term, page }, { skip: !enabled });
  const result = query.data;
  return {
    data: result?.items,
    isFetching: query.isFetching,
    hasMore: Boolean(result?.hasMore),
    loadMore: () => {
      if (!query.isFetching && result?.hasMore) setPaging({ term, page: page + 1 });
    },
  };
}
