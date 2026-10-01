import { StatusBadge, type Tone } from '@/components/shared/status-badge';
import { BHRT_LABELS, type BhrtStatus } from './api';

const BHRT_TONES: Record<string, Tone> = {
  on: 'success',
  off: 'neutral',
  recommended: 'info',
  other: 'neutral',
  none: 'neutral',
};

export function BhrtBadge({ status }: { status: string }) {
  if (status === 'none') return <span className="text-muted-foreground">—</span>;
  return (
    <StatusBadge tone={BHRT_TONES[status] ?? 'neutral'}>
      {BHRT_LABELS[status as BhrtStatus] ?? status}
    </StatusBadge>
  );
}
