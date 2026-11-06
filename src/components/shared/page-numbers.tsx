import { cn } from '@/lib/utils';

function pagesToShow(page: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const shown = new Set([1, 2, 3, total - 2, total - 1, total, page - 1, page, page + 1]);
  const list = [...shown].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  list.forEach((n, i) => {
    if (i > 0 && n - list[i - 1]! > 1) out.push('gap');
    out.push(n);
  });
  return out;
}

interface PageNumbersProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}

const cell =
  'flex h-8 min-w-8 items-center justify-center border-y border-r px-2.5 text-sm tabular-nums transition-colors first:rounded-l-md first:border-l last:rounded-r-md';

export function PageNumbers({ page, totalPages, onChange, className }: PageNumbersProps) {
  const total = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, page), total);
  return (
    <nav aria-label="Pagination" className={cn('flex items-center', className)}>
      <button
        type="button"
        className={cn(
          cell,
          'px-3 hover:bg-muted disabled:pointer-events-none disabled:text-muted-foreground/60',
        )}
        disabled={current <= 1}
        onClick={() => onChange(current - 1)}
      >
        Previous
      </button>
      {pagesToShow(current, total).map((n, i) =>
        n === 'gap' ? (
          <span key={`gap-${i}`} className={cn(cell, 'text-muted-foreground')} aria-hidden>
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            aria-current={n === current ? 'page' : undefined}
            aria-label={`Page ${n}`}
            className={cn(
              cell,
              n === current
                ? 'border-primary bg-primary font-medium text-primary-foreground'
                : 'hover:bg-muted',
            )}
            onClick={() => n !== current && onChange(n)}
          >
            {n}
          </button>
        ),
      )}
      <button
        type="button"
        className={cn(
          cell,
          'px-3 hover:bg-muted disabled:pointer-events-none disabled:text-muted-foreground/60',
        )}
        disabled={current >= total}
        onClick={() => onChange(current + 1)}
      >
        Next
      </button>
    </nav>
  );
}
