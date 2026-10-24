import type { Schemas } from '@/lib/api/types';

export type SaleReturn = Schemas['SaleReturn'];
export type ReturnItem = SaleReturn['items'][number];
export type ReturnReason = SaleReturn['reason'];
export type ReturnDisposition = ReturnItem['disposition'];
export type ReturnInput = Schemas['CreateSaleReturn'];

export type CreateReturnArgs = ReturnInput & { idempotencyKey?: string };
export type RefundInput = Schemas['ReturnRefundInput'];
export type Returnable = Schemas['ReturnableSale'];

export interface ResolveReturnItemArgs {
  returnId: string;
  itemId: string;
  disposition: Exclude<ReturnDisposition, 'pending'>;
  note: string | null;
}

export interface DecideReturnItemArgs {
  returnId: string;
  itemId: string;
  approve: boolean;
  note?: string | null;
  asSuperAdmin: boolean;
}

export interface SetReturnRefundArgs {
  returnId: string;
  refund: RefundInput | null;
}
