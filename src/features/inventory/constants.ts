import type { StockDocument } from '@redux/features/inventory/types';
import type { StockRequestStatus, WriteOffReason } from '@redux/features/stock-requests/types';

export const STOCK_DESTINATIONS = [
  'Islamabad Office',
  'Multan Office',
  'Karachi Office',
  'Lahore Office',
  'Leading Pharma',
];

export const STOCK_PATHS = { in: '/branch/stock-ins', out: '/branch/stock-outs' } as const;

export function stockParty(row: StockDocument) {
  return 'supplier' in row ? row.supplier : 'dispatcher' in row ? row.dispatcher : null;
}

export function stockLineDetail(row: StockDocument) {
  return 'destination' in row ? row.destination : 'batch' in row ? row.batch : null;
}

export const SERIAL_PATTERN = /^DSM-\d+$/i;

export function isSerial(code: string) {
  return SERIAL_PATTERN.test(code.trim());
}

export function normalizeSerial(code: string) {
  const match = /^(?:DSM-?)?(\d+)$/i.exec(code.trim());
  return match ? `DSM-${match[1]!.padStart(6, '0')}` : code.trim().toUpperCase();
}

export const STOCK_REQUEST_LABELS: Record<StockRequestStatus, string> = {
  pending: 'Waiting for approval',
  approved: 'Approved, to send',
  rejected: 'Rejected',
  cancelled: 'Withdrawn',
  sent: 'On the way',
  received: 'Received',
};

export const WRITE_OFF_LABELS: Record<WriteOffReason, string> = {
  expired: 'Expired',
  damaged: 'Damaged',
  lost: 'Lost',
  adjustment: 'Adjustment',
};
