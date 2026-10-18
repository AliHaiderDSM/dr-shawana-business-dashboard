import type { paths } from '@/lib/api/schema';
import type { PageMeta, Schemas } from '@/lib/api/types';

type JsonOk<R> = R extends { 200: { content: { 'application/json': infer B } } }
  ? B
  : R extends { 201: { content: { 'application/json': infer B } } }
    ? B
    : never;

export type InventoryGetResponse<P extends keyof paths> = paths[P] extends { get: { responses: infer R } }
  ? JsonOk<R>
  : never;

export type InventoryPostResponse<P extends keyof paths> = paths[P] extends { post: { responses: infer R } }
  ? JsonOk<R>
  : never;

export type InventoryPatchResponse<P extends keyof paths> = paths[P] extends { patch: { responses: infer R } }
  ? JsonOk<R>
  : never;

export type InventoryDeleteResponse<P extends keyof paths> = paths[P] extends {
  delete: { responses: infer R };
}
  ? JsonOk<R>
  : never;

export type StockIn = Schemas['StockIn'];
export type StockOut = Schemas['StockOut'];
export type StockDocument = StockIn | StockOut;
export type StockBalance = Schemas['StockBalance'];
export type InventoryReport = Schemas['InventoryReport'];
export type ProductLedger = Schemas['ProductLedger'];
export type StockKind = 'in' | 'out';

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

export type StockDocumentPage = { data: StockDocument[]; meta: PageMeta };

export type ExpiryAlert = Schemas['ExpiryAlert'];

export interface InventoryReportQuery {
  from?: string;
  to?: string;
  categoryId?: string;
  productId?: string;
  supplierId?: string;
  dispatcherId?: string;
  toBranchId?: string;
}

export type ProductBatch = Schemas['ProductBatch'];
export type ProductBatchDetail = Schemas['ProductBatchDetail'];
export type BatchStatus = ProductBatch['status'];
export type WriteOffInput = Schemas['WriteOff'];

export type InventoryItem = Schemas['InventoryItem'];
export type InventoryItemDetail = Schemas['InventoryItemDetail'];
export type ItemStatus = InventoryItem['status'];
export type SerialSummary = Schemas['SerialSummary'];
export type RegisterLabelsInput = Schemas['RegisterLabels'];

export type LabelBatch = Schemas['LabelBatch'];

export interface LabelsPrintArgs {
  source: string | null;
  sourceIds: string[];
  from: string | null;
  to: string | null;
  productId: string | null;
  batchId: string | null;
  withoutBatch: string | null;
}

export type StoreReceipt = Schemas['StoreReceipt'];
export type StoreReceiptStatus = 'pending' | 'confirmed';
export type ConfirmStoreReceiptInput = Schemas['ConfirmStoreReceipt'];

export type StockOutTransfer = Schemas['StockOutTransfer'];
export type StockOutReportStatus = 'all' | 'received' | 'on_the_way';

export interface StockOutReportQuery {
  from?: string;
  to?: string;
  toBranchId?: string;
  status?: StockOutReportStatus;
}
