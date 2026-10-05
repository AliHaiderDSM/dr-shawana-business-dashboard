import { StatusBadge, type Tone } from '@/components/shared/status-badge';
import type { ItemStatus } from './api';

export const ITEM_STATUS: Record<ItemStatus, { label: string; tone: Tone }> = {
  in_stock: { label: 'In stock', tone: 'success' },
  sold: { label: 'Sold', tone: 'info' },
  returned: { label: 'Awaiting inspection', tone: 'warning' },
  quarantined: { label: 'Quarantine', tone: 'warning' },
  damaged: { label: 'Damaged', tone: 'danger' },
  expired: { label: 'Expired', tone: 'danger' },
  supplier_returned: { label: 'Sent to supplier', tone: 'neutral' },
  dispatched: { label: 'Sent out', tone: 'neutral' },
  written_off: { label: 'Written off', tone: 'danger' },
};

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  return <StatusBadge tone={ITEM_STATUS[status].tone}>{ITEM_STATUS[status].label}</StatusBadge>;
}
