import type { ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import type { Option } from './form-fields';

interface ChoiceFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: ReactNode;
  description?: ReactNode;
  options: Option[];
  required?: boolean;
  allowClear?: boolean;
  className?: string;
}

export function ChoiceField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  options,
  required,
  allowClear,
  className,
}: ChoiceFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label ? (
            <FormLabel>
              {label}
              {required ? <span className="text-destructive">*</span> : null}
            </FormLabel>
          ) : null}
          <FormControl>
            <ToggleGroup
              type="single"
              variant="outline"
              value={(field.value as string | null) ?? ''}
              onValueChange={(value) => {
                if (value) field.onChange(value);
                else if (allowClear) field.onChange(null);
              }}
              className="flex-wrap"
            >
              {options.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className={cn(
                    'h-9 px-3 data-[state=on]:border-primary data-[state=on]:bg-primary-soft data-[state=on]:text-primary-soft-foreground',
                  )}
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
