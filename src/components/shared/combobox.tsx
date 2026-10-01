import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Option } from './form-fields';

export interface ComboboxProps {
  value: string | null | undefined;
  onChange: (value: string | null, option: Option | null) => void;
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: ReactNode;
  selectedLabel?: string | null;
  onSearchChange?: (search: string) => void;
  loading?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  footer?: (close: () => void) => ReactNode;
  className?: string;
  'aria-label'?: string;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results.',
  selectedLabel,
  onSearchChange,
  loading,
  disabled,
  clearable,
  footer,
  className,
  'aria-label': ariaLabel,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? (value ? selectedLabel : null);
  const serverSearch = Boolean(onSearchChange);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onSearchChange?.('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            'w-full justify-between px-3 font-normal shadow-xs',
            !label && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{label ?? placeholder}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command shouldFilter={!serverSearch}>
          <CommandInput placeholder={searchPlaceholder} onValueChange={onSearchChange} />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Searching…
              </div>
            ) : (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            <CommandGroup>
              {clearable && value ? (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange(null, null);
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  Clear selection
                </CommandItem>
              ) : null}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={serverSearch ? option.value : `${option.label} ${option.hint ?? ''} ${option.value}`}
                  onSelect={() => {
                    onChange(option.value, option);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('size-4', option.value === value ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{option.label}</span>
                  {option.hint ? (
                    <span className="ml-auto truncate text-xs text-muted-foreground">{option.hint}</span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {footer ? <div className="border-t p-1">{footer(() => setOpen(false))}</div> : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface ComboboxFieldProps<T extends FieldValues> extends Omit<
  ComboboxProps,
  'value' | 'onChange' | 'aria-label'
> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: ReactNode;
  description?: ReactNode;
  required?: boolean;
  itemClassName?: string;
  onSelect?: (option: Option | null) => void;
}

export function ComboboxField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  itemClassName,
  onSelect,
  ...props
}: ComboboxFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={itemClassName}>
          {label ? (
            <FormLabel>
              {label}
              {required ? <span className="text-destructive">*</span> : null}
            </FormLabel>
          ) : null}
          <FormControl>
            <Combobox
              {...props}
              aria-label={typeof label === 'string' ? label : undefined}
              value={field.value as string | null}
              onChange={(value, option) => {
                field.onChange(value);
                onSelect?.(option);
              }}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
