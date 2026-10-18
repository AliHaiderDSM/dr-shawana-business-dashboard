import { baseApi, toApi } from '@redux/api/baseApi';
import { createCrud } from '@redux/api/crud';
import type { TagType } from '@redux/api/tagTypes';
import { store } from '@redux/store';
import { api, jsonFormData, unwrap, uploadForm } from '@/lib/api/client';
import type { Schemas } from '@/lib/api/types';
import type {
  AccountSheet,
  AccountSheetInput,
  AccountSheetOption,
  CreateExpenseWithAttachmentArgs,
  Expense,
  ExpenseCategory,
  JournalEntry,
  JournalInput,
} from './types';

export type * from './types';

export const accountSheetsApi = createCrud<
  AccountSheet,
  AccountSheetInput,
  Partial<AccountSheetInput>,
  AccountSheetOption
>('account-sheets', '/branch/account-sheets');

const LEDGER_DEPENDENTS: TagType[] = ['account-sheets', 'dashboard', 'reports'];

export const journalApi = createCrud<JournalEntry, JournalInput, Schemas['UpdateJournalEntry']>(
  'journal',
  '/branch/journal-entries',
  { invalidates: LEDGER_DEPENDENTS },
);

export const expenseCategoriesApi = createCrud<ExpenseCategory, Schemas['CreateExpenseCategory']>(
  'expense-categories',
  '/branch/expense-categories',
);

export const expensesApi = createCrud<Expense, Schemas['CreateExpense'], Schemas['UpdateExpense']>(
  'expenses',
  '/branch/expenses',
  { invalidates: ['journal', ...LEDGER_DEPENDENTS] },
);

const EXPENSE_INVALIDATES: TagType[] = ['expenses', 'journal', 'account-sheets', 'dashboard', 'reports'];

const requestExpenseAttachmentUrl = (id: string) =>
  unwrap(api.GET('/branch/expenses/{id}/attachment-url', { params: { path: { id } } })).then((r) => r.data);

export const financeApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    createExpenseWithAttachment: build.mutation<Expense, CreateExpenseWithAttachmentArgs>({
      queryFn: ({ body, file }) =>
        toApi(() => uploadForm<Expense>('/branch/expenses', jsonFormData(body, { attachment: file }))),
      invalidatesTags: (_result, error) => (error ? [] : EXPENSE_INVALIDATES),
    }),
    getExpenseAttachmentUrl: build.query<Awaited<ReturnType<typeof requestExpenseAttachmentUrl>>, string>({
      queryFn: (id) => toApi(() => requestExpenseAttachmentUrl(id)),
    }),
  }),
  overrideExisting: false,
});

export const { useCreateExpenseWithAttachmentMutation, useLazyGetExpenseAttachmentUrlQuery } = financeApi;

export function expenseAttachmentUrl(
  id: string,
): Promise<(typeof financeApi.endpoints.getExpenseAttachmentUrl)['Types']['ResultType']> {
  return store
    .dispatch(
      financeApi.endpoints.getExpenseAttachmentUrl.initiate(id, { subscribe: false, forceRefetch: true }),
    )
    .unwrap();
}
