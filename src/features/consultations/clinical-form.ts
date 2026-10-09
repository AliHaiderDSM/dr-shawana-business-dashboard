import type { FieldErrors, Resolver } from 'react-hook-form';
import type { FieldDef, FormValues, SectionDef } from './clinical-fields';

type InputField = Exclude<FieldDef, { kind: 'heading' | 'bmi' }>;

interface ScanValue {
  status: string | null;
  date: string;
  abnormalDetails: string;
}

interface SurgeryValue {
  type: string;
  date: string;
}

const isInput = (field: FieldDef): field is InputField => field.kind !== 'heading' && field.kind !== 'bmi';

const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));
const nullable = (value: unknown) => {
  const trimmed = typeof value === 'string' ? value.trim() : value;
  return trimmed === '' || trimmed === undefined ? null : trimmed;
};

export function isVisible(field: FieldDef, values: FormValues) {
  return !field.when || field.when(values);
}

export function toFormValues(
  section: SectionDef,
  data: Record<string, unknown> | undefined,
  defaults: FormValues = {},
) {
  const source = {
    ...defaults,
    ...Object.fromEntries(Object.entries(data ?? {}).filter(([, v]) => v !== null)),
  };
  const values: FormValues = {};
  for (const field of section.fields.filter(isInput)) {
    const raw = source[field.key];
    switch (field.kind) {
      case 'checks':
        values[field.key] = Array.isArray(raw) ? raw : [];
        if (field.severityKey) {
          const severity = source[field.severityKey];
          values[field.severityKey] =
            severity && typeof severity === 'object' ? { ...(severity as Record<string, number>) } : {};
        }
        break;
      case 'bool':
        values[field.key] = raw === true;
        break;
      case 'yesNo':
      case 'choice':
        values[field.key] = raw ?? null;
        break;
      case 'mrs':
        values[field.key] = raw === null || raw === undefined ? null : String(raw);
        break;
      case 'scan': {
        const scan = (raw ?? {}) as Partial<Record<keyof ScanValue, string | null>>;
        values[field.key] = {
          status: scan.status ?? null,
          date: text(scan.date),
          abnormalDetails: text(scan.abnormalDetails),
        } satisfies ScanValue;
        if (field.extraKey) values[field.extraKey] = text(source[field.extraKey]);
        break;
      }
      case 'surgeries':
        values[field.key] = Array.isArray(raw)
          ? (raw as { type: string; date: string | null }[]).map((s) => ({
              type: s.type,
              date: text(s.date),
            }))
          : [];
        break;
      default:
        values[field.key] = text(raw);
    }
  }
  return values;
}

export function toApiData(section: SectionDef, values: FormValues) {
  const data: Record<string, unknown> = {};
  for (const field of section.fields.filter(isInput)) {
    const visible = isVisible(field, values);
    const raw = values[field.key];
    switch (field.kind) {
      case 'checks':
        data[field.key] = visible ? raw : [];
        if (field.severityKey) {
          const picked = new Set(visible ? (raw as string[]) : []);
          const severity = (values[field.severityKey] ?? {}) as Record<string, number>;
          data[field.severityKey] = Object.fromEntries(
            Object.entries(severity).filter(([key]) => picked.has(key)),
          );
        }
        break;
      case 'bool':
        data[field.key] = visible ? raw === true : false;
        break;
      case 'number': {
        const value = visible ? nullable(raw) : null;
        data[field.key] = value === null ? null : Number(value);
        break;
      }
      case 'mrs':
        data[field.key] = raw === null || raw === undefined ? null : Number(raw);
        break;
      case 'scan': {
        const scan = raw as ScanValue;
        data[field.key] = {
          status: scan.status,
          date: nullable(scan.date),
          abnormalDetails: scan.status === 'abnormal' ? nullable(scan.abnormalDetails) : null,
        };
        if (field.extraKey) data[field.extraKey] = nullable(values[field.extraKey]);
        break;
      }
      case 'surgeries':
        data[field.key] = (raw as SurgeryValue[]).map((s) => ({ type: s.type, date: nullable(s.date) }));
        break;
      default:
        data[field.key] = visible ? nullable(raw) : null;
    }
  }
  return data;
}

const NUMBER = /^\d{1,6}(\.\d{1,2})?$/;

export function sectionResolver(section: SectionDef): Resolver<FormValues> {
  return (values) => {
    const errors: Record<string, unknown> = {};
    for (const field of section.fields.filter(isInput)) {
      if (!isVisible(field, values)) continue;
      const raw = values[field.key];
      const empty =
        raw === null ||
        raw === undefined ||
        (typeof raw === 'string' && raw.trim() === '') ||
        (Array.isArray(raw) && raw.length === 0);
      if (field.required && empty) {
        errors[field.key] = { type: 'required', message: `${field.label} is required` };
        continue;
      }
      if (field.kind === 'number' && !empty) {
        const value = String(raw).trim();
        if (field.integer ? !/^\d{1,3}$/.test(value) || Number(value) > 150 : !NUMBER.test(value))
          errors[field.key] = {
            type: 'pattern',
            message: field.integer ? 'Use a whole number up to 150' : 'Use a number with up to 2 decimals',
          };
      }
      if (field.kind === 'scan') {
        const scan = raw as ScanValue;
        if (scan.status === 'abnormal' && !scan.abnormalDetails.trim())
          errors[field.key] = {
            abnormalDetails: { type: 'required', message: 'Describe the abnormal finding' },
          };
      }
    }
    return Object.keys(errors).length
      ? { values: {}, errors: errors as FieldErrors<FormValues> }
      : { values, errors: {} };
  };
}
