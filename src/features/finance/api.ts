import { createCrud } from '@/lib/api/crud';
import type { Schemas } from '@/lib/api/types';

export type Bank = Schemas['Bank'];
export type AccountSheet = Schemas['AccountSheet'];
export type AccountSheetInput = Schemas['CreateAccountSheet'];

export const banksApi = createCrud<Bank, Schemas['CreateBank']>('banks', '/branch/banks');
export interface AccountSheetOption {
  id: string;
  accountName: string;
  accountCode: string;
  type: 'cash' | 'bank';
  bankName: string | null;
}

export const accountSheetsApi = createCrud<
  AccountSheet,
  AccountSheetInput,
  Partial<AccountSheetInput>,
  AccountSheetOption
>('account-sheets', '/branch/account-sheets');

export type JournalEntry = Schemas['JournalEntry'];
export type JournalInput = Schemas['CreateJournalEntry'];
export type ExpenseCategory = Schemas['ExpenseCategory'];
export type Expense = Schemas['Expense'];

const LEDGER_DEPENDENTS = ['account-sheets', 'dashboard', 'reports'];

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
