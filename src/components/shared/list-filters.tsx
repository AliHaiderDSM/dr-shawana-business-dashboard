import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ListState } from '@/hooks/use-list-state';
import { cn } from '@/lib/utils';
import { DateRangePicker } from './date-range-picker';
import type { Option } from './form-fields';

const ALL = '__all__';

interface FilterSelectProps {
  list: ListState;
  name: string;
  allLabel: string;
  options: readonly Option[];
  className?: string;
}

export function FilterSelect({ list, name, allLabel, options, className }: FilterSelectProps) {
  return (
    <Select
      value={list.filters[name] ?? ALL}
      onValueChange={(value) => list.setFilter(name, value === ALL ? undefined : value)}
    >
      <SelectTrigger size="sm" className={cn('h-9 w-40', className)} aria-label={allLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DateRangeFilter({ list, placeholder }: { list: ListState; placeholder?: string }) {
  return (
    <DateRangePicker
      from={list.filters.from}
      to={list.filters.to}
      placeholder={placeholder}
      onChange={({ from, to }) => list.setFilters({ from, to: to ?? from })}
    />
  );
}

export function enumOptions<T extends string>(values: readonly T[], labels?: Partial<Record<T, string>>) {
  return values.map((value) => ({
    value,
    label: labels?.[value] ?? value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
  }));
}
