import { baseApi, fromApi, toApi } from '@redux/api/baseApi';
import { createCrud } from '@redux/api/crud';
import type { TagType } from '@redux/api/tagTypes';
import { store } from '@redux/store';
import { api, jsonFormData, unwrap, uploadForm } from '@/lib/api/client';
import type {
  ApproveSalePaymentsArgs,
  BillData,
  CancelSaleOrderArgs,
  CreateSaleArgs,
  DeliveriesQuery,
  DeliverySlipsQuery,
  GdnReport,
  DeliverySlipsResult,
  DispatchSaleOrderArgs,
  OnlineCatalogQuery,
  RemoveSalePaymentArgs,
  Sale,
  SaleInput,
  SalePaymentProofArgs,
  SalesListResult,
  SaleUpdate,
  SaveSalePaymentArgs,
  SetSaleDeliveryArgs,
} from './types';

export type * from './types';

const DEPENDENTS: TagType[] = ['sales', 'stock', 'products', 'dashboard', 'returns', 'patients'];

const invalidateDependents = (_result: unknown, error: unknown) => (error ? [] : DEPENDENTS);

export const salesApi = createCrud<Sale, SaleInput, SaleUpdate>('sales', '/branch/sales', {
  invalidates: DEPENDENTS.slice(1),
});

const requestSetSaleDelivery = ({ id, status }: SetSaleDeliveryArgs) =>
  unwrap(api.POST('/branch/sales/{id}/delivery', { params: { path: { id } }, body: { status } })).then(
    (r) => r.data,
  );

const requestApproveSalePayments = ({ id, paymentIds }: ApproveSalePaymentsArgs) =>
  unwrap(
    api.POST('/branch/sales/{id}/payments/approve', {
      params: { path: { id } },
      body: paymentIds ? { paymentIds } : {},
    }),
  ).then((r) => r.data);

const requestDispatchSaleOrder = ({ id, date, serials }: DispatchSaleOrderArgs) =>
  unwrap(
    api.POST('/branch/sales/{id}/dispatch', {
      params: { path: { id } },
      body: { date, ...(serials.length ? { serials } : {}) },
    }),
  ).then((r) => r.data);

const requestCancelSaleOrder = ({ id, refund }: CancelSaleOrderArgs) =>
  unwrap(api.POST('/branch/sales/{id}/cancel', { params: { path: { id } }, body: { refund } })).then(
    (r) => r.data,
  );

const requestDeliveryCalendar = (month: string) =>
  unwrap(api.GET('/branch/sales/delivery-calendar', { params: { query: { month } } })).then((r) => r.data);

const requestDeliveries = (query: DeliveriesQuery) =>
  unwrap(api.GET('/branch/sales/deliveries', { params: { query } })).then((r) => r.data);

const requestOnlineCatalog = (query: OnlineCatalogQuery) =>
  unwrap(api.GET('/branch/sales/online-catalog', { params: { query } })).then((r) => r.data);

const requestSaveSalePayment = async ({ saleId, paymentId, body, proofs }: SaveSalePaymentArgs) => {
  if (!paymentId)
    return uploadForm<Sale>(`/branch/sales/${saleId}/payments`, jsonFormData(body, { proof: proofs }));
  const updated = await unwrap(
    api.PATCH('/branch/sales/{id}/payments/{paymentId}', {
      params: { path: { id: saleId, paymentId } },
      body,
    }),
  );
  if (proofs.length === 0) return updated.data;
  const form = new FormData();
  for (const file of proofs) form.append('proof', file);
  return uploadForm<Sale>(`/branch/sales/${saleId}/payments/${paymentId}/proof`, form);
};

const requestRemoveSalePayment = ({ saleId, paymentId }: RemoveSalePaymentArgs) =>
  unwrap(
    api.DELETE('/branch/sales/{id}/payments/{paymentId}', {
      params: { path: { id: saleId, paymentId } },
    }),
  );

