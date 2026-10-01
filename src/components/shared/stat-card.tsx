import { AlertTriangle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'warning' | 'danger';
  icon?: LucideIcon;
  className?: string;
}

export function StatCard({ label, value, hint, tone, icon: Icon, className }: StatCardProps) {
  return (
    <div className={cn('rounded-xl border bg-card p-5 shadow-xs', className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon ? <Icon className="size-4" /> : null}
        {label}
        {tone ? (
          <AlertTriangle
            className={cn('size-3.5', tone === 'danger' ? 'text-destructive' : 'text-warning')}
          />
        ) : null}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
