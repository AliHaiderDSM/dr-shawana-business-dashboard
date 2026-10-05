import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, jsonFormData, unwrap, uploadForm } from '@/lib/api/client';
import type { PageMeta, Schemas } from '@/lib/api/types';

export type StockIn = Schemas['StockIn'];
export type StockOut = Schemas['StockOut'];
export type StockDocument = StockIn | StockOut;
export type StockBalance = Schemas['StockBalance'];
export type InventoryReport = Schemas['InventoryReport'];
export type ProductLedger = Schemas['ProductLedger'];
export type StockKind = 'in' | 'out';

export const STOCK_DESTINATIONS = [
  'Islamabad Office',
  'Multan Office',
  'Karachi Office',
  'Lahore Office',
  'Leading Pharma',
];

export const STOCK_PATHS = { in: '/branch/stock-ins', out: '/branch/stock-outs' } as const;

const stockKeys = {
  all: ['stock'] as const,
  documents: (kind: StockKind) => ['stock', 'documents', kind] as const,
  list: (kind: StockKind, query: object) => ['stock', 'documents', kind, 'list', query] as const,
  detail: (kind: StockKind, id: string) => ['stock', 'documents', kind, 'detail', id] as const,
  balances: (query: object) => ['stock', 'balances', query] as const,
  report: (query: object) => ['stock', 'report', query] as const,
  ledger: (productId: string, query: object) => ['stock', 'ledger', productId, query] as const,
};

export interface StockLineInput {
  productId: string;
  qty: string;
  batch?: string | null;
  destination?: string;
}

export interface StockDocumentInput {
  supplierId?: string | null;
  dispatcherId?: string | null;
  date: string;
  note: string | null;
  items: StockLineInput[];
}

export type StockDocumentUpdate = Partial<Omit<StockDocumentInput, 'items'>> & Partial<StockLineInput>;

function useInvalidateStock() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: stockKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['products'] });
  };
}

export function useStockDocuments(kind: StockKind, query: Record<string, unknown>) {
  return useQuery({
    queryKey: stockKeys.list(kind, query),
    queryFn: async () => {
      const result =
        kind === 'in'
          ? await unwrap(api.GET('/branch/stock-ins', { params: { query } }))
          : await unwrap(api.GET('/branch/stock-outs', { params: { query } }));
      return result as { data: StockDocument[]; meta: PageMeta };
    },
    placeholderData: (previous) => previous,
  });
}

export function useStockDocument(kind: StockKind, id: string | undefined) {
  return useQuery({
    queryKey: stockKeys.detail(kind, id ?? ''),
    queryFn: async () => {
      const path = { params: { path: { id: id ?? '' } } };
      const result =
        kind === 'in'
          ? await unwrap(api.GET('/branch/stock-ins/{id}', path))
          : await unwrap(api.GET('/branch/stock-outs/{id}', path));
      return result.data as StockDocument;
    },
    enabled: Boolean(id),
  });
}

export function useStockDocumentsByIds(kind: StockKind, ids: string[]) {
  return useQuery({
    queryKey: [...stockKeys.documents(kind), 'print', ids],
    queryFn: () =>
      Promise.all(
        ids.map(async (id) => {
          const path = { params: { path: { id } } };
          const result =
            kind === 'in'
              ? await unwrap(api.GET('/branch/stock-ins/{id}', path))
              : await unwrap(api.GET('/branch/stock-outs/{id}', path));
          return result.data as StockDocument;
        }),
      ),
    enabled: ids.length > 0,
  });
}

export function useCreateStockDocument(kind: StockKind) {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: ({ body, files }: { body: StockDocumentInput; files: File[] }) =>
      uploadForm<StockDocument[]>(STOCK_PATHS[kind], jsonFormData(body, { files })),
    onSuccess: invalidate,
  });
}

export function useUpdateStockDocument(kind: StockKind) {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: StockDocumentUpdate }) => {
      const init = { params: { path: { id } }, body };
      return kind === 'in'
        ? unwrap(api.PATCH('/branch/stock-ins/{id}', init))
        : unwrap(api.PATCH('/branch/stock-outs/{id}', init as never));
    },
    onSuccess: invalidate,
  });
}