const requestSalePaymentProofUrl = ({ saleId, paymentId, proofId }: SalePaymentProofArgs) =>
  unwrap(
    api.GET('/branch/sales/{id}/payments/{paymentId}/proofs/{proofId}/url', {
      params: { path: { id: saleId, paymentId, proofId } },
    }),
  ).then((r) => r.data);

const requestRemoveSalePaymentProof = ({ saleId, paymentId, proofId }: SalePaymentProofArgs) =>
  unwrap(
    api.DELETE('/branch/sales/{id}/payments/{paymentId}/proofs/{proofId}', {
      params: { path: { id: saleId, paymentId, proofId } },
    }),
  );

type Result<F extends (...args: never[]) => Promise<unknown>> = Awaited<ReturnType<F>>;

export const salesEndpointsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSales: build.query<SalesListResult, Record<string, unknown>>({
      queryFn: (query) =>
        fromApi(() => unwrap(api.GET('/branch/sales', { params: { query } })) as Promise<SalesListResult>),
      providesTags: ['sales'],
    }),
    createSale: build.mutation<Sale, CreateSaleArgs>({
      queryFn: ({ body, proofs }) =>
        toApi(() => uploadForm<Sale>('/branch/sales', jsonFormData(body, { paymentProofs: proofs }))),
      invalidatesTags: invalidateDependents,
    }),
    setSaleDelivery: build.mutation<Result<typeof requestSetSaleDelivery>, SetSaleDeliveryArgs>({
      queryFn: (args) => toApi(() => requestSetSaleDelivery(args)),
      invalidatesTags: invalidateDependents,
    }),
    approveSalePayments: build.mutation<Result<typeof requestApproveSalePayments>, ApproveSalePaymentsArgs>({
      queryFn: (args) => toApi(() => requestApproveSalePayments(args)),
      invalidatesTags: invalidateDependents,
    }),
    dispatchSaleOrder: build.mutation<Result<typeof requestDispatchSaleOrder>, DispatchSaleOrderArgs>({
      queryFn: (args) => toApi(() => requestDispatchSaleOrder(args)),
      invalidatesTags: invalidateDependents,
    }),
    cancelSaleOrder: build.mutation<Result<typeof requestCancelSaleOrder>, CancelSaleOrderArgs>({
      queryFn: (args) => toApi(() => requestCancelSaleOrder(args)),
      invalidatesTags: invalidateDependents,
    }),
    getDeliveryCalendar: build.query<Result<typeof requestDeliveryCalendar>, string>({
      queryFn: (month) => fromApi(() => requestDeliveryCalendar(month)),
      providesTags: ['sales'],
    }),
    getDeliveries: build.query<Result<typeof requestDeliveries>, DeliveriesQuery>({
      queryFn: (query) => fromApi(() => requestDeliveries(query)),
      providesTags: ['sales'],
    }),
    getOnlineCatalog: build.query<Result<typeof requestOnlineCatalog>, OnlineCatalogQuery>({
      queryFn: (query) => fromApi(() => requestOnlineCatalog(query)),
      providesTags: ['sales'],
    }),
    saveSalePayment: build.mutation<Result<typeof requestSaveSalePayment>, SaveSalePaymentArgs>({
      queryFn: (args) => toApi(() => requestSaveSalePayment(args)),
      invalidatesTags: invalidateDependents,
    }),
    removeSalePayment: build.mutation<unknown, RemoveSalePaymentArgs>({
      queryFn: (args) => toApi(() => requestRemoveSalePayment(args)),
      invalidatesTags: invalidateDependents,
    }),
    getSalePaymentProofUrl: build.query<Result<typeof requestSalePaymentProofUrl>, SalePaymentProofArgs>({
      queryFn: (args) => toApi(() => requestSalePaymentProofUrl(args)),
    }),
    removeSalePaymentProof: build.mutation<
      Result<typeof requestRemoveSalePaymentProof>,
      SalePaymentProofArgs
    >({
      queryFn: (args) => toApi(() => requestRemoveSalePaymentProof(args)),
      invalidatesTags: invalidateDependents,
    }),
    getSaleBill: build.query<BillData, string>({
      queryFn: (id) =>
        fromApi<BillData>(() =>
          unwrap(api.GET('/branch/sales/{id}/bill', { params: { path: { id } } })).then(
            (r) => r.data as unknown as BillData,
          ),
        ),
      providesTags: ['sales'],
    }),
    getGdnReport: build.query<GdnReport, { date: string; branchId?: string }>({
      queryFn: (query) =>
        fromApi<GdnReport>(() =>
          unwrap(api.GET('/branch/sales/gdn-report', { params: { query } })).then(
            (r) => r.data as unknown as GdnReport,
          ),
        ),
      providesTags: ['sales'],
    }),
    getDeliverySlips: build.query<DeliverySlipsResult, DeliverySlipsQuery>({
      queryFn: (query) =>
        fromApi<DeliverySlipsResult>(() =>
          unwrap(api.GET('/branch/sales/delivery-slips', { params: { query } })).then(
            (r) => r.data as unknown as DeliverySlipsResult,
          ),
        ),
      providesTags: ['sales'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSalesQuery,
  useLazyGetSalesQuery,
  useCreateSaleMutation,
  useSetSaleDeliveryMutation,
  useApproveSalePaymentsMutation,
  useDispatchSaleOrderMutation,
  useCancelSaleOrderMutation,
  useGetDeliveryCalendarQuery,
  useGetDeliveriesQuery,
  useGetOnlineCatalogQuery,
  useLazyGetOnlineCatalogQuery,
  useSaveSalePaymentMutation,
  useRemoveSalePaymentMutation,
  useLazyGetSalePaymentProofUrlQuery,
  useRemoveSalePaymentProofMutation,
  useGetSaleBillQuery,
  useGetDeliverySlipsQuery,
  useGetGdnReportQuery,
} = salesEndpointsApi;

export function useSales(query: Record<string, unknown>) {
  return useGetSalesQuery(query);
}

export function useDeliveryCalendar(month: string) {
  return useGetDeliveryCalendarQuery(month);
}

export function useDeliveries(query: DeliveriesQuery) {
  return useGetDeliveriesQuery(query);
}

export function useOnlineCatalog(query: OnlineCatalogQuery, enabled = true) {
  return useGetOnlineCatalogQuery(query, { skip: !enabled });
}

export function useBill(id: string) {
  return useGetSaleBillQuery(id, { skip: !id });
}

export function useGdnReport(date: string, branchId?: string, enabled = true) {
  return useGetGdnReportQuery(branchId ? { date, branchId } : { date }, { skip: !date || !enabled });
}

export function useDeliverySlips(query: DeliverySlipsQuery, enabled = true) {
  return useGetDeliverySlipsQuery(query, { skip: !enabled });
}

export function salePaymentProofUrl(
  saleId: string,
  paymentId: string,
  proofId: string,
): Promise<(typeof salesEndpointsApi.endpoints.getSalePaymentProofUrl)['Types']['ResultType']> {
  return store
    .dispatch(
      salesEndpointsApi.endpoints.getSalePaymentProofUrl.initiate(
        { saleId, paymentId, proofId },
        { subscribe: false, forceRefetch: true },
      ),
    )
    .unwrap();
}

export function fetchOnlineCatalog(
  query: OnlineCatalogQuery,
): Promise<(typeof salesEndpointsApi.endpoints.getOnlineCatalog)['Types']['ResultType']> {
  return store
    .dispatch(
      salesEndpointsApi.endpoints.getOnlineCatalog.initiate(query, { subscribe: false, forceRefetch: true }),
    )
    .unwrap();
}
