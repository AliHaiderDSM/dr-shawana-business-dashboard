import type { ReportValue } from '@redux/features/reports/types';
import type { paths } from '@/lib/api/schema';

type ReportPath = Extract<keyof paths, `/branch/reports/${string}`>;

export function reportPath(key: string) {
  return `/branch/reports/${key}` as ReportPath;
}

const NUMBER = /^-?\d+(\.\d+)?$/;

const PHONE_LIKE = /^\+?\d{10,}$/;

export function isNumeric(value: ReportValue) {
  if (typeof value === 'string' && (PHONE_LIKE.test(value) || /^0\d/.test(value))) return false;
  return typeof value === 'number' || (typeof value === 'string' && NUMBER.test(value));
}

export function displayValue(value: ReportValue) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (isNumeric(value)) return Number(value).toLocaleString('en-PK', { maximumFractionDigits: 2 });
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [y, m, d] = String(value).split('-');
    return `${d}-${m}-${y}`;
  }
  return String(value);
}
