import { api, unwrap } from '@/lib/api/client';
import type { Schemas } from '@/lib/api/types';
import { baseApi, fromApi, toApi } from '@redux/api/baseApi';
import { createCrud } from '@redux/api/crud';
import type { TagType } from '@redux/api/tagTypes';
import { store } from '@redux/store';
import type {
  LabTransfer,
  Material,
  MaterialCategory,
  MaterialReceiptInput,
  MaterialReportQuery,
  Production,
  Recipe,
} from './types';

export type * from './types';

const MATERIAL_DEPENDENTS: TagType[] = ['materials', 'material-report', 'finished-goods'];

export const materialCategoriesApi = createCrud<MaterialCategory, Schemas['CreateMaterialCategory']>(
  'material-categories',
  '/branch/material-categories',
  { invalidates: ['materials'] },
);

export const materialsApi = createCrud<Material, Schemas['CreateMaterial'], Schemas['UpdateMaterial']>(
  'materials',
  '/branch/materials',
  { invalidates: ['material-report'] },
);

export const recipesApi = createCrud<
  Recipe,
  Schemas['CreateRecipe'],
  Schemas['UpdateRecipe'],
  { id: string; productId: string; productName: string }
>('recipes', '/branch/recipes');

export const labTransfersApi = createCrud<
  LabTransfer,
  Schemas['CreateLabTransfer'],
  never,
  { id: string; batchNo: string; date: string }
>('lab-transfers', '/branch/lab-transfers', { invalidates: MATERIAL_DEPENDENTS });

export const productionsApi = createCrud<Production, Schemas['CreateProduction'], never>(
  'productions',
  '/branch/productions',
  { invalidates: [...MATERIAL_DEPENDENTS, 'lab-transfers', 'stock', 'products'] },
);

export interface SaveReceiptArgs {
  materialId: string;
  receiptId?: string;
  body: MaterialReceiptInput;
}

export interface RemoveReceiptArgs {
  materialId: string;
  receiptId: string;
}

export type FinishedGoodsQuery = { from?: string; to?: string };

const requestLabTransfer = (id: string) =>
  unwrap(api.GET('/branch/lab-transfers/{id}', { params: { path: { id } } })).then((r) => r.data);

const requestMaterialReceipts = (materialId: string) =>
  unwrap(
    api.GET('/branch/materials/{id}/receipts', {
      params: { path: { id: materialId }, query: { pageSize: 100, sort: '-date' } },
    }),
  );

const requestSaveReceipt = ({ materialId, receiptId, body }: SaveReceiptArgs) =>
  receiptId
    ? unwrap(
        api.PATCH('/branch/materials/{id}/receipts/{receiptId}', {
          params: { path: { id: materialId, receiptId } },
          body,
        }),
      )
    : unwrap(api.POST('/branch/materials/{id}/receipts', { params: { path: { id: materialId } }, body }));

const requestMaterialReport = (query: MaterialReportQuery) =>
  unwrap(api.GET('/branch/manufacturing/material-report', { params: { query } })).then((r) => r.data);

const requestFinishedGoods = (query: FinishedGoodsQuery) =>
  unwrap(api.GET('/branch/manufacturing/finished-goods', { params: { query } })).then((r) => r.data);

export type LabTransferDetail = Awaited<ReturnType<typeof requestLabTransfer>>;
export type MaterialReceiptsPage = Awaited<ReturnType<typeof requestMaterialReceipts>>;
export type SaveReceiptResult = Awaited<ReturnType<typeof requestSaveReceipt>>;
export type MaterialReport = Awaited<ReturnType<typeof requestMaterialReport>>;
export type FinishedGoodsReport = Awaited<ReturnType<typeof requestFinishedGoods>>;

export const manufacturingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getLabTransferById: build.query<LabTransferDetail, string>({
      queryFn: (id) => fromApi(() => requestLabTransfer(id)),
      providesTags: ['lab-transfers'],
    }),
    getMaterialReceipts: build.query<MaterialReceiptsPage, string>({
      queryFn: (materialId) => fromApi(() => requestMaterialReceipts(materialId)),
      providesTags: ['materials'],
    }),
    saveMaterialReceipt: build.mutation<SaveReceiptResult, SaveReceiptArgs>({
      queryFn: (args) => toApi(() => requestSaveReceipt(args)),
      invalidatesTags: (_r, error) => (error ? [] : MATERIAL_DEPENDENTS),
    }),
    removeMaterialReceipt: build.mutation<unknown, RemoveReceiptArgs>({
      queryFn: ({ materialId, receiptId }) =>
        toApi(() =>
          unwrap(
            api.DELETE('/branch/materials/{id}/receipts/{receiptId}', {
              params: { path: { id: materialId, receiptId } },
            }),
          ),
        ),
      invalidatesTags: (_r, error) => (error ? [] : MATERIAL_DEPENDENTS),
    }),
    getMaterialReport: build.query<MaterialReport, MaterialReportQuery>({
      queryFn: (query) => fromApi(() => requestMaterialReport(query)),
      providesTags: ['material-report'],
    }),
    getFinishedGoods: build.query<FinishedGoodsReport, FinishedGoodsQuery>({
      queryFn: (query) => fromApi(() => requestFinishedGoods(query)),
      providesTags: ['finished-goods'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetLabTransferByIdQuery,
  useLazyGetLabTransferByIdQuery,
  useGetMaterialReceiptsQuery,
  useSaveMaterialReceiptMutation,
  useRemoveMaterialReceiptMutation,
  useGetMaterialReportQuery,
  useGetFinishedGoodsQuery,
} = manufacturingApi;

export function fetchLabTransfer(
  id: string,
): Promise<(typeof manufacturingApi.endpoints.getLabTransferById)['Types']['ResultType']> {
  return store
    .dispatch(
      manufacturingApi.endpoints.getLabTransferById.initiate(id, { subscribe: false, forceRefetch: true }),
    )
    .unwrap();
}

export function useMaterialReceipts(materialId: string | undefined) {
  return useGetMaterialReceiptsQuery(materialId ?? '', { skip: !materialId });
}

export function useMaterialReport(query: MaterialReportQuery) {
  return useGetMaterialReportQuery(query);
}

export function useFinishedGoods(query: FinishedGoodsQuery) {
  return useGetFinishedGoodsQuery(query);
}
