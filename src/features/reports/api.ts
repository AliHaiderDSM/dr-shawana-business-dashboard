import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { categoriesApi, productsApi, suppliersApi } from '@/features/catalog/api';
import { doctorsApi } from '@/features/doctors/api';
import { accountSheetsApi, expenseCategoriesApi } from '@/features/finance/api';
import { useStaffList } from '@/features/staff/api';
import { api, fetchFile, unwrap } from '@/lib/api/client';
import { downloadXlsx, parseCsv } from '@/lib/xlsx';
import type { paths } from '@/lib/api/schema';
import type { Schemas } from '@/lib/api/types';
import type { OptionSource } from './reports-config';

export type ReportValue = string | number | boolean | null;
export interface ReportData {
  title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, ReportValue>[];
  totals?: Record<string, ReportValue>;
  byBranch?: Record<string, ReportValue>[];
  summary?: Record<string, ReportValue>;
}

type ReportPath = Extract<keyof paths, `/branch/reports/${string}`>;

export function reportPath(key: string) {
  return `/branch/reports/${key}` as ReportPath;
}

export function useReport(key: string, query: Record<string, string>) {
  return useQuery({
    queryKey: ['reports', key, query],
    queryFn: () =>
      unwrap(api.GET(reportPath(key), { params: { query: query as never } })).then(
        (r) => (r as { data: Schemas['Report'] }).data as unknown as ReportData,
      ),
    placeholderData: keepPreviousData,
  });
}

export async function downloadReportExcel(key: string, title: string, query: Record<string, string>) {
  const blob = await fetchFile(reportPath(key), { ...query, format: 'csv' });
  downloadXlsx(parseCsv(await blob.text()), key, title);
}

export function useSourceOptions(source: OptionSource, branchId?: string) {
  const scope = branchId ? { branchId } : {};
  const doctors = doctorsApi.useOptions(scope, source === 'doctors');
  const products = productsApi.useOptions(scope, source === 'products');
  const categories = categoriesApi.useOptions(scope, source === 'categories');
  const suppliers = suppliersApi.useOptions(scope, source === 'suppliers');
  const accounts = accountSheetsApi.useOptions(scope, source === 'accounts');
  const expenseCategories = expenseCategoriesApi.useOptions(scope, source === 'expenseCategories');
  const staff = useStaffList({ pageSize: 100, ...scope }, source === 'staff');
  switch (source) {
    case 'doctors':
      return (doctors.data ?? []).map((d) => ({ value: d.id, label: d.name }));
    case 'products':
      return (products.data ?? []).map((p) => ({ value: p.id, label: p.name }));
    case 'categories':
      return (categories.data ?? []).map((c) => ({ value: c.id, label: c.name }));
    case 'suppliers':
      return (suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }));
    case 'accounts':
      return (accounts.data ?? []).map((a) => ({ value: a.id, label: a.accountName }));
    case 'expenseCategories':
      return (expenseCategories.data ?? []).map((c) => ({ value: c.id, label: c.name }));
    case 'staff':
      return (staff.data?.data ?? []).map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }));
  }
}

const NUMBER = /^-?\d+(\.\d+)?$/;

const PHONE_LIKE = /^\+?\d{10,}$/;

export function isNumeric(value: ReportValue) {
  if (typeof value === 'string' && PHONE_LIKE.test(value)) return false;
  return typeof value === 'number' || (typeof value === 'string' && NUMBER.test(value));
}

export function displayValue(value: ReportValue) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (isNumeric(value)) {
    const n = Number(value);
    const decimals = String(value).includes('.') ? Math.min(String(value).split('.')[1]?.length ?? 0, 2) : 0;
    return n.toLocaleString('en-PK', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [y, m, d] = String(value).split('-');
    return `${d}-${m}-${y}`;
  }
  return String(value);
}
