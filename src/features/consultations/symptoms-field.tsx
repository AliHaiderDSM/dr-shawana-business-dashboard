import { History } from 'lucide-react';
import { createContext, useContext } from 'react';
import { useController, useFormContext } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { FieldDef, FormValues } from './clinical-fields';

export interface PreviousSymptoms {
  appointmentNo: number;
  date: string;
  symptoms: string[];
  severity: Record<string, number>;
}

export const PreviousSymptomsContext = createContext<PreviousSymptoms | null>(null);

const LEVELS = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Mild' },
  { value: 2, label: 'Moderate' },
  { value: 3, label: 'Severe' },
];

const LEVEL_TONE = [
  'border-border bg-muted text-foreground',
  'border-info/40 bg-info-soft text-info-soft-foreground',
  'border-warning/40 bg-warning-soft text-warning-soft-foreground',
  'border-destructive/40 bg-destructive-soft text-destructive-soft-foreground',
];

export function SymptomsField({
  field,
  disabled,
}: {
  field: Extract<FieldDef, { kind: 'checks' }> & { severityKey: string };
  disabled?: boolean;
}) {
  const { control } = useFormContext<FormValues>();
  const previous = useContext(PreviousSymptomsContext);
  const symptoms = useController({ control, name: field.key });
  const severity = useController({ control, name: field.severityKey });
  const selected = new Set((symptoms.field.value as string[] | undefined) ?? []);
  const levels = (severity.field.value as Record<string, number> | undefined) ?? {};
  const lastLevel = (value: string) =>
    previous?.symptoms.includes(value) ? (previous.severity[value] ?? null) : undefined;

  const toggle = (value: string, checked: boolean) => {
    const next = new Set(selected);
    const nextLevels = { ...levels };
    if (checked) {
      next.add(value);
      const last = lastLevel(value);
      nextLevels[value] = typeof last === 'number' ? last : (nextLevels[value] ?? 1);
    } else {
      next.delete(value);
      delete nextLevels[value];
    }
    symptoms.field.onChange([...next]);
    severity.field.onChange(nextLevels);
  };

  const setLevel = (value: string, level: number) => severity.field.onChange({ ...levels, [value]: level });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Label>{field.label}</Label>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Tick a symptom, then rate it: 0 none · 1 mild · 2 moderate · 3 severe.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border bg-card px-2.5 py-1 font-medium tabular-nums">
            {selected.size} selected
          </span>
          {previous ? (
            <span className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-1 text-muted-foreground">
              <History className="size-3" />
              Last visit APP#{previous.appointmentNo} · {formatDate(previous.date)}
            </span>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {field.groups.map((group, index) => {
          const picked = group.options.filter(([value]) => selected.has(value)).length;
          return (
            <section
              key={group.title ?? index}
              className="overflow-hidden rounded-xl border bg-card shadow-xs"
            >
              <header className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
                <h4 className="text-sm font-semibold">{group.title}</h4>
                {picked ? (
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-soft-foreground tabular-nums">
                    {picked}
                  </span>
                ) : null}
              </header>
              <ul className="divide-y">
                {group.options.map(([value, label]) => {
                  const checked = selected.has(value);
                  const last = lastLevel(value);
                  return (
                    <li
                      key={value}
                      className={cn('px-4 py-2.5 transition-colors', checked && 'bg-primary-soft/30')}
                    >
                      <label
                        className={cn(
                          'flex cursor-pointer items-start gap-2.5 text-sm',
                          disabled && 'cursor-not-allowed opacity-70',
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={(state) => toggle(value, state === true)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1 font-medium">{label}</span>
                        {last !== undefined ? (
                          <span
                            className="shrink-0 rounded-md border bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground"
                            title={`Last visit on ${formatDate(previous?.date ?? '')}`}
                          >
                            Last: {last === null ? 'ticked' : `${last} · ${LEVELS[last]?.label ?? ''}`}
                          </span>
                        ) : null}
                      </label>
                      {checked ? (
                        <div
                          className="mt-2 ml-6.5 flex flex-wrap gap-1.5"
                          role="radiogroup"
                          aria-label={`${label} severity`}
                        >
                          {LEVELS.map((level) => {
                            const active = (levels[value] ?? null) === level.value;
                            return (
                              <button
                                key={level.value}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                disabled={disabled}
                                onClick={() => setLevel(value, level.value)}
                                className={cn(
                                  'inline-flex min-w-16 items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                                  active
                                    ? LEVEL_TONE[level.value]
                                    : 'border-border bg-card text-muted-foreground hover:bg-muted',
                                  active && 'ring-2 ring-ring/30',
                                )}
                              >
                                <span className="tabular-nums">{level.value}</span>
                                <span>{level.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
