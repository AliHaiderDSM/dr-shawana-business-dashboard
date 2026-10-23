import { useCallback } from 'react';
import { baseApi, fromApi, toApi } from '@redux/api/baseApi';
import { store } from '@redux/store';
import { api, jsonFormData, unwrap, uploadForm } from '@/lib/api/client';
import { STOCK_PATHS } from '@/features/inventory/constants';
import type {
  ConfirmStoreReceiptInput,
  ExpiryAlert,
  InventoryGetResponse,
  InventoryItem,
  InventoryItemDetail,
  InventoryPatchResponse,
  InventoryPostResponse,
  InventoryReport,
  InventoryReportQuery,
  LabelsPrintArgs,
  ProductBatchDetail,
  ProductLedger,
  RegisterLabelsInput,
  SerialSummary,
  StockDocument,
  StockDocumentInput,
  StockDocumentPage,
  StockDocumentUpdate,
  StockKind,
  StockOutReportQuery,
  StoreReceipt,
  StoreReceiptStatus,
  WriteOffInput,
} from './types';

export * from './types';

type StockOutReportParams = Omit<StockOutReportQuery, 'status'> & { status?: 'received' | 'on_the_way' };

async function fetchAllInventoryItems(query: Record<string, string>) {
  const items: InventoryItem[] = [];
  for (let page = 1; ; page += 1) {
    const result = await unwrap(
      api.GET('/branch/inventory/items', { params: { query: { ...query, page, pageSize: 100 } } }),
    );
    items.push(...result.data);
    if (page >= (result.meta?.totalPages ?? 1)) return items;
  }
}

async function getStockDocumentById(kind: StockKind, id: string) {
  const path = { params: { path: { id } } };
  const result =
    kind === 'in'
      ? await unwrap(api.GET('/branch/stock-ins/{id}', path))
      : await unwrap(api.GET('/branch/stock-outs/{id}', path));
  return result.data as StockDocument;
}

export type GrnEditStatus = 'pending' | 'approved' | 'rejected';

export interface GrnLineSnapshot {
  id: string;
  productId: string;
  productName: string;
  qty: string;
  batch: string | null;
  manufacturingDate: string | null;
  expiryDate: string | null;
  unitCost: string | null;
}

export interface GrnLineChange {
  id: string;
  qty?: string;
  batch?: string | null;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  unitCost?: string | null;
}

export interface GrnAddLine {
  productId: string;
  productName?: string;
  qty: string;
  batch?: string | null;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  unitCost?: string | null;
  labels?: 'none' | 'generate';
}

export interface GrnEditInput {
  note?: string | null;
  update: GrnLineChange[];
  add: GrnAddLine[];
  remove: string[];
}

interface GrnPerson {
  id: string;
  name: string;
  role: string;
}

export interface GrnEditRequest {
  id: string;
  grnNo: string;
  status: GrnEditStatus;
  changes: { update: GrnLineChange[]; add: GrnAddLine[]; remove: string[] };
  before: GrnLineSnapshot[];
  note: string | null;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  branchName: string;
  requestedBy: GrnPerson | null;
  decidedBy: GrnPerson | null;
}

export interface GrnEditResult {
  applied: boolean;
  request: GrnEditRequest | null;
}

