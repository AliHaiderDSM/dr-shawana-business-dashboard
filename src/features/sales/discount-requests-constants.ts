import type { DiscountRequestStatus } from '@redux/features/discount-requests/types';

export const DISCOUNT_STATUS_LABELS: Record<DiscountRequestStatus, string> = {
  pending: 'Waiting',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Withdrawn',
  used: 'Used in a sale',
};
