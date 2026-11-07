import { baseApi, fromApi, toApi } from '@redux/api/baseApi';
import type { TagType } from '@redux/api/tagTypes';
import { api, unwrap } from '@/lib/api/client';
import type { DecideStockHoldArgs, ReportStockHoldInput, StockHold, StockHoldsQuery } from './types';

export type * from './types';

const INVALIDATES: TagType[] = ['stock-holds', 'stock-requests', 'stock', 'sales', 'sidebar-badges'];

const invalidate = (_result: unknown, error: unknown) => (error ? [] : INVALIDATES);

const clean = (query: StockHoldsQuery) =>
  Object.fromEntries(Object.entries(query).filter(([, v]) => v !== null && v !== undefined && v !== '')) as {
    status?: StockHold['status'];
    saleId?: string;
    stockRequestId?: string;
    search?: string;
  };

export const stockHoldsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getStockHolds: build.query<StockHold[], StockHoldsQuery>({
      queryFn: (query) =>
        fromApi<StockHold[]>(() =>
          unwrap(api.GET('/branch/stock-holds', { params: { query: clean(query) } })).then((r) => r.data),
        ),
      providesTags: ['stock-holds'],
    }),
    reportStockHold: build.mutation<StockHold, ReportStockHoldInput>({
      queryFn: (body) =>
        toApi<StockHold>(() => unwrap(api.POST('/branch/stock-holds', { body })).then((r) => r.data)),
      invalidatesTags: invalidate,
    }),
    decideStockHold: build.mutation<StockHold, DecideStockHoldArgs>({
      queryFn: ({ id, body }) =>
        toApi<StockHold>(() =>
          unwrap(api.POST('/branch/stock-holds/{id}/decide', { params: { path: { id } }, body })).then(
            (r) => r.data,
          ),
        ),
      invalidatesTags: invalidate,
    }),
  }),
  overrideExisting: false,
});

export const { useGetStockHoldsQuery, useReportStockHoldMutation, useDecideStockHoldMutation } =
  stockHoldsApi;

export function useStockHolds(query: StockHoldsQuery, enabled = true) {
  return useGetStockHoldsQuery(query, { skip: !enabled });
}
