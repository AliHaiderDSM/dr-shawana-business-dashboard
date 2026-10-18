import type { Schemas } from '@/lib/api/types';

export type AccountSheet = Schemas['AccountSheet'];
export type AccountSheetInput = Schemas['CreateAccountSheet'];

export interface AccountSheetOption {
  id: string;
  accountName: string;
  accountCode: string;
  type: 'cash' | 'bank';
  bankName: string | null;
}

export type JournalEntry = Schemas['JournalEntry'];
export type JournalInput = Schemas['CreateJournalEntry'];
export type ExpenseCategory = Schemas['ExpenseCategory'];
export type Expense = Schemas['Expense'];

export interface CreateExpenseWithAttachmentArgs {
  body: Schemas['CreateExpense'];
  file: File | null;
}
