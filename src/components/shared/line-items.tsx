import { Plus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MoneyInput } from './money-input';

export interface LineColumn {
  header: ReactNode;
  width: string;
  align?: 'left' | 'right';
}

interface LineItemsProps {
  columns: LineColumn[];
  rowKeys: string[];
  renderRow: (index: number) => ReactNode[];
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  addLabel?: string;
  minRows?: number;
  summary?: ReactNode;
  error?: string;
}

export function LineItems({
  columns,
  rowKeys,
  renderRow,
  onAdd,
  onRemove,
  addLabel = 'Add line',
  minRows = 1,
  summary,
  error,
}: LineItemsProps) {
  const template = [...columns.map((c) => c.width), ...(onRemove ? ['2.25rem'] : [])].join(' ');
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border">
        <div className="min-w-[32rem]">
          <div
            className="grid gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground"
            style={{ gridTemplateColumns: template }}
          >
            {columns.map((column, index) => (
              <span key={index} className={cn(column.align === 'right' && 'text-right')}>
                {column.header}
              </span>
            ))}
            {onRemove ? <span /> : null}
          </div>
          <div className="divide-y">
            {rowKeys.map((key, index) => (
              <div
                key={key}
                className="grid items-start gap-2 px-3 py-2.5"
                style={{ gridTemplateColumns: template }}
              >
                {renderRow(index)
                  .filter((cell) => cell !== null)
                  .map((cell, cellIndex) => (
                    <div key={cellIndex} className="min-w-0">
                      {cell}
                    </div>
                  ))}
                {onRemove ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 text-muted-foreground"
                    disabled={rowKeys.length <= minRows}
                    onClick={() => onRemove(index)}
                    aria-label="Remove line"
                  >
                    <X />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          {onAdd || summary ? (
            <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-3 py-2.5">
              {onAdd ? (
                <Button type="button" variant="ghost" size="sm" onClick={onAdd}>
                  <Plus />
                  {addLabel}
                </Button>
              ) : (
                <span />
              )}
              {summary ? <div className="text-right text-sm">{summary}</div> : null}
            </div>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

interface InlineFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
}

export function InlineQuantityField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder = '0',
  decimals = 3,
  prefix = '',
  readOnly = false,
}: InlineFieldProps<T> & { decimals?: number; prefix?: string; readOnly?: boolean }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <MoneyInput
              prefix={prefix}
              decimals={decimals}
              placeholder={placeholder}
              aria-label={label}
              {...field}
              value={field.value ?? ''}
              readOnly={readOnly}
              tabIndex={readOnly ? -1 : undefined}
              className={readOnly ? 'bg-muted/50 text-foreground focus-visible:ring-0' : undefined}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function InlineTextField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  type = 'text',
}: InlineFieldProps<T> & { type?: 'text' | 'date' }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder}
              aria-label={label}
              {...field}
              value={field.value ?? ''}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function arrayError(error: unknown): string | undefined {
  const value = error as { message?: string; root?: { message?: string } } | undefined;
  return value?.root?.message ?? value?.message;
}
