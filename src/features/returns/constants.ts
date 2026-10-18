import type { ReturnDisposition, ReturnReason } from '@redux/features/returns/types';

export const REASON_LABELS: Record<ReturnReason, string> = {
  damaged: 'Damaged',
  expired: 'Expired',
  wrong_item: 'Wrong item',
  customer_refused: 'Customer refused',
  not_delivered: 'Not delivered',
  other: 'Other',
};

export const DISPOSITION_LABELS: Record<ReturnDisposition, string> = {
  pending: 'Awaiting inspection',
  quarantined: 'In quarantine',
  restocked: 'Back in stock',
  damaged: 'Damaged',
  expired: 'Expired',
  supplier: 'Sent to supplier',
};
