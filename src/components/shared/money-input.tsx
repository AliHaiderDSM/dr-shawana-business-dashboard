import { forwardRef, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type MoneyInputProps = Omit<ComponentProps<typeof Input>, 'type'> & {
  prefix?: string;
  decimals?: number;
  maxValue?: number;
};

const patterns = new Map<number, RegExp>();

function patternFor(decimals: number) {
  const cached = patterns.get(decimals);
  if (cached) return cached;
  const pattern = decimals > 0 ? new RegExp(String.raw`^\d*(\.\d{0,${decimals}})?$`) : /^\d*$/;
  patterns.set(decimals, pattern);
  return pattern;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { prefix = 'Rs', decimals = 2, maxValue, className, onChange, ...props },
  ref,
) {
  const pattern = patternFor(decimals);
  const allowed = (value: string) =>
    pattern.test(value) && (maxValue === undefined || Number(value || 0) <= maxValue);
  return (
    <div className="relative">
      {prefix ? (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
          {prefix}
        </span>
      ) : null}
      <Input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        className={cn('tabular-nums', prefix && 'pl-9', className)}
        onChange={(event) => {
          if (allowed(event.target.value)) onChange?.(event);
        }}
        {...props}
      />
    </div>
  );
});