export const inventoryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getStockDocuments: build.query<StockDocumentPage, { kind: StockKind; query: Record<string, unknown> }>({
      queryFn: ({ kind, query }) =>
        fromApi<StockDocumentPage>(async () => {
          const result =
            kind === 'in'
              ? await unwrap(api.GET('/branch/stock-ins', { params: { query } }))
              : await unwrap(api.GET('/branch/stock-outs', { params: { query } }));
          return result as StockDocumentPage;
        }),
      providesTags: ['stock'],
    }),
    getStockDocument: build.query<StockDocument, { kind: StockKind; id: string }>({
      queryFn: ({ kind, id }) => fromApi<StockDocument>(() => getStockDocumentById(kind, id)),
      providesTags: ['stock'],
    }),
    getStockDocumentsByIds: build.query<StockDocument[], { kind: StockKind; ids: string[] }>({
      queryFn: ({ kind, ids }) =>
        fromApi<StockDocument[]>(() => Promise.all(ids.map((id) => getStockDocumentById(kind, id)))),
      providesTags: ['stock'],
    }),
    createStockDocument: build.mutation<
      StockDocument[],
      { kind: StockKind; body: StockDocumentInput; files: File[] }
    >({
      queryFn: ({ kind, body, files }) =>
        toApi<StockDocument[]>(() =>
          uploadForm<StockDocument[]>(STOCK_PATHS[kind], jsonFormData(body, { files })),
        ),
      invalidatesTags: (_r, error) => (error ? [] : ['stock', 'products']),
    }),
    updateStockDocument: build.mutation<
      InventoryPatchResponse<'/branch/stock-ins/{id}'> | InventoryPatchResponse<'/branch/stock-outs/{id}'>,
      { kind: StockKind; id: string; body: StockDocumentUpdate }
    >({
      queryFn: ({ kind, id, body }) =>
        toApi<
          InventoryPatchResponse<'/branch/stock-ins/{id}'> | InventoryPatchResponse<'/branch/stock-outs/{id}'>
        >(() => {
          const init = { params: { path: { id } }, body };
          return kind === 'in'
            ? unwrap(api.PATCH('/branch/stock-ins/{id}', init))
            : unwrap(api.PATCH('/branch/stock-outs/{id}', init as never));
        }),
      invalidatesTags: (_r, error) => (error ? [] : ['stock', 'products']),
    }),
    removeStockDocument: build.mutation<unknown, { kind: StockKind; id: string }>({
      queryFn: ({ kind, id }) =>
        toApi<unknown>(() => {
          const init = { params: { path: { id } } };
          return kind === 'in'
            ? unwrap(api.DELETE('/branch/stock-ins/{id}', init))
            : unwrap(api.DELETE('/branch/stock-outs/{id}', init));
        }),
      invalidatesTags: (_r, error) => (error ? [] : ['stock', 'products']),
    }),
    addStockAttachments: build.mutation<StockDocument, { kind: StockKind; id: string; files: File[] }>({
      queryFn: ({ kind, id, files }) =>
        toApi<StockDocument>(() => {
          const form = new FormData();
          for (const file of files) form.append('files', file);
          return uploadForm<StockDocument>(`${STOCK_PATHS[kind]}/${id}/attachments`, form);
        }),
      invalidatesTags: (_r, error) => (error ? [] : ['stock', 'products']),
    }),
    removeStockAttachment: build.mutation<unknown, { kind: StockKind; id: string; attachmentId: string }>({
      queryFn: ({ kind, id, attachmentId }) =>
        toApi<unknown>(() => {
          const init = { params: { path: { id, attachmentId } } };
          return kind === 'in'
            ? unwrap(api.DELETE('/branch/stock-ins/{id}/attachments/{attachmentId}', init))
            : unwrap(api.DELETE('/branch/stock-outs/{id}/attachments/{attachmentId}', init));
        }),
      invalidatesTags: (_r, error) => (error ? [] : ['stock', 'products']),
    }),
    getStockAttachmentUrl: build.query<
      InventoryGetResponse<'/branch/stock-ins/{id}/attachments/{attachmentId}/url'>['data'],
      { kind: StockKind; id: string; attachmentId: string }
    >({
      queryFn: ({ kind, id, attachmentId }) =>
        fromApi<InventoryGetResponse<'/branch/stock-ins/{id}/attachments/{attachmentId}/url'>['data']>(
          async () => {
            const init = { params: { path: { id, attachmentId } } };
            const result =
              kind === 'in'
                ? await unwrap(api.GET('/branch/stock-ins/{id}/attachments/{attachmentId}/url', init))
                : await unwrap(api.GET('/branch/stock-outs/{id}/attachments/{attachmentId}/url', init));
            return result.data;
          },
        ),
      providesTags: ['stock'],
    }),
    getStockBalances: build.query<InventoryGetResponse<'/branch/inventory/stock'>, Record<string, unknown>>({
      queryFn: (query) =>
        fromApi<InventoryGetResponse<'/branch/inventory/stock'>>(() =>
          unwrap(api.GET('/branch/inventory/stock', { params: { query } })),
        ),
      providesTags: ['stock'],
    }),
    getExpiryAlerts: build.query<ExpiryAlert[], number>({
      queryFn: (days) =>
        fromApi<ExpiryAlert[]>(() =>
          unwrap(api.GET('/branch/inventory/expiry-alerts', { params: { query: { days } } })).then(
            (r) => r.data,
          ),
        ),
      providesTags: ['stock'],
    }),
    getInventoryReport: build.query<InventoryReport, InventoryReportQuery>({
      queryFn: (query) =>
        fromApi<InventoryReport>(() =>
          unwrap(api.GET('/branch/inventory/report', { params: { query } })).then((r) => r.data),
        ),
      providesTags: ['stock'],
    }),
    getProductLedger: build.query<
      ProductLedger,
      { productId: string; query: { from?: string; to?: string } }
    >({
      queryFn: ({ productId, query }) =>
        fromApi<ProductLedger>(() =>
          unwrap(
            api.GET('/branch/inventory/products/{productId}/ledger', {
              params: { path: { productId }, query },
            }),
          ).then((r) => r.data),
        ),
      providesTags: ['stock'],
    }),
    getProductBatches: build.query<
      InventoryGetResponse<'/branch/inventory/batches'>,
      Record<string, unknown>
    >({
      queryFn: (query) =>
        fromApi<InventoryGetResponse<'/branch/inventory/batches'>>(() =>
          unwrap(api.GET('/branch/inventory/batches', { params: { query } })),
        ),
      providesTags: ['stock'],
    }),
    getProductBatch: build.query<ProductBatchDetail, string>({
      queryFn: (id) =>
        fromApi<ProductBatchDetail>(() =>
          unwrap(api.GET('/branch/inventory/batches/{batchId}', { params: { path: { batchId: id } } })).then(
            (r) => r.data,
          ),
        ),
      providesTags: ['stock'],
    }),
    writeOffProductBatch: build.mutation<
      InventoryPostResponse<'/branch/inventory/batches/{batchId}/write-off'>,
      { batchId: string; body: WriteOffInput }
    >({
      queryFn: ({ batchId, body }) =>
        toApi<InventoryPostResponse<'/branch/inventory/batches/{batchId}/write-off'>>(() =>
          unwrap(
            api.POST('/branch/inventory/batches/{batchId}/write-off', {
              params: { path: { batchId } },
              body,
            }),
          ),
        ),
      invalidatesTags: (_r, error) => (error ? [] : ['stock', 'products']),
    }),
    getInventoryItems: build.query<InventoryGetResponse<'/branch/inventory/items'>, Record<string, unknown>>({
      queryFn: (query) =>
        fromApi<InventoryGetResponse<'/branch/inventory/items'>>(() =>
          unwrap(api.GET('/branch/inventory/items', { params: { query } })),
        ),
      providesTags: ['stock'],
    }),
    getInventoryItem: build.query<InventoryItemDetail, string>({
      queryFn: (id) =>
        fromApi<InventoryItemDetail>(() =>
          unwrap(api.GET('/branch/inventory/items/{itemId}', { params: { path: { itemId: id } } })).then(
            (r) => r.data,
          ),
        ),
      providesTags: ['stock'],
    }),
    getInventoryItemBySerial: build.query<
      InventoryGetResponse<'/branch/inventory/items/serial/{serial}'>['data'],
      { serial: string; everywhere?: boolean }
    >({
      queryFn: ({ serial, everywhere }) =>
        fromApi<InventoryGetResponse<'/branch/inventory/items/serial/{serial}'>['data']>(() =>
          unwrap(
            api.GET('/branch/inventory/items/serial/{serial}', {
              params: {
                path: { serial: serial.trim().toUpperCase() },
                ...(everywhere ? { query: { scope: 'all' as const } } : {}),
              },
            }),
          ).then((r) => r.data),
        ),
      providesTags: ['stock'],
    }),
    getProductSerialSummary: build.query<SerialSummary, string>({
      queryFn: (productId) =>
        fromApi<SerialSummary>(() =>
          unwrap(
            api.GET('/branch/inventory/products/{productId}/serials', {
              params: { path: { productId } },
            }),
          ).then((r) => r.data),
        ),
      providesTags: ['stock'],
    }),
    registerLabels: build.mutation<
      InventoryPostResponse<'/branch/inventory/items/register'>['data'],
      RegisterLabelsInput
    >({
      queryFn: (body) =>
        toApi<InventoryPostResponse<'/branch/inventory/items/register'>['data']>(() =>
          unwrap(api.POST('/branch/inventory/items/register', { body })).then((r) => r.data),
        ),
      invalidatesTags: (_r, error) => (error ? [] : ['stock', 'products']),
    }),
    getLabelBatches: build.query<
      InventoryGetResponse<'/branch/inventory/items/batches'>,
      Record<string, unknown>
    >({
      queryFn: (query) =>
        fromApi<InventoryGetResponse<'/branch/inventory/items/batches'>>(() =>
          unwrap(api.GET('/branch/inventory/items/batches', { params: { query } })),
        ),
      providesTags: ['stock'],
    }),
    getLabelsPrintItems: build.query<InventoryItem[], LabelsPrintArgs>({
      queryFn: ({ source, sourceIds, from, to, productId, batchId, withoutBatch }) =>
        fromApi<InventoryItem[]>(async () => {
          if (source && sourceIds.length) {
            const lists = await Promise.all(
              sourceIds.map((sourceId) => fetchAllInventoryItems({ source, sourceId })),
            );
            return lists.flat();
          }
          return fetchAllInventoryItems({
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
            ...(batchId ? { batchId } : {}),
            ...(productId && withoutBatch ? { productId, withoutBatch } : {}),
            ...(productId && !withoutBatch && !batchId ? { productId, status: 'in_stock' } : {}),
          });
        }),
      providesTags: ['stock'],
    }),
    getStoreReceipts: build.query<StoreReceipt[], StoreReceiptStatus | null>({
      queryFn: (status) =>
        fromApi<StoreReceipt[]>(() =>
          unwrap(api.GET('/branch/stock-receipts', { params: { query: status ? { status } : {} } })).then(
            (r) => r.data,
          ),
        ),
      providesTags: ['stock'],
    }),
    getStoreReceiptByGrn: build.query<StoreReceipt | null, string>({
      queryFn: (grnNo) =>
        fromApi<StoreReceipt | null>(() =>
          unwrap(api.GET('/branch/stock-receipts', { params: { query: { grnNo } } })).then(
            (r) => r.data[0] ?? null,
          ),
        ),
      providesTags: ['stock'],
    }),
    editStoreReceipt: build.mutation<GrnEditResult, { grnNo: string; body: GrnEditInput }>({
      queryFn: ({ grnNo, body }) =>
        toApi<GrnEditResult>(() =>
          unwrap(
            api.PUT('/branch/stock-receipts/{grnNo}/lines', {
              params: { path: { grnNo } },
              body: body as never,
            }),
          ).then((r) => r.data as unknown as GrnEditResult),
        ),
      invalidatesTags: (_r, error) => (error ? [] : ['stock', 'sidebar-badges']),
    }),
    getGrnEditRequests: build.query<GrnEditRequest[], GrnEditStatus | null>({
      queryFn: (status) =>
        fromApi<GrnEditRequest[]>(() =>
          unwrap(
            api.GET('/branch/stock-receipts/edit-requests', { params: { query: status ? { status } : {} } }),
          ).then((r) => r.data as unknown as GrnEditRequest[]),
        ),
      providesTags: ['stock'],
    }),
    decideGrnEdit: build.mutation<GrnEditRequest, { id: string; approve: boolean; note?: string | null }>({
      queryFn: ({ id, approve, note }) =>
        toApi<GrnEditRequest>(() =>
          unwrap(
            approve
              ? api.POST('/admin/stock-receipts/edit-requests/{id}/approve', {
                  params: { path: { id } },
                  body: { note: note ?? null },
                })
              : api.POST('/admin/stock-receipts/edit-requests/{id}/reject', {
                  params: { path: { id } },
                  body: { note: note ?? null },
                }),
          ).then((r) => r.data as unknown as GrnEditRequest),
        ),
      invalidatesTags: (_r, error) => (error ? [] : ['stock', 'sidebar-badges']),
    }),
    confirmStoreReceipt: build.mutation<
      InventoryPostResponse<'/branch/stock-receipts/{grnNo}/confirm'>,
      { grnNo: string; body: ConfirmStoreReceiptInput }
    >({
      queryFn: ({ grnNo, body }) =>
        toApi<InventoryPostResponse<'/branch/stock-receipts/{grnNo}/confirm'>>(() =>
          unwrap(api.POST('/branch/stock-receipts/{grnNo}/confirm', { params: { path: { grnNo } }, body })),
        ),
      invalidatesTags: (_r, error) => (error ? [] : ['stock', 'sidebar-badges']),
    }),
    getStockOutReport: build.query<
      InventoryGetResponse<'/branch/inventory/stock-out-report'>['data'],
      StockOutReportParams
    >({
      queryFn: (params) =>
        fromApi<InventoryGetResponse<'/branch/inventory/stock-out-report'>['data']>(() =>
          unwrap(api.GET('/branch/inventory/stock-out-report', { params: { query: params } })).then(
            (r) => r.data,
          ),
        ),
      providesTags: ['stock-out-report'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useEditStoreReceiptMutation,
  useGetGrnEditRequestsQuery,
  useDecideGrnEditMutation,
  useGetStockDocumentsQuery,
  useGetStockDocumentQuery,
  useGetStockDocumentsByIdsQuery,
  useCreateStockDocumentMutation,
  useUpdateStockDocumentMutation,
  useRemoveStockDocumentMutation,
  useAddStockAttachmentsMutation,
  useRemoveStockAttachmentMutation,
  useGetStockAttachmentUrlQuery,
  useLazyGetStockAttachmentUrlQuery,
  useGetStockBalancesQuery,
  useGetExpiryAlertsQuery,
  useGetInventoryReportQuery,
  useGetProductLedgerQuery,
  useGetProductBatchesQuery,
  useGetProductBatchQuery,
  useWriteOffProductBatchMutation,
  useGetInventoryItemsQuery,
  useGetInventoryItemQuery,
  useGetInventoryItemBySerialQuery,
  useLazyGetInventoryItemBySerialQuery,
  useGetProductSerialSummaryQuery,
  useRegisterLabelsMutation,
  useGetLabelBatchesQuery,
  useGetLabelsPrintItemsQuery,
  useGetStoreReceiptsQuery,
  useGetStoreReceiptByGrnQuery,
  useConfirmStoreReceiptMutation,
  useGetStockOutReportQuery,
} = inventoryApi;

export function useStockDocuments(kind: StockKind, query: Record<string, unknown>) {
  return useGetStockDocumentsQuery({ kind, query });
}

export function useStockDocument(kind: StockKind, id: string | undefined) {
  return useGetStockDocumentQuery({ kind, id: id ?? '' }, { skip: !id });
}

export function useStockDocumentsByIds(kind: StockKind, ids: string[]) {
  return useGetStockDocumentsByIdsQuery({ kind, ids }, { skip: ids.length === 0 });
}

export function useCreateStockDocument(kind: StockKind) {
  const [trigger, state] = useCreateStockDocumentMutation();
  const create = useCallback(
    (vars: { body: StockDocumentInput; files: File[] }) => trigger({ kind, ...vars }),
    [trigger, kind],
  );
  return [create, state] as const;
}

export function useUpdateStockDocument(kind: StockKind) {
  const [trigger, state] = useUpdateStockDocumentMutation();
  const update = useCallback(
    (vars: { id: string; body: StockDocumentUpdate }) => trigger({ kind, ...vars }),
    [trigger, kind],
  );
  return [update, state] as const;
}

export function useRemoveStockDocument(kind: StockKind) {
  const [trigger, state] = useRemoveStockDocumentMutation();
  const remove = useCallback((id: string) => trigger({ kind, id }), [trigger, kind]);
  return [remove, state] as const;
}

export function useAddStockAttachments(kind: StockKind) {
  const [trigger, state] = useAddStockAttachmentsMutation();
  const add = useCallback(
    (vars: { id: string; files: File[] }) => trigger({ kind, ...vars }),
    [trigger, kind],
  );
  return [add, state] as const;
}

export function useRemoveStockAttachment(kind: StockKind) {
  const [trigger, state] = useRemoveStockAttachmentMutation();
  const remove = useCallback(
    (vars: { id: string; attachmentId: string }) => trigger({ kind, ...vars }),
    [trigger, kind],
  );
  return [remove, state] as const;
}

export function stockAttachmentUrl(
  kind: StockKind,
  id: string,
  attachmentId: string,
): Promise<(typeof inventoryApi.endpoints.getStockAttachmentUrl)['Types']['ResultType']> {
  return store
    .dispatch(
      inventoryApi.endpoints.getStockAttachmentUrl.initiate(
        { kind, id, attachmentId },
        { subscribe: false, forceRefetch: true },
      ),
    )
    .unwrap();
}

export function useStockBalances(query: Record<string, unknown>, enabled = true) {
  return useGetStockBalancesQuery(query, { skip: !enabled });
}

export function useExpiryAlerts(days = 90) {
  return useGetExpiryAlertsQuery(days);
}

export function useInventoryReport(query: InventoryReportQuery) {
  return useGetInventoryReportQuery(query);
}

export function useProductLedger(productId: string, query: { from?: string; to?: string }) {
  return useGetProductLedgerQuery({ productId, query }, { skip: !productId });
}

export function useBatches(query: Record<string, unknown>, enabled = true) {
  return useGetProductBatchesQuery(query, { skip: !enabled });
}

export function useBatch(id: string | undefined) {
  return useGetProductBatchQuery(id ?? '', { skip: !id });
}

export function useWriteOff(batchId: string) {
  const [trigger, state] = useWriteOffProductBatchMutation();
  const writeOff = useCallback((body: WriteOffInput) => trigger({ batchId, body }), [trigger, batchId]);
  return [writeOff, state] as const;
}

export function useItems(query: Record<string, unknown>, enabled = true) {
  return useGetInventoryItemsQuery(query, { skip: !enabled });
}

export function useItem(id: string | undefined) {
  return useGetInventoryItemQuery(id ?? '', { skip: !id });
}

export function findItemBySerial(
  serial: string,
  options: { everywhere?: boolean } = {},
): Promise<(typeof inventoryApi.endpoints.getInventoryItemBySerial)['Types']['ResultType']> {
  return store
    .dispatch(
      inventoryApi.endpoints.getInventoryItemBySerial.initiate(
        { serial, everywhere: options.everywhere },
        { subscribe: false, forceRefetch: true },
      ),
    )
    .unwrap();
}

export function useItemBySerial(serial: string, everywhere: boolean) {
  return useGetInventoryItemBySerialQuery({ serial, everywhere }, { skip: !serial });
}

export function useSerialSummary(productId: string | undefined) {
  return useGetProductSerialSummaryQuery(productId ?? '', { skip: !productId });
}

export function useLabelBatches(query: Record<string, unknown>) {
  return useGetLabelBatchesQuery(query);
}

export function useLabelsPrintItems(args: LabelsPrintArgs) {
  return useGetLabelsPrintItemsQuery(args);
}

export function useGrnEditRequests(status?: GrnEditStatus, enabled = true) {
  return useGetGrnEditRequestsQuery(status ?? null, { skip: !enabled });
}

export function useStoreReceipts(status?: StoreReceiptStatus) {
  return useGetStoreReceiptsQuery(status ?? null);
}

export function useStoreReceiptByGrn(grnNo: string) {
  return useGetStoreReceiptByGrnQuery(grnNo, { skip: grnNo.length === 0 });
}

export function useStockOutReport(query: StockOutReportQuery) {
  const params: StockOutReportParams = {
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
    ...(query.toBranchId ? { toBranchId: query.toBranchId } : {}),
    ...(query.status && query.status !== 'all' ? { status: query.status } : {}),
  };
  return useGetStockOutReportQuery(params);
}
