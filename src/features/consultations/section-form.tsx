import { CheckCircle2, Circle, Loader2, Save } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useForm, useFormContext, useWatch, type Control } from 'react-hook-form';
import { toast } from 'sonner';
import { ChoiceField } from '@/components/shared/choice-field';
import { TextField, TextareaField } from '@/components/shared/form-fields';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { applyServerErrors } from '@/lib/api/errors';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSaveSection, type Consultation, type SectionState } from './api';
import {
  MRS_LABELS,
  MRS_SCORES,
  SCAN_STATUSES,
  type Choice,
  type FieldDef,
  type FormValues,
  type SectionDef,
} from './clinical-fields';
import { isVisible, sectionResolver, toApiData, toFormValues } from './clinical-form';

type FieldControl = Control<FormValues>;

const YES_NO: Choice[] = [
  ['yes', 'Yes'],
  ['no', 'No'],
];

const toOptions = (choices: readonly Choice[]) => choices.map(([value, label]) => ({ value, label }));

function CheckGroupField({
  control,
  field,
  disabled,
}: {
  control: FieldControl;
  field: Extract<FieldDef, { kind: 'checks' }>;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={field.key}
      render={({ field: f }) => {
        const selected = new Set((f.value as string[] | undefined) ?? []);
        const toggle = (value: string, checked: boolean) => {
          const next = new Set(selected);
          if (checked) next.add(value);
          else next.delete(value);
          f.onChange([...next]);
        };
        return (
          <FormItem>
            <FormLabel>
              {field.label}
              {field.required ? <span className="text-destructive">*</span> : null}
            </FormLabel>
            <div className="space-y-4">
              {field.groups.map((group, index) => (
                <div key={group.title ?? index} className="space-y-2">
                  {group.title ? (
                    <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {group.title}
                    </div>
                  ) : null}
                  <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
                    {group.options.map(([value, label]) => (
                      <label
                        key={value}
                        className={cn(
                          'flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/50',
                          selected.has(value) && 'border-primary/50 bg-primary-soft/50',
                          disabled && 'cursor-not-allowed opacity-70',
                        )}
                      >
                        <Checkbox
                          checked={selected.has(value)}
                          disabled={disabled}
                          onCheckedChange={(checked) => toggle(value, checked === true)}
                          className="mt-0.5"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

function MrsField({
  control,
  field,
  disabled,
}: {
  control: FieldControl;
  field: FieldDef;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={field.key}
      render={({ field: f }) => (
        <FormItem className="flex flex-col gap-2 border-b py-3 last:border-b-0 md:flex-row md:items-center md:justify-between">
          <FormLabel className="font-normal">{field.label}</FormLabel>
          <FormControl>
            <ToggleGroup
              type="single"
              variant="outline"
              disabled={disabled}
              value={(f.value as string | null | undefined) ?? ''}
              onValueChange={(value) => f.onChange(value || null)}
              className="shrink-0"
            >
              {MRS_SCORES.map((score, index) => (
                <ToggleGroupItem
                  key={score}
                  value={score}
                  title={MRS_LABELS[index]}
                  className="h-9 w-10 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {score}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FormControl>
        </FormItem>
      )}
    />
  );
}

function ScanField({
  control,
  field,
  disabled,
}: {
  control: FieldControl;
  field: Extract<FieldDef, { kind: 'scan' }>;
  disabled?: boolean;
}) {
  const status = useWatch({ control, name: `${field.key}.status` }) as unknown as string | null;
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="text-sm font-semibold">{field.label}</div>
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
        <ChoiceField
          control={control}
          name={`${field.key}.status`}
          label="Result"
          options={toOptions(SCAN_STATUSES)}
          allowClear
        />
        <TextField
          control={control}
          name={`${field.key}.date`}
          label="Date"
          type="date"
          disabled={disabled}
        />
      </div>
      {status === 'abnormal' ? (
        <TextareaField
          control={control}
          name={`${field.key}.abnormalDetails`}
          label="Abnormal details"
          required
          rows={2}
          disabled={disabled}
        />
      ) : null}
      {field.extraKey ? (
        <TextField
          control={control}
          name={field.extraKey}
          label={field.extraLabel ?? ''}
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}

function SurgeriesField({
  control,
  field,
  disabled,
}: {
  control: FieldControl;
  field: Extract<FieldDef, { kind: 'surgeries' }>;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={field.key}
      render={({ field: f }) => {
        const list = (f.value as { type: string; date: string }[] | undefined) ?? [];
        const find = (type: string) => list.find((s) => s.type === type);
        return (
          <FormItem>
            <FormLabel>{field.label}</FormLabel>
            <div className="grid gap-2 sm:grid-cols-2">
              {field.options.map(([value, label]) => {
                const entry = find(value);
                return (
                  <div
                    key={value}
                    className={cn(
                      'flex items-center gap-3 rounded-md border px-3 py-2 text-sm',
                      entry && 'border-primary/50 bg-primary-soft/50',
                    )}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                      <Checkbox
                        checked={Boolean(entry)}
                        disabled={disabled}
                        onCheckedChange={(checked) =>
                          f.onChange(
                            checked === true
                              ? [...list, { type: value, date: '' }]
                              : list.filter((s) => s.type !== value),
                          )
                        }
                      />
                      <span className="truncate">{label}</span>
                    </label>
                    {entry ? (
                      <Input
                        type="date"
                        aria-label={`${label} date`}
                        className="h-8 w-36"
                        disabled={disabled}
                        value={entry.date}
                        onChange={(e) =>
                          f.onChange(list.map((s) => (s.type === value ? { ...s, date: e.target.value } : s)))
                        }
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </FormItem>
        );
      }}
    />
  );
}

function BoolField({
  control,
  field,
  disabled,
}: {
  control: FieldControl;
  field: FieldDef;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={field.key}
      render={({ field: f }) => (
        <FormItem>
          <label className="flex h-9 cursor-pointer items-center gap-2.5 text-sm">
            <Checkbox
              checked={f.value === true}
              disabled={disabled}
              onCheckedChange={(checked) => f.onChange(checked === true)}
            />
            {field.label}
          </label>
        </FormItem>
      )}
    />
  );
}

function numberInput(key: string, integer: boolean | undefined, raw: string) {
  if (integer) return raw.replace(/\D/g, '').slice(0, 3);
  if (key === 'heightFeet') {
    const digits = raw.replace(/\D/g, '').slice(0, 3);
    return digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
  }
  const cleaned = raw.replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  return rest.length ? `${whole.slice(0, 3)}.${rest.join('').slice(0, 2)}` : whole.slice(0, 3);
}

const BMI_MIN = 15;
const BMI_MAX = 40;

const BMI_BANDS = [
  { upTo: 18.5, label: 'Underweight', bar: 'bg-info', chip: 'bg-info-soft text-info-soft-foreground' },
  {
    upTo: 25,
    label: 'Normal weight',
    bar: 'bg-success',
    chip: 'bg-success-soft text-success-soft-foreground',
  },
  { upTo: 30, label: 'Overweight', bar: 'bg-warning', chip: 'bg-warning-soft text-warning-soft-foreground' },
  {
    upTo: 35,
    label: 'Obesity',
    bar: 'bg-destructive/60',
    chip: 'bg-destructive-soft text-destructive-soft-foreground',
  },
  {
    upTo: BMI_MAX,
    label: 'Severe obesity',
    bar: 'bg-destructive',
    chip: 'bg-destructive-soft text-destructive-soft-foreground',
  },
];

const BAND_WIDTHS = BMI_BANDS.map(
  (b, index) => ((b.upTo - (BMI_BANDS[index - 1]?.upTo ?? BMI_MIN)) / (BMI_MAX - BMI_MIN)) * 100,
);

const bmiPercent = (value: number) =>
  ((Math.min(Math.max(value, BMI_MIN), BMI_MAX) - BMI_MIN) / (BMI_MAX - BMI_MIN)) * 100;

function BmiReadout() {
  const { control } = useFormContext<FormValues>();
  const weight = Number(useWatch({ control, name: 'weightKg' }));
  const heightFeet = Number(useWatch({ control, name: 'heightFeet' }));
  const meters = heightFeet * 0.3048;
  const bmi = weight > 0 && meters > 0 ? weight / (meters * meters) : null;
  const band = bmi === null ? null : (BMI_BANDS.find((b) => bmi < b.upTo) ?? BMI_BANDS[BMI_BANDS.length - 1]);
  return (
    <div className="space-y-2">
      <Label>Body mass index</Label>
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm backdrop-blur-xl">
        <div className="pointer-events-none absolute -top-16 -right-12 size-44 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 size-44 rounded-full bg-success/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">BMI</div>
            {bmi === null ? (
              <div className="mt-1 text-sm text-muted-foreground">Enter weight and height to see the BMI</div>
            ) : (
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">{bmi.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">kg/m²</span>
              </div>
            )}
          </div>
          {band ? (
            <span
              className={cn(
                'rounded-full border border-border/40 px-3 py-1 text-sm font-medium shadow-xs backdrop-blur',
                band.chip,
              )}
            >
              {band.label}
            </span>
          ) : null}
        </div>
        <div className="relative mt-6">
          <div className={cn('flex h-3 gap-0.5 overflow-hidden rounded-full', bmi === null && 'opacity-40')}>
            {BMI_BANDS.map((b, index) => (
              <span
                key={b.label}
                className={cn('h-full', b.bar)}
                style={{ width: `${BAND_WIDTHS[index]}%` }}
              />
            ))}
          </div>
          {bmi !== null ? (
            <span
              className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-background bg-foreground shadow-md ring-1 ring-border transition-[left] duration-500"
              style={{ left: `${bmiPercent(bmi)}%` }}
              aria-hidden
            />
          ) : null}
          <div className="relative mt-2 h-4 text-[11px] text-muted-foreground tabular-nums">
            {[18.5, 25, 30, 35].map((mark) => (
              <span key={mark} className="absolute -translate-x-1/2" style={{ left: `${bmiPercent(mark)}%` }}>
                {mark}
              </span>
            ))}
          </div>
        </div>
        <div className="relative mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {BMI_BANDS.map((b, index) => (
            <span key={b.label} className="inline-flex items-center gap-1.5">
              <span className={cn('size-2 rounded-full', b.bar)} />
              {b.label}
              <span className="tabular-nums opacity-70">
                {index === 0
                  ? '< 18.5'
                  : index === BMI_BANDS.length - 1
                    ? '35+'
                    : `${BMI_BANDS[index - 1]?.upTo ?? ''}–${(b.upTo - 0.1).toFixed(1)}`}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function FieldRenderer({ field, disabled }: { field: FieldDef; disabled?: boolean }) {
  const { control } = useFormContext<FormValues>();
  const required = 'required' in field ? field.required : undefined;
  const description = 'description' in field ? field.description : undefined;
  switch (field.kind) {
    case 'heading':
      return (
        <div className="border-b pt-2 pb-2">
          <h3 className="text-sm font-semibold">{field.label}</h3>
          {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      );
    case 'textarea':
      return (
        <TextareaField
          control={control}
          name={field.key}
          label={field.label}
          required={required}
          description={description}
          disabled={disabled}
          rows={3}
        />
      );
    case 'number':
      return (
        <FormField
          control={control}
          name={field.key}
          render={({ field: f }) => (
            <FormItem>
              <FormLabel>
                {field.label}
                {required ? <span className="text-destructive">*</span> : null}
              </FormLabel>
              <FormControl>
                <Input
                  value={typeof f.value === 'string' || typeof f.value === 'number' ? String(f.value) : ''}
                  onChange={(e) => f.onChange(numberInput(field.key, field.integer, e.target.value))}
                  onBlur={f.onBlur}
                  name={f.name}
                  ref={f.ref}
                  disabled={disabled}
                  inputMode={field.integer || field.key === 'heightFeet' ? 'numeric' : 'decimal'}
                  autoComplete="off"
                />
              </FormControl>
              {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
              <FormMessage />
            </FormItem>
          )}
        />
      );
    case 'bmi':
      return <BmiReadout />;
    case 'date':
    case 'text':
      return (
        <TextField
          control={control}
          name={field.key}
          label={field.label}
          type={field.kind === 'date' ? 'date' : 'text'}
          required={required}
          description={description}
          disabled={disabled}
        />
      );
    case 'yesNo':
      return (
        <ChoiceField
          control={control}
          name={field.key}
          label={field.label}
          required={required}
          options={toOptions(YES_NO)}
          allowClear
        />
      );
    case 'choice':
      return (
        <ChoiceField
          control={control}
          name={field.key}
          label={field.label}
          required={required}
          options={toOptions(field.options)}
          allowClear
        />
      );
    case 'bool':
      return <BoolField control={control} field={field} disabled={disabled} />;
    case 'checks':
      return <CheckGroupField control={control} field={field} disabled={disabled} />;
    case 'mrs':
      return <MrsField control={control} field={field} disabled={disabled} />;
    case 'scan':
      return <ScanField control={control} field={field} disabled={disabled} />;
    case 'surgeries':
      return <SurgeriesField control={control} field={field} disabled={disabled} />;
  }
}

export function VisibleFields({ section, disabled }: { section: SectionDef; disabled?: boolean }) {
  const { control } = useFormContext<FormValues>();
  const values = useWatch({ control }) as FormValues;
  const mrsLayout = section.key === 'mrs_scale';
  return (
    <div className={cn('grid items-start gap-x-6 gap-y-5', !mrsLayout && 'md:grid-cols-2')}>
      {section.fields
        .filter((field) => isVisible(field, values))
        .map((field) => (
          <div
            key={field.key}
            className={cn(
              (field.kind === 'heading' || field.kind === 'bmi' || ('wide' in field && field.wide)) &&
                'md:col-span-2',
              mrsLayout && field.kind === 'mrs' && '-my-2.5',
            )}
          >
            <FieldRenderer field={field} disabled={disabled} />
          </div>
        ))}
    </div>
  );
}

interface SectionFormProps {
  consultation: Consultation;
  section: SectionDef;
  state: SectionState | null | undefined;
  defaults?: FormValues;
  readOnly?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  aside?: ReactNode;
  footer?: (saved: boolean) => ReactNode;
  onSaved?: () => void;
}

export function SectionForm({
  consultation,
  section,
  state,
  defaults,
  readOnly,
  onDirtyChange,
  aside,
  footer,
  onSaved,
}: SectionFormProps) {
  const save = useSaveSection(consultation);
  const form = useForm<FormValues>({
    resolver: sectionResolver(section),
    defaultValues: toFormValues(section, state?.data, defaults),
  });
  const dirty = form.formState.isDirty;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const submit = form.handleSubmit((values) =>
    save.mutate(
      { key: section.key, data: toApiData(section, values) },
      {
        onSuccess: () => {
          form.reset(values);
          toast.success(`${section.title} saved`);
          onSaved?.();
        },
        onError: (error) => applyServerErrors(form, error),
      },
    ),
  );

  return (
    <Form {...form}>
      <form
        onSubmit={submit}
        noValidate
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
            event.preventDefault();
            void submit();
          }
        }}
        className="space-y-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
            {section.description ? (
              <p className="text-sm text-muted-foreground">{section.description}</p>
            ) : null}
          </div>
          <SaveState dirty={dirty} saving={save.isPending} updatedAt={state?.updatedAt} />
        </div>
        {aside}
        <fieldset disabled={readOnly} className="min-w-0">
          <VisibleFields section={section} disabled={readOnly} />
        </fieldset>
        <div className="sticky bottom-0 -mx-6 flex items-center justify-between gap-3 border-t bg-card/95 px-6 py-3 backdrop-blur">
          <span className="text-xs text-muted-foreground">Ctrl + S saves this section.</span>
          <div className="flex items-center gap-2">
            {footer?.(Boolean(state))}
            {readOnly ? null : (
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                {onSaved ? 'Save & next' : 'Save section'}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}

function SaveState({ dirty, saving, updatedAt }: { dirty: boolean; saving: boolean; updatedAt?: string }) {
  if (saving)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Saving…
      </span>
    );
  if (dirty)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-warning-soft-foreground">
        <Circle className="size-3 fill-warning text-warning" />
        Unsaved changes
      </span>
    );
  if (updatedAt)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-success">
        <CheckCircle2 className="size-3.5" />
        Saved {formatRelative(updatedAt)}
      </span>
    );
  return <span className="text-xs text-muted-foreground">Not filled yet</span>;
}
