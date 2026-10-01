import { CalendarIcon, X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDate, isoDate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface DateRangePickerProps {
  from?: string;
  to?: string;
  onChange: (range: { from?: string; to?: string }) => void;
  placeholder?: string;
  className?: string;
}

export function DateRangePicker({
  from,
  to,
  onChange,
  placeholder = 'Date range',
  className,
}: DateRangePickerProps) {
  const selected: DateRange | undefined = from
    ? { from: new Date(from), to: to ? new Date(to) : undefined }
    : undefined;
  const label = from
    ? to && to !== from
      ? `${formatDate(from)} – ${formatDate(to)}`
      : formatDate(from)
    : placeholder;

  return (
    <div className={cn('flex items-center', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-9 justify-start font-normal',
              !from && 'text-muted-foreground',
              from && 'rounded-r-none',
            )}
          >
            <CalendarIcon />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={selected}
            defaultMonth={selected?.from}
            onSelect={(range) =>
              onChange({
                from: range?.from ? isoDate(range.from) : undefined,
                to: range?.to ? isoDate(range.to) : undefined,
              })
            }
          />
        </PopoverContent>
      </Popover>
      {from ? (
        <Button
          variant="outline"
          size="icon"
          className="size-9 rounded-l-none border-l-0"
          aria-label="Clear dates"
          onClick={() => onChange({})}
        >
          <X />
        </Button>
      ) : null}
    </div>
  );
}
