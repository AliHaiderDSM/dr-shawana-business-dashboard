import { baseApi, fromApi, toApi } from '@redux/api/baseApi';
import type { TagType } from '@redux/api/tagTypes';
import { api, unwrap } from '@/lib/api/client';
import type { Schemas } from '@/lib/api/types';
import type {
  DecideStockRequestInput,
  UpdateStockRequestInput,
  DecideWriteOffInput,
  IncomingStock,
  IncomingStockStatus,
  StockRequestsGetData,
  StockRequestsPatchData,
  StockRequestsPostData,
  StockRequestStatus,
  WriteOffsQuery,
} from './types';

export * from './types';

const STOCK_REQUEST_TAGS: TagType[] = ['stock-requests', 'incoming-stock', 'stock', 'sidebar-badges'];

function requestReceiveIncomingStock({ transferNo, date }: { transferNo: string; date: string }) {
  return unwrap(
    api.POST('/branch/incoming-stock/{transferNo}/receive', {
      params: { path: { transferNo } },
      body: { date },
    }),
  ).then((r) => r.data);
}

function requestDecideWriteOff({ id, approve, note }: DecideWriteOffInput) {
  return unwrap(
    approve
      ? api.POST('/admin/write-offs/{id}/approve', {
          params: { path: { id } },
          body: { note: note ?? null },
        })
      : api.POST('/admin/write-offs/{id}/reject', {
          params: { path: { id } },
          body: { note: note ?? null },
        }),
  ).then((r) => r.data);
}

