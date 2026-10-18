import type { DeliveryStatus, Sale } from '@redux/features/sales/types';

export const SALE_TYPE_LABELS: Record<Sale['saleType'], string> = {
  office: 'Office sale',
  online: 'Online sale',
};
export const PAYMENT_STATUS_LABELS: Record<Sale['paymentStatus'], string> = {
  unpaid: 'Unpaid',
  partial: 'Remaining',
  paid: 'Paid',
  awaiting_approval: 'Awaiting approval',
};
export const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
  pending: 'Awaiting dispatch',
  dispatched: 'Dispatched',
  delivered: 'Dispatched',
  returned: 'Returned',
  cancelled: 'Cancelled',
};

export const SALE_CITIES = ['Lahore', 'Islamabad', 'Karachi', 'Multan'];
