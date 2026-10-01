import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

export function Thumb({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted text-xs font-medium text-muted-foreground',
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        initials(name) || '—'
      )}
    </div>
  );
}
