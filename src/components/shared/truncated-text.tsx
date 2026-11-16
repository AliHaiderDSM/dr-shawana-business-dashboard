import { useLayoutEffect, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TruncatedTextProps {
  text: string | null | undefined;
  className?: string;
  maxWidth?: string;
  fallback?: string;
}

export function TruncatedText({ text, className, maxWidth = '12rem', fallback = '—' }: TruncatedTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setCut(el.scrollWidth > el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  if (!text) return <span className="text-muted-foreground">{fallback}</span>;

  const span = (
    <span ref={ref} className={cn('block truncate', className)} style={{ maxWidth }}>
      {text}
    </span>
  );

  if (!cut) return span;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{span}</TooltipTrigger>
      <TooltipContent className="max-w-80 break-words">{text}</TooltipContent>
    </Tooltip>
  );
}
