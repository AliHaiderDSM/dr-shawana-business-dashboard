import type { PageMeta, Schemas } from '@/lib/api/types';

export type Sale = Schemas['Sale'];
export type SaleListItem = Omit<Sale, 'items' | 'payments'> & {
  products: { name: string; qty: string | null }[];
  itemDiscount: string;
  grossAmount: string;
  discountTotal: string;
  refund: string;
  netAmount: string;
};
export type SaleInput = Schemas['CreateSale'];
export type SaleUpdate = Schemas['UpdateSale'];
export type SalePayment = Sale['payments'][number];
export type DeliveryStatus = NonNullable<Sale['deliveryStatus']>;

export interface SaleTotals {
  qty: string;
  subtotal: string;
  discount: string;
  itemDiscount: string;
  gross: string;
  discountTotal: string;
  total: string;
  received: string;
  remaining: string;
  refund: string;
  net: string;
}

export interface BranchSalesTotals {
  branchId: string;
  branchName: string;
  count: number;
  qty: string;
  total: string;
  received: string;
  remaining: string;
}

export interface SalesListResult {
  data: SaleListItem[];
  meta: PageMeta & { totals: SaleTotals; byBranch?: BranchSalesTotals[] };
}

export type DeliveryOrder = Schemas['DeliveryOrder'];
export type DeliveryCalendar = Schemas['DeliveryCalendar'];
export type DeliveryDay = DeliveryCalendar['days'][number];

export interface DeliveriesQuery {
  date?: string;
  by?: 'order' | 'dispatch';
  status?: DeliveryStatus;
}

export interface OnlineCatalogQuery {
  search?: string;
  categoryId?: string;
}

export interface CreateSaleArgs {
  body: SaleInput;
  proofs: File[];
  idempotencyKey?: string;
}

export interface SetSaleDeliveryArgs {
  id: string;
  status: 'delivered' | 'returned';
}

export interface ApproveSalePaymentsArgs {
  id: string;
  paymentIds?: string[];
}

export interface DispatchSaleOrderArgs {
  id: string;
  date: string;
  serials: string[];
}

export interface CancelSaleOrderArgs {
  id: string;
  refund: Schemas['ReturnRefundInput'] | null;
}

export interface SaveSalePaymentArgs {
  saleId: string;
  paymentId?: string;
  body: Schemas['UpdateSalePayment'] &
    Pick<Schemas['SalePaymentInput'], 'method' | 'amount' | 'accountSheetId'>;
  proofs: File[];
  idempotencyKey?: string;
}

export interface RemoveSalePaymentArgs {
  saleId: string;
  paymentId: string;
}

export interface SalePaymentProofArgs {
  saleId: string;
  paymentId: string;
  proofId: string;
}

export interface BillData {
  company: { name: string; phone: string | null; email: string | null; address: string | null } | null;
  branch: { name: string; code: string; city: string; address: string | null; phone: string | null };
  customer: { name: string; phone: string; address: string | null; city: string } | null;
  sale: {
    invoiceNo: string;
    date: string;
    saleType: Sale['saleType'];
    city: string;
    totalQty: string;
    subtotal: string;
    discountPercent: string;
    discountAmount: string;
    total: string;
    received: string;
    remaining: string;
    paymentStatus: Sale['paymentStatus'];
    note: string | null;
  };
  items: {
    sr: number;
    product: string;
    bundle: string | null;
    qty: string;
    unitPrice: string;
    discountPercent: string;
    discountAmount: string;
    lineTotal: string;
  }[];
  payments: { cash: SalePayment[]; online: SalePayment[] };
}

export interface DeliverySlip {
  saleId: string;
  invoiceNo: string;
  date: string;
  saleType: Sale['saleType'];
  dispatchedOn: string | null;
  branch: { code: string; name: string } | null;
  to: { name: string; phone: string; city: string | null; address: string | null };
  items: { productId: string; name: string; qty: string }[];
  from: { name: string; phone: string | null; city: string; address: string | null };
}

export type GdnOrderStatus = 'dispatched' | 'cancelled' | 'pending';

export type GdnReportType = 'online' | 'office' | 'all';

export interface GdnOrder {
  id: string;
  invoiceNo: string;
  gdnNo: string | null;
  saleType: 'online' | 'office';
  date: string;
  dispatchedOn: string | null;
  status: GdnOrderStatus;
  fromBefore: boolean;
  waitingDays: number;
  paymentStatus: string;
  total: string;
  city: string | null;
  customer: { name: string | null; phone: string | null };
  bookedAt: { code: string; name: string | null } | null;
  items: { name: string; qty: string }[];
}

export interface GdnReport {
  date: string;
  type: GdnReportType;
  branch: { name: string; code: string; dispatch: boolean };
  summary: {
    opening: number;
    openingAmount: string;
    newOrders: number;
    newAmount: string;
    dispatched: number;
    dispatchedAmount: string;
    office: number;
    officeAmount: string;
    dispatchedFromOpening: number;
    dispatchedFromNew: number;
    cancelled: number;
    closing: number;
    closingAmount: string;
    closingFromOpening: number;
    oldestPending: string | null;
  };
  orders: GdnOrder[];
}

export interface DeliverySlipsQuery {
  from?: string;
  to?: string;
  saleType?: Sale['saleType'];
  patientId?: string;
  invoiceFrom?: number;
  invoiceTo?: number;
  dateBy?: 'booked' | 'dispatched';
  branchId?: string;
  saleIds?: string;
}

export interface DeliverySlipsResult {
  slipsPerPage: number;
  slips: DeliverySlip[];
}
