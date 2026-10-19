import { Checkbox } from '@/components/ui/checkbox';
import { FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { FieldDef } from './clinical-fields';
import type { FieldControl } from './section-form';

export interface FamilyEntry {
  relative: string;
  who: string;
  conditions: string[];
  other: string;
}

const CLOSE_FAMILY = 'close_family';
const OTHER = 'other';

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
        const entryOf = (relative: string): FamilyEntry =>
          list.find((e) => e.relative === relative) ?? { relative, who: '', conditions: [], other: '' };
        const save = (next: FamilyEntry) => {
          const keep = next.conditions.length > 0 || next.who.trim() !== '';
          const rest = list.filter((e) => e.relative !== next.relative);
          const order = field.relatives.map(([value]) => value);
          f.onChange(
            (keep ? [...rest, next] : rest).sort(
              (a, b) => order.indexOf(a.relative) - order.indexOf(b.relative),
            ),
          );
        };
        const toggle = (relative: string, condition: string, checked: boolean) => {
          const entry = entryOf(relative);
          save({
            ...entry,
            conditions: checked
              ? [...entry.conditions, condition]
              : entry.conditions.filter((c) => c !== condition),
            other: condition === OTHER && !checked ? '' : entry.other,
          });
        };
        const count = (relative: string) => entryOf(relative).conditions.length;

        return (
          <FormItem>
            <FormLabel>{field.label}</FormLabel>
            <p className="text-sm text-muted-foreground">
              Tick the condition under the family member who had it. Each column belongs to one person.
            </p>
            <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
              <table className="w-full min-w-160 text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="w-[34%] px-4 py-3 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Condition
                    </th>
                    {field.relatives.map(([value, label]) => {
                      const active = count(value) > 0;
                      return (
                        <th
                          key={value}
                          className={cn(
                            'border-l px-3 py-3 text-center align-top font-semibold',
                            active && 'border-t-[3px] border-t-success bg-success-soft/50',
                          )}
                        >
                          <div>{label}</div>
                          <div
                            className={cn(
                              'mt-0.5 text-xs font-normal',
                              active ? 'text-success-soft-foreground' : 'text-muted-foreground',
                            )}
                          >
                            {active ? `${count(value)} selected` : 'None'}
                          </div>
                          {value === CLOSE_FAMILY ? (
                            <Input
                              value={entryOf(value).who}
                              disabled={disabled}
                              maxLength={100}
                              onChange={(e) => save({ ...entryOf(value), who: e.target.value })}
                              placeholder="Who? e.g. aunt"
                              aria-label="Which close family member"
                              className="mt-2 h-8 text-xs font-normal"
                            />
                          ) : null}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {field.conditions.map(([condition, conditionLabel]) => (
                    <tr key={condition} className="hover:bg-muted/30">
                      <th scope="row" className="px-4 py-2.5 text-left font-medium">
                        {conditionLabel}
                      </th>
                      {field.relatives.map(([relative, relativeLabel]) => {
                        const entry = entryOf(relative);
                        const checked = entry.conditions.includes(condition);
                        return (
                          <td
                            key={relative}
                            className={cn(
                              'border-l px-3 py-2.5 text-center align-top',
                              checked && 'bg-success-soft/60',
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={disabled}
                              aria-label={`${relativeLabel}: ${conditionLabel}`}
                              onCheckedChange={(value) => toggle(relative, condition, value === true)}
                            />
                            {condition === OTHER && checked ? (
                              <Input
                                value={entry.other}
                                disabled={disabled}
                                maxLength={500}
                                onChange={(e) => save({ ...entry, other: e.target.value })}
                                placeholder="Which?"
                                aria-label={`Other condition of ${relativeLabel}`}
                                className="mt-2 h-8 text-xs"
                              />
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
