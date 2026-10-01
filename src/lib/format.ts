import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

const moneyFormatter = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const quantityFormatter = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 3 });
const integerFormatter = new Intl.NumberFormat('en-PK');

const toNumber = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? null : Number(value);

export function formatMoney(value: string | number | null | undefined, fallback = '—') {
  const n = toNumber(value);
  return n === null || Number.isNaN(n) ? fallback : moneyFormatter.format(n).replace('Rs', 'Rs ');
}

const compactFormatter = new Intl.NumberFormat('en-PK', { notation: 'compact', maximumFractionDigits: 1 });

export function formatCompactMoney(value: string | number | null | undefined) {
  const n = toNumber(value);
  return n === null || Number.isNaN(n) ? '—' : `Rs ${compactFormatter.format(n)}`;
}

export function formatQuantity(value: string | number | null | undefined, fallback = '—') {
  const n = toNumber(value);
  return n === null || Number.isNaN(n) ? fallback : quantityFormatter.format(n);
}

export function formatCount(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : integerFormatter.format(value);
}

function toDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? date : null;
}

export function formatDate(value: string | Date | null | undefined, pattern = 'dd MMM yyyy') {
  const date = toDate(value);
  return date ? format(date, pattern) : '—';
}

export function formatDateTime(value: string | Date | null | undefined) {
  return formatDate(value, 'dd MMM yyyy, h:mm a');
}

export function formatRelative(value: string | Date | null | undefined) {
  const date = toDate(value);
  return date ? `${formatDistanceToNowStrict(date)} ago` : '—';
}

export function isoDate(value: Date = new Date()) {
  return format(value, 'yyyy-MM-dd');
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