export function useRemoveStockDocument(kind: StockKind) {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: (id: string) => {
      const init = { params: { path: { id } } };
      return kind === 'in'
        ? unwrap(api.DELETE('/branch/stock-ins/{id}', init))
        : unwrap(api.DELETE('/branch/stock-outs/{id}', init));
    },
    onSuccess: invalidate,
  });
}

export function useAddStockAttachments(kind: StockKind) {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: ({ id, files }: { id: string; files: File[] }) => {
      const form = new FormData();
      for (const file of files) form.append('files', file);
      return uploadForm<StockDocument>(`${STOCK_PATHS[kind]}/${id}/attachments`, form);
    },
    onSuccess: invalidate,
  });
}

export function useRemoveStockAttachment(kind: StockKind) {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: ({ id, attachmentId }: { id: string; attachmentId: string }) => {
      const init = { params: { path: { id, attachmentId } } };
      return kind === 'in'
        ? unwrap(api.DELETE('/branch/stock-ins/{id}/attachments/{attachmentId}', init))
        : unwrap(api.DELETE('/branch/stock-outs/{id}/attachments/{attachmentId}', init));
    },
    onSuccess: invalidate,
  });
}

export async function stockAttachmentUrl(kind: StockKind, id: string, attachmentId: string) {
  const init = { params: { path: { id, attachmentId } } };
  const result =
    kind === 'in'
      ? await unwrap(api.GET('/branch/stock-ins/{id}/attachments/{attachmentId}/url', init))
      : await unwrap(api.GET('/branch/stock-outs/{id}/attachments/{attachmentId}/url', init));
  return result.data;
}

export function useStockBalances(query: Record<string, unknown>) {
  return useQuery({
    queryKey: stockKeys.balances(query),
    queryFn: () => unwrap(api.GET('/branch/inventory/stock', { params: { query } })),
    placeholderData: (previous) => previous,
  });
}

export function useInventoryReport(query: {
  from?: string;
  to?: string;
  categoryId?: string;
  productId?: string;
}) {
  return useQuery({
    queryKey: stockKeys.report(query),
    queryFn: () => unwrap(api.GET('/branch/inventory/report', { params: { query } })).then((r) => r.data),
    placeholderData: (previous) => previous,
  });
}

export function useProductLedger(productId: string, query: { from?: string; to?: string }) {
  return useQuery({
    queryKey: stockKeys.ledger(productId, query),
    queryFn: () =>
      unwrap(
        api.GET('/branch/inventory/products/{productId}/ledger', {
          params: { path: { productId }, query },
        }),
      ).then((r) => r.data),
    enabled: Boolean(productId),
  });
}

export function stockParty(row: StockDocument) {
  return 'supplier' in row ? row.supplier : 'dispatcher' in row ? row.dispatcher : null;
}

export function stockLineDetail(row: StockDocument) {
  return 'destination' in row ? row.destination : 'batch' in row ? row.batch : null;
}

export type ProductBatch = Schemas['ProductBatch'];
export type ProductBatchDetail = Schemas['ProductBatchDetail'];
export type BatchStatus = ProductBatch['status'];
export type WriteOffInput = Schemas['WriteOff'];

export function useBatches(query: Record<string, unknown>, enabled = true) {
  return useQuery({
    queryKey: ['stock', 'batches', query],
    queryFn: () => unwrap(api.GET('/branch/inventory/batches', { params: { query } })),
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useBatch(id: string | undefined) {
  return useQuery({
    queryKey: ['stock', 'batch', id],
    queryFn: () =>
      unwrap(
        api.GET('/branch/inventory/batches/{batchId}', { params: { path: { batchId: id ?? '' } } }),
      ).then((r) => r.data),
    enabled: Boolean(id),
  });
}

export function useWriteOff(batchId: string) {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: (body: WriteOffInput) =>
      unwrap(
        api.POST('/branch/inventory/batches/{batchId}/write-off', { params: { path: { batchId } }, body }),
      ),
    onSuccess: invalidate,
  });
}
