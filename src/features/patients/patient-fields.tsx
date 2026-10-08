import { AlertTriangle } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { FieldRow, TextField, TextareaField } from '@/components/shared/form-fields';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { optionalAge, optionalText, patientPhone, requiredText } from '@/lib/validation';
import { useCities, usePhoneCheck, type Patient, type PatientInput } from './api';

export const patientFieldsSchema = z.object({
  name: requiredText(150, 'Name'),
  phone: patientPhone,
  city: requiredText(100, 'City'),
  age: optionalAge,
  dateOfBirth: z.string(),
  country: optionalText(100),
  address: optionalText(2000),
});

export type PatientFieldValues = z.input<typeof patientFieldsSchema>;

export function patientDefaults(patient?: Patient | null): PatientFieldValues {
  return {
    name: patient?.name ?? '',
    phone: patient?.phone ?? '',
    city: patient?.city ?? '',
    age: patient?.age === null || patient?.age === undefined ? '' : String(patient.age),
    dateOfBirth: patient?.dateOfBirth ?? '',
    country: patient?.country ?? 'Pakistan',
    address: patient?.address ?? null,
  };
}

export function toPatientInput(values: z.output<typeof patientFieldsSchema>): PatientInput {
  return {
    name: values.name,
    phone: values.phone,
    city: values.city,
    age: values.age ? Number(values.age) : undefined,
    dateOfBirth: values.dateOfBirth || null,
    country: values.country,
    address: values.address,
  };
}

function useDebounced<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function DuplicatePhoneNotice({
  phone,
  excludeId,
  onUseExisting,
}: {
  phone: string;
  excludeId?: string;
  onUseExisting?: (patient: { id: string; name: string; phone: string; city: string }) => void;
}) {
  const check = usePhoneCheck(useDebounced(phone), excludeId);
  const existing = check.data?.exists ? check.data.patient : null;
  if (!existing) return null;
  return (
    <div className="flex items-start gap-1.5 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2.5 text-sm text-warning-soft-foreground">
      <AlertTriangle className="size-4 shrink-0" />
      <div className="min-w-0 flex-1 text-xs">
        This number is already registered to <span className="font-semibold">{existing.name}</span>
        {check.data?.branch ? (
          <>
            {' '}
            in <span className="font-semibold">{check.data.branch}</span>
          </>
        ) : null}
        .
      </div>
      {onUseExisting ? (
        <button
          type="button"
          className="shrink-0 font-medium underline underline-offset-2"
          onClick={() => onUseExisting(existing)}
        >
          Use this patient
        </button>
      ) : (
        <Link
          to={`/patients/${existing.id}`}
          className="shrink-0 text-xs font-medium underline underline-offset-2"
        >
          Open profile
        </Link>
      )}
    </div>
  );
}

interface PatientFieldsProps {
  prefix?: string;
  excludeId?: string;
  onUseExisting?: (patient: { id: string; name: string; phone: string; city: string }) => void;
}

export function PatientFields({ prefix = '', excludeId, onUseExisting }: PatientFieldsProps) {
  const form = useFormContext();
  const cityListId = useId();
  const name = (field: keyof PatientFieldValues) => `${prefix}${field}`;
  const phone = (useWatch({ control: form.control, name: name('phone') }) as string | undefined) ?? '';
  const city = (useWatch({ control: form.control, name: name('city') }) as string | undefined) ?? '';
  const cities = useCities(useDebounced(city, 250));

  return (
    <div className="space-y-5">
      <FieldRow>
        <TextField
          control={form.control}
          name={name('phone')}
          label="Phone"
          placeholder="923001234567"
          autoComplete="off"
          required
        />
        <TextField control={form.control} name={name('name')} label="Name" required />
      </FieldRow>
      <DuplicatePhoneNotice phone={phone} excludeId={excludeId} onUseExisting={onUseExisting} />
      <FieldRow>
        <FormField
          control={form.control}
          name={name('city')}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                City<span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  list={cityListId}
                  autoComplete="off"
                  {...field}
                  value={(field.value as string) ?? ''}
                />
              </FormControl>
              <datalist id={cityListId}>
                {(cities.data ?? []).map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
              <FormMessage />
            </FormItem>
          )}
        />
        <TextField control={form.control} name={name('country')} label="Country" />
      </FieldRow>
      <FieldRow>
        <TextField control={form.control} name={name('age')} label="Age" inputMode="numeric" />
        <TextField control={form.control} name={name('dateOfBirth')} label="Date of birth" type="date" />
      </FieldRow>
      <TextareaField control={form.control} name={name('address')} label="Address" rows={2} />
    </div>
  );
}
