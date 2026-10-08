import type { HTMLAttributes, ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { MoneyInput } from './money-input';

interface BaseFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: ReactNode;
  description?: ReactNode;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

function FieldLabel({ label, required }: { label: ReactNode; required?: boolean }) {
  return (
    <FormLabel>
      {label}
      {required ? <span className="text-destructive">*</span> : null}
    </FormLabel>
  );
}

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  className,
  disabled,
  type = 'text',
  placeholder,
  autoComplete,
  inputMode,
  list,
}: BaseFieldProps<T> & {
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  list?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FieldLabel label={label} required={required} />
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder}
              autoComplete={autoComplete}
              inputMode={inputMode}
              list={list}
              disabled={disabled}
              {...field}
              value={field.value ?? ''}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  className,
  disabled,
  placeholder,
  rows = 3,
}: BaseFieldProps<T> & { placeholder?: string; rows?: number }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FieldLabel label={label} required={required} />
          <FormControl>
            <Textarea
              placeholder={placeholder}
              rows={rows}
              disabled={disabled}
              {...field}
              value={field.value ?? ''}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function MoneyField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  className,
  disabled,
  prefix = 'Rs',
  decimals = 2,
  placeholder = '0.00',
}: BaseFieldProps<T> & { prefix?: string; decimals?: number; placeholder?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FieldLabel label={label} required={required} />
          <FormControl>
            <MoneyInput
              prefix={prefix}
              decimals={decimals}
              placeholder={placeholder}
              disabled={disabled}
              {...field}
              value={field.value ?? ''}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

export const NONE = '__none__';

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  className,
  disabled,
  options,
  placeholder = 'Select…',
  allowEmpty,
  emptyLabel = 'None',
}: BaseFieldProps<T> & {
  options: Option[];
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FieldLabel label={label} required={required} />
          <Select
            value={field.value ? String(field.value) : allowEmpty ? NONE : ''}
            onValueChange={(value) => field.onChange(value === NONE ? null : value)}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {allowEmpty ? <SelectItem value={NONE}>{emptyLabel}</SelectItem> : null}
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span>{option.label}</span>
                  {option.hint ? <span className="text-muted-foreground">{option.hint}</span> : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function SwitchField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
}: BaseFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem
          className={cn('flex flex-row items-center justify-between gap-4 rounded-lg border p-4', className)}
        >
          <div className="space-y-1">
            <FormLabel>{label}</FormLabel>
            {description ? <FormDescription>{description}</FormDescription> : null}
          </div>
          <FormControl>
            <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} disabled={disabled} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

export function FieldRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid items-start gap-5 sm:grid-cols-2', className)}>{children}</div>;
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
