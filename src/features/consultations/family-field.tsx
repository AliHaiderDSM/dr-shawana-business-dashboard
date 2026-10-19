import { UserRound } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Choice, FieldDef } from './clinical-fields';
import type { FieldControl } from './section-form';

export interface FamilyEntry {
  relative: string;
  who: string;
  conditions: string[];
  other: string;
}

const CLOSE_FAMILY = 'close_family';

export function FamilyField({
  control,
  field,
  disabled,
}: {
  control: FieldControl;
  field: Extract<FieldDef, { kind: 'family' }>;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={field.key}
      render={({ field: f }) => {
        const list = (f.value as FamilyEntry[] | undefined) ?? [];
        const entryOf = (relative: string) => list.find((e) => e.relative === relative);
        const ordered = field.relatives.flatMap(([value]) => {
          const entry = entryOf(value);
          return entry ? [entry] : [];
        });
        const labelOf = (relative: string) =>
          field.relatives.find(([value]) => value === relative)?.[1] ?? relative;
        const patch = (relative: string, change: Partial<FamilyEntry>) =>
          f.onChange(list.map((e) => (e.relative === relative ? { ...e, ...change } : e)));
        const toggleRelative = (relative: string, checked: boolean) =>
          f.onChange(
            checked
              ? [...list, { relative, who: '', conditions: [], other: '' }]
              : list.filter((e) => e.relative !== relative),
          );
        const toggleCondition = (entry: FamilyEntry, condition: string, checked: boolean) =>
          patch(entry.relative, {
            conditions: checked
              ? [...entry.conditions, condition]
              : entry.conditions.filter((c) => c !== condition),
            ...(condition === 'other' && !checked ? { other: '' } : {}),
          });

        return (
          <FormItem>
            <FormLabel>{field.label}</FormLabel>
            <div className="flex flex-wrap gap-2">
              {field.relatives.map(([value, label]) => {
                const on = Boolean(entryOf(value));
                return (
                  <label
                    key={value}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors hover:bg-muted/50',
                      on && 'border-success bg-success-soft text-success-soft-foreground',
                      disabled && 'cursor-not-allowed opacity-70',
                    )}
                  >
                    <Checkbox
                      checked={on}
                      disabled={disabled}
                      onCheckedChange={(checked) => toggleRelative(value, checked === true)}
                    />
                    <span className="font-medium">{label}</span>
                  </label>
                );
              })}
            </div>

            {ordered.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Pick a family member first, then tick the conditions they were diagnosed with.
              </p>
            ) : (
              <div className="relative mt-1 ml-3 space-y-3 border-l-2 border-success pl-5">
                {ordered.map((entry) => (
                  <RelativeCard
                    key={entry.relative}
                    entry={entry}
                    label={labelOf(entry.relative)}
                    conditions={field.conditions}
                    disabled={disabled}
                    onWho={(who) => patch(entry.relative, { who })}
                    onOther={(other) => patch(entry.relative, { other })}
                    onToggle={(condition, checked) => toggleCondition(entry, condition, checked)}
                  />
                ))}
              </div>
            )}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

function RelativeCard({
  entry,
  label,
  conditions,
  disabled,
  onWho,
  onOther,
  onToggle,
}: {
  entry: FamilyEntry;
  label: string;
  conditions: readonly Choice[];
  disabled?: boolean;
  onWho: (who: string) => void;
  onOther: (other: string) => void;
  onToggle: (condition: string, checked: boolean) => void;
}) {
  const picked = new Set(entry.conditions);
  const closeFamily = entry.relative === CLOSE_FAMILY;
  return (
    <section className="relative rounded-xl border border-l-4 border-l-success bg-card shadow-xs">
      <span aria-hidden className="absolute top-5 -left-[22px] h-0.5 w-5 bg-success" />
      <span aria-hidden className="absolute top-[17px] -left-[27px] size-2.5 rounded-full bg-success" />
      <header className="flex flex-wrap items-center gap-3 border-b bg-success-soft/50 px-4 py-2.5">
        <UserRound className="size-4 text-success" />
        <h4 className="text-sm font-semibold">{label}</h4>
        <span className="text-xs text-muted-foreground">
          {picked.size === 0
            ? 'No condition ticked yet'
            : `${picked.size} condition${picked.size === 1 ? '' : 's'}`}
        </span>
        {closeFamily ? (
          <Input
            value={entry.who}
            disabled={disabled}
            maxLength={100}
            onChange={(e) => onWho(e.target.value)}
            placeholder="Who? e.g. aunt, grandmother, brother"
            aria-label="Which close family member"
            className="ml-auto h-8 w-full sm:w-72"
          />
        ) : null}
      </header>
      <div className="grid gap-x-4 gap-y-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {conditions.map(([value, conditionLabel]) => (
          <label
            key={value}
            className={cn(
              'flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/50',
              picked.has(value) && 'border-success/60 bg-success-soft/60',
              disabled && 'cursor-not-allowed opacity-70',
            )}
          >
            <Checkbox
              checked={picked.has(value)}
              disabled={disabled}
              onCheckedChange={(checked) => onToggle(value, checked === true)}
              className="mt-0.5"
            />
            <span>{conditionLabel}</span>
          </label>
        ))}
      </div>
      {picked.has('other') ? (
        <div className="px-4 pb-4">
          <Input
            value={entry.other}
            disabled={disabled}
            maxLength={500}
            onChange={(e) => onOther(e.target.value)}
            placeholder={`Other condition of the ${label.toLowerCase()}`}
            aria-label={`Other condition of the ${label}`}
          />
        </div>
      ) : null}
    </section>
  );
}
