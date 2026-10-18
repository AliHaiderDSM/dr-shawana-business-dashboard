import type { Schemas } from '@/lib/api/types';

export type DiscountRequest = Schemas['DiscountRequest'];
export type DiscountRequestStatus = DiscountRequest['status'];

export interface DiscountRequestsQuery {
  status?: DiscountRequestStatus;
  ids?: string[];
}

export interface DiscountRequestsArg {
  status: DiscountRequestStatus | null;
  ids: string | null;
}

export interface AskDiscountInput {
  productId?: string;
  bundleId?: string;
  qty: string;
  discountPercent: string;
  note?: string | null;
  patientId?: string;
  customerName?: string;
}

export interface DecideDiscountArgs {
  id: string;
  approve: boolean;
  note?: string | null;
}
