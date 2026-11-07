import type { Schemas } from '@/lib/api/types';

export type StockHold = Schemas['StockHold'];
export type StockHoldStatus = StockHold['status'];
export type StockHoldReason = StockHold['reason'];
export type ReportStockHoldInput = Schemas['ReportStockHold'];
export type StockHoldDecision = Schemas['DecideStockHold']['decision'];

export interface StockHoldsQuery {
  status?: StockHoldStatus | null;
  saleId?: string | null;
  stockRequestId?: string | null;
  search?: string | null;
}

export interface DecideStockHoldArgs {
  id: string;
  body: Schemas['DecideStockHold'];
}
