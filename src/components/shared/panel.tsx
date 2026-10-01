import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  footer?: ReactNode;
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  footer,
}: PanelProps) {
  return (
    <section className={cn('rounded-xl border bg-card text-card-foreground shadow-xs', className)}>
      {title || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-semibold">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
      {footer ? (
        <footer className="flex justify-end gap-2 border-t bg-muted/30 px-5 py-3">{footer}</footer>
      ) : null}
    </section>
  );
}

export function DetailList({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((item, index) => (
        <div key={index} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 truncate text-sm font-medium">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
