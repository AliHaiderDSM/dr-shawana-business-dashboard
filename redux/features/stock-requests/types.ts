import type { paths } from '@/lib/api/schema';
import type { Schemas } from '@/lib/api/types';

type JsonOk<R> = R extends { 200: { content: { 'application/json': infer B } } }
  ? B
  : R extends { 201: { content: { 'application/json': infer B } } }
    ? B
    : never;

export type StockRequestsGetData<P extends keyof paths> = paths[P] extends { get: { responses: infer R } }
  ? JsonOk<R> extends { data: infer D }
    ? D
    : never
  : never;

export type StockRequestsPostData<P extends keyof paths> = paths[P] extends { post: { responses: infer R } }
  ? JsonOk<R> extends { data: infer D }
    ? D
    : never
  : never;

export type StockRequestsPatchData<P extends keyof paths> = paths[P] extends {
  patch: { responses: infer R };
}
  ? JsonOk<R> extends { data: infer D }
    ? D
    : never
  : never;

export type StockRequest = Schemas['StockRequest'];
export type StockRequestStatus = StockRequest['status'];
export type IncomingStock = Schemas['IncomingStock'];
export type WriteOffRecord = Schemas['WriteOffRecord'];
export type WriteOffReason = WriteOffRecord['reason'];

export type IncomingStockStatus = 'waiting' | 'received';

export interface WriteOffsQuery {
  reason?: WriteOffReason;
  status?: WriteOffRecord['status'];
  from?: string;
  to?: string;
  search?: string;
}

export interface DecideStockRequestInput {
  id: string;
  approve: boolean;
  body: Schemas['DecideStockRequest'];
}

export interface UpdateStockRequestInput {
  id: string;
  body: Schemas['CreateStockRequest'];
}

export interface DecideWriteOffInput {
  id: string;
  approve: boolean;
  note?: string | null;
}