export const stockRequestsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getStockRequests: build.query<StockRequestsGetData<'/branch/stock-requests'>, StockRequestStatus | null>({
      queryFn: (status) =>
        fromApi<StockRequestsGetData<'/branch/stock-requests'>>(() =>
          unwrap(api.GET('/branch/stock-requests', { params: { query: status ? { status } : {} } })).then(
            (r) => r.data,
          ),
        ),
      providesTags: ['stock-requests'],
    }),
    getStockRequestCatalog: build.query<StockRequestsGetData<'/branch/stock-requests/catalog'>, string>({
      queryFn: (search) =>
        fromApi<StockRequestsGetData<'/branch/stock-requests/catalog'>>(() =>
          unwrap(
            api.GET('/branch/stock-requests/catalog', { params: { query: search ? { search } : {} } }),
          ).then((r) => r.data),
        ),
      providesTags: ['stock-requests'],
    }),
    getStockRequestCounts: build.query<StockRequestsGetData<'/admin/stock-requests/pending-count'>, void>({
      queryFn: () =>
        fromApi<StockRequestsGetData<'/admin/stock-requests/pending-count'>>(() =>
          unwrap(api.GET('/admin/stock-requests/pending-count')).then((r) => r.data),
        ),
      providesTags: ['stock-requests'],
    }),
    askStock: build.mutation<StockRequestsPostData<'/branch/stock-requests'>, Schemas['CreateStockRequest']>({
      queryFn: (body) =>
        toApi<StockRequestsPostData<'/branch/stock-requests'>>(() =>
          unwrap(api.POST('/branch/stock-requests', { body })).then((r) => r.data),
        ),
      invalidatesTags: (_r, error) => (error ? [] : STOCK_REQUEST_TAGS),
    }),
    updateStockRequest: build.mutation<
      StockRequestsPatchData<'/branch/stock-requests/{id}'>,
      UpdateStockRequestInput
    >({
      queryFn: ({ id, body }) =>
        toApi<StockRequestsPatchData<'/branch/stock-requests/{id}'>>(() =>
          unwrap(api.PATCH('/branch/stock-requests/{id}', { params: { path: { id } }, body })).then(
            (r) => r.data,
          ),
        ),
      invalidatesTags: (_r, error) => (error ? [] : STOCK_REQUEST_TAGS),
    }),
    withdrawStockRequest: build.mutation<StockRequestsPostData<'/branch/stock-requests/{id}/cancel'>, string>(
      {
        queryFn: (id) =>
          toApi<StockRequestsPostData<'/branch/stock-requests/{id}/cancel'>>(() =>
            unwrap(api.POST('/branch/stock-requests/{id}/cancel', { params: { path: { id } } })).then(
              (r) => r.data,
            ),
          ),
        invalidatesTags: (_r, error) => (error ? [] : STOCK_REQUEST_TAGS),
      },
    ),
    decideStockRequest: build.mutation<
      | StockRequestsPostData<'/admin/stock-requests/{id}/approve'>
      | StockRequestsPostData<'/admin/stock-requests/{id}/reject'>,
      DecideStockRequestInput
    >({
      queryFn: ({ id, approve, body }) =>
        toApi<
          | StockRequestsPostData<'/admin/stock-requests/{id}/approve'>
          | StockRequestsPostData<'/admin/stock-requests/{id}/reject'>
        >(() =>
          unwrap(
            approve
              ? api.POST('/admin/stock-requests/{id}/approve', { params: { path: { id } }, body })
              : api.POST('/admin/stock-requests/{id}/reject', { params: { path: { id } }, body }),
          ).then((r) => r.data),
        ),
      invalidatesTags: (_r, error) => (error ? [] : STOCK_REQUEST_TAGS),
    }),
    getIncomingStock: build.query<StockRequestsGetData<'/branch/incoming-stock'>, IncomingStockStatus | null>(
      {
        queryFn: (status) =>
          fromApi<StockRequestsGetData<'/branch/incoming-stock'>>(() =>
            unwrap(api.GET('/branch/incoming-stock', { params: { query: status ? { status } : {} } })).then(
              (r) => r.data,
            ),
          ),
        providesTags: ['incoming-stock'],
      },
    ),
    getIncomingTransferByNo: build.query<IncomingStock | null, string>({
      queryFn: (transferNo) =>
        fromApi<IncomingStock | null>(() =>
          unwrap(api.GET('/branch/incoming-stock', { params: { query: { transferNo } } })).then(
            (r) => r.data[0] ?? null,
          ),
        ),
      providesTags: ['stock-requests'],
    }),
    receiveIncomingStock: build.mutation<
      Awaited<ReturnType<typeof requestReceiveIncomingStock>>,
      { transferNo: string; date: string }
    >({
      queryFn: (args) => toApi(() => requestReceiveIncomingStock(args)),
      invalidatesTags: (_r, error) => (error ? [] : STOCK_REQUEST_TAGS),
    }),
    getWriteOffs: build.query<StockRequestsGetData<'/branch/inventory/write-offs'>, WriteOffsQuery>({
      queryFn: (query) =>
        fromApi<StockRequestsGetData<'/branch/inventory/write-offs'>>(() =>
          unwrap(api.GET('/branch/inventory/write-offs', { params: { query } })).then((r) => r.data),
        ),
      providesTags: ['stock'],
    }),
    getPendingWriteOffCount: build.query<
      StockRequestsGetData<'/admin/write-offs/pending-count'>['pending'],
      void
    >({
      queryFn: () =>
        fromApi<StockRequestsGetData<'/admin/write-offs/pending-count'>['pending']>(() =>
          unwrap(api.GET('/admin/write-offs/pending-count')).then((r) => r.data.pending),
        ),
      providesTags: ['stock'],
    }),
    reportWriteOffs: build.mutation<
      StockRequestsPostData<'/branch/inventory/write-offs'>,
      Schemas['ReportWriteOffs']
    >({
      queryFn: (body) =>
        toApi<StockRequestsPostData<'/branch/inventory/write-offs'>>(() =>
          unwrap(api.POST('/branch/inventory/write-offs', { body })).then((r) => r.data),
        ),
      invalidatesTags: (_r, error) => (error ? [] : STOCK_REQUEST_TAGS),
    }),
    decideWriteOff: build.mutation<Awaited<ReturnType<typeof requestDecideWriteOff>>, DecideWriteOffInput>({
      queryFn: (args) => toApi(() => requestDecideWriteOff(args)),
      invalidatesTags: (_r, error) => (error ? [] : STOCK_REQUEST_TAGS),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetStockRequestsQuery,
  useGetStockRequestCatalogQuery,
  useGetStockRequestCountsQuery,
  useAskStockMutation,
  useWithdrawStockRequestMutation,
  useDecideStockRequestMutation,
  useUpdateStockRequestMutation,
  useGetIncomingStockQuery,
  useGetIncomingTransferByNoQuery,
  useReceiveIncomingStockMutation,
  useGetWriteOffsQuery,
  useGetPendingWriteOffCountQuery,
  useReportWriteOffsMutation,
  useDecideWriteOffMutation,
} = stockRequestsApi;

export function useStockRequests(status?: StockRequestStatus) {
  return useGetStockRequestsQuery(status ?? null);
}

export function useStockRequestCatalog(search: string, enabled: boolean) {
  return useGetStockRequestCatalogQuery(search, { skip: !enabled });
}

export function useStockRequestCounts(enabled: boolean) {
  return useGetStockRequestCountsQuery(undefined, { skip: !enabled });
}

export function useIncomingStock(status?: IncomingStockStatus) {
  return useGetIncomingStockQuery(status ?? null);
}

export function useIncomingTransferByNo(transferNo: string) {
  return useGetIncomingTransferByNoQuery(transferNo, { skip: transferNo.length === 0 });
}

export function useWriteOffs(query: WriteOffsQuery) {
  return useGetWriteOffsQuery(query);
}

export function usePendingWriteOffCount(enabled: boolean) {
  return useGetPendingWriteOffCountQuery(undefined, { skip: !enabled });
}
