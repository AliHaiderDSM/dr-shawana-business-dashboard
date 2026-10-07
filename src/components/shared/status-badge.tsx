import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<Tone, string> = {
  neutral: 'bg-neutral-soft text-neutral-soft-foreground',
  primary: 'bg-primary-soft text-primary-soft-foreground',
  success: 'bg-success-soft text-success-soft-foreground',
  warning: 'bg-warning-soft text-warning-soft-foreground',
  danger: 'bg-destructive-soft text-destructive-soft-foreground',
  info: 'bg-info-soft text-info-soft-foreground',
};

const dots: Record<Tone, string> = {
  neutral: 'bg-muted-foreground',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-info',
};

const STATUS_TONES: Record<string, Tone> = {
  active: 'success',
  inactive: 'neutral',
  paid: 'success',
  partial: 'warning',
  unpaid: 'danger',
  awaiting_approval: 'warning',
  booked: 'info',
  completed: 'success',
  cancelled: 'neutral',
  pending: 'warning',
  delivered: 'success',
  dispatched: 'info',
  returned: 'danger',
  open: 'info',
  supplier: 'primary',
  dispatcher: 'info',
  cash: 'neutral',
  bank: 'primary',
};

interface StatusBadgeProps {
  status?: string | null;
  tone?: Tone;
  children?: ReactNode;
  dot?: boolean;
  className?: string;
}

export function StatusBadge({ status, tone, children, dot = true, className }: StatusBadgeProps) {
  const resolved = tone ?? STATUS_TONES[status ?? ''] ?? 'neutral';
  const label = children ?? (status ? status.replace(/_/g, ' ') : '—');
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap capitalize',
        tones[resolved],
        className,
      )}
    >
      {dot ? <span className={cn('size-1.5 rounded-full', dots[resolved])} /> : null}
      {label}
    </span>
  );
}
