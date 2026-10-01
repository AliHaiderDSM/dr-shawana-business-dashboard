import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import { createCrud } from '@/lib/api/crud';
import type { Schemas } from '@/lib/api/types';

export type MaterialCategory = Schemas['MaterialCategory'];
export type Material = Schemas['Material'];
export type MaterialReceipt = Schemas['MaterialReceipt'];
export type MaterialReceiptInput = Schemas['CreateMaterialReceipt'];
export type Recipe = Schemas['Recipe'];
export type LabTransfer = Schemas['LabTransfer'];
export type Production = Schemas['Production'];
export type MaterialPlace = MaterialReceipt['place'];

export const MATERIAL_PLACES: { value: MaterialPlace; label: string }[] = [
  { value: 'falcon', label: 'Falcon' },
  { value: 'pharmacy', label: 'Pharmacy' },
];

const MATERIAL_DEPENDENTS = ['materials', 'material-report', 'finished-goods'];

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

export function fetchLabTransfer(id: string) {
  return unwrap(api.GET('/branch/lab-transfers/{id}', { params: { path: { id } } })).then((r) => r.data);
}

const receiptKeys = {
  list: (materialId: string) => ['materials', 'receipts', materialId] as const,
};

export function useMaterialReceipts(materialId: string | undefined) {
  return useQuery({
    queryKey: receiptKeys.list(materialId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/branch/materials/{id}/receipts', {
          params: { path: { id: materialId ?? '' }, query: { pageSize: 100, sort: '-date' } },
        }),
      ),
    enabled: Boolean(materialId),
  });
}

function useInvalidateMaterials() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(MATERIAL_DEPENDENTS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}

export function useSaveReceipt(materialId: string) {
  const invalidate = useInvalidateMaterials();
  return useMutation({
    mutationFn: ({ receiptId, body }: { receiptId?: string; body: MaterialReceiptInput }) =>
      receiptId
        ? unwrap(
            api.PATCH('/branch/materials/{id}/receipts/{receiptId}', {
              params: { path: { id: materialId, receiptId } },
              body,
            }),
          )
        : unwrap(api.POST('/branch/materials/{id}/receipts', { params: { path: { id: materialId } }, body })),
    onSuccess: invalidate,
  });
}

export function useRemoveReceipt(materialId: string) {
  const invalidate = useInvalidateMaterials();
  return useMutation({
    mutationFn: (receiptId: string) =>
      unwrap(
        api.DELETE('/branch/materials/{id}/receipts/{receiptId}', {
          params: { path: { id: materialId, receiptId } },
        }),
      ),
    onSuccess: invalidate,
  });
}

export interface MaterialReportQuery {
  from?: string;
  to?: string;
  materialId?: string;
  location?: 'store' | 'lab';
  level?: 'all' | 'minimum' | 'bare_minimum';
}

export function useMaterialReport(query: MaterialReportQuery) {
  return useQuery({
    queryKey: ['material-report', query],
    queryFn: () =>
      unwrap(api.GET('/branch/manufacturing/material-report', { params: { query } })).then((r) => r.data),
    placeholderData: (previous) => previous,
  });
}

export function useFinishedGoods(query: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['finished-goods', query],
    queryFn: () =>
      unwrap(api.GET('/branch/manufacturing/finished-goods', { params: { query } })).then((r) => r.data),
    placeholderData: (previous) => previous,
  });
}
