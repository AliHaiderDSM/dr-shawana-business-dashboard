import { baseApi, fromApi, toApi } from '@redux/api/baseApi';
import { categoriesApi, productsApi, suppliersApi } from '@redux/features/catalog';
import { doctorsApi } from '@redux/features/doctors';
import { accountSheetsApi, expenseCategoriesApi } from '@redux/features/finance';
import { useStaffList } from '@redux/features/staff';
import { store } from '@redux/store';
import { reportPath } from '@/features/reports/constants';
import type { OptionSource } from '@/features/reports/reports-config';
import { api, fetchFile, unwrap } from '@/lib/api/client';
import type { Schemas } from '@/lib/api/types';
import { downloadXlsx, parseCsv } from '@/lib/xlsx';
import type { ProfitLossArgs, ProfitLossData, ReportArgs, ReportData } from './types';

export type * from './types';

export const reportsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getReport: build.query<ReportData, ReportArgs>({
      queryFn: ({ key, query }) =>
        fromApi<ReportData>(() =>
          unwrap(api.GET(reportPath(key), { params: { query: query as never } })).then(
            (r) => (r as { data: Schemas['Report'] }).data as unknown as ReportData,
          ),
        ),
      providesTags: ['reports'],
    }),
    getProfitLoss: build.query<ProfitLossData, ProfitLossArgs>({
      queryFn: ({ year, month, branchId }) =>
        fromApi<ProfitLossData>(() =>
          unwrap(
            api.GET('/admin/reports/profit-loss', {
              params: {
                query: { year, ...(month ? { month } : {}), ...(branchId ? { branchId } : {}) },
              },
            }),
          ).then((r) => r.data as unknown as ProfitLossData),
        ),
      providesTags: ['reports'],
    }),
    downloadReportFile: build.mutation<Blob, ReportArgs>({
      queryFn: ({ key, query }) => toApi(() => fetchFile(reportPath(key), { ...query, format: 'csv' })),
    }),
  }),
  overrideExisting: false,
});

export const { useGetReportQuery, useDownloadReportFileMutation, useGetProfitLossQuery } = reportsApi;

export function useReport(key: string, query: Record<string, string>) {
  return useGetReportQuery({ key, query });
}

export async function downloadReportExcel(key: string, title: string, query: Record<string, string>) {
  const blob = await store
    .dispatch(reportsApi.endpoints.downloadReportFile.initiate({ key, query }))
    .unwrap();
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
