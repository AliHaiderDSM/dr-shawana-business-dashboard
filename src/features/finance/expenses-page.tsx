import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Banknote, FileText, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { openSignedUrl } from '@/components/shared/attachment-list';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { FilePicker } from '@/components/shared/file-upload';
import { FieldRow, MoneyField, SelectField, TextField, TextareaField } from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { DateRangeFilter, FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { Button } from '@/components/ui/button';
import { Form, FormItem, FormLabel } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useListState } from '@/hooks/use-list-state';
import { api, jsonFormData, unwrap, uploadForm } from '@/lib/api/client';
import { applyServerErrors, toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatMoney, isoDate } from '@/lib/format';
import { moneyString, optionalText, requiredText } from '@/lib/validation';
import {
  accountSheetsApi,
  expenseCategoriesApi,
  expensesApi,
  type Expense,
  type ExpenseCategory,
} from './api';

const expenseSchema = z.object({
  date: z.string().min(1, 'Choose a date'),
  categoryId: z.string().min(1, 'Choose a category'),
  amount: moneyString('Amount').refine((v) => Number(v) > 0, 'Amount must be more than zero'),
  accountSheetId: z.string().min(1, 'Choose the account it was paid from'),
  note: optionalText(2000),
});

type ExpenseValues = z.input<typeof expenseSchema>;

function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, file }: { body: z.output<typeof expenseSchema>; file: File | null }) =>
      uploadForm<Expense>('/branch/expenses', jsonFormData(body, { attachment: file })),
    onSuccess: () =>
      Promise.all(
        ['expenses', 'journal', 'account-sheets', 'dashboard', 'reports'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      ),
  });
}

function ExpenseSheet({
  expense,
  open,
  onOpenChange,
}: {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateExpense();
  const update = expensesApi.useSave();
  const categories = expenseCategoriesApi.useOptions({}, open);
  const accounts = accountSheetsApi.useOptions({}, open);
  const [file, setFile] = useState<File | null>(null);
  const form = useForm<ExpenseValues, unknown, z.output<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    values: {
      date: expense?.date ?? isoDate(),
      categoryId: expense?.categoryId ?? '',
      amount: expense?.amount ?? '',
      accountSheetId: expense?.accountSheetId ?? '',
      note: expense?.note ?? null,
    },
  });

  const done = (message: string) => {
    toast.success(message);
    setFile(null);
    onOpenChange(false);
  };

  const submit = form.handleSubmit((values) => {
    if (expense) {
      update.mutate(
        { id: expense.id, body: values },
        { onSuccess: () => done('Expense updated'), onError: (error) => applyServerErrors(form, error) },
      );
      return;
    }
    create.mutate(
      { body: values, file },
      { onSuccess: () => done('Expense recorded'), onError: (error) => applyServerErrors(form, error) },
    );
  });

  return (
    <Form {...form}>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title={expense ? 'Edit expense' : 'New expense'}
        description="Each expense posts a journal entry that reduces the paying account."
        onSubmit={submit}
        submitting={create.isPending || update.isPending}
        submitLabel={expense ? 'Save changes' : 'Record expense'}
      >
        <FieldRow>
          <TextField control={form.control} name="date" label="Date" type="date" required />
          <MoneyField control={form.control} name="amount" label="Amount" required />
        </FieldRow>
        <FieldRow>
          <SelectField
            control={form.control}
            name="categoryId"
            label="Category"
            required
            placeholder="Choose category"
            options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
          <SelectField
            control={form.control}
            name="accountSheetId"
            label="Paid from"
            required
            placeholder="Choose account"
            options={(accounts.data ?? []).map((a) => ({ value: a.id, label: a.accountName, hint: a.type }))}
          />
        </FieldRow>
        <TextareaField control={form.control} name="note" label="Note" rows={2} />
        {expense ? null : (
          <FormItem>
            <FormLabel>Receipt</FormLabel>
            <FilePicker
              files={file ? [file] : []}
              maxFiles={1}
              onChange={(files) => setFile(files[0] ?? null)}
            />
          </FormItem>
        )}
      </FormSheet>
    </Form>
  );
}

const categorySchema = z.object({ name: requiredText(100, 'Name') });

function CategorySheet({
  category,
  open,
  onOpenChange,
}: {
  category: ExpenseCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = expenseCategoriesApi.useSave();
  const form = useForm<z.input<typeof categorySchema>, unknown, z.output<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    values: { name: category?.name ?? '' },
  });
  const submit = form.handleSubmit((body) =>
    save.mutate(
      { id: category?.id, body },
      {
        onSuccess: () => {
          toast.success(category ? 'Category updated' : 'Category created');
          onOpenChange(false);
        },
        onError: (error) => applyServerErrors(form, error),
      },
    ),
  );
  return (
    <Form {...form}>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title={category ? 'Edit category' : 'New expense category'}
        onSubmit={submit}
        submitting={save.isPending}
        submitLabel={category ? 'Save changes' : 'Create category'}
      >
        <TextField control={form.control} name="name" label="Name" placeholder="Utilities" required />
      </FormSheet>
    </Form>
  );
}

function ExpensesTab() {
  const { can } = useAuth();
  const list = useListState({ defaultSort: '-date' });
  const query = expensesApi.useList(list.query);
  const categories = expenseCategoriesApi.useOptions();
  const accounts = accountSheetsApi.useOptions();
  const remove = expensesApi.useRemove();
  const [editing, setEditing] = useState<Expense | null>(null);
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [removing, setRemoving] = useState<Expense | null>(null);

  const openSheet = (expense: Expense | null) => {
    setEditing(expense);
    setFormKey((k) => k + 1);
    setOpen(true);
  };

  const columns: ColumnDef<Expense, unknown>[] = [
    {
      id: 'date',
      header: 'Date',
      accessorKey: 'date',
      meta: { sortKey: 'date' },
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      id: 'category',
      header: 'Category',
      accessorFn: (e) => e.category?.name ?? '',
      meta: { hideable: false },
      cell: ({ row }) => <span className="font-medium">{row.original.category?.name}</span>,
    },
    { id: 'account', header: 'Paid from', accessorFn: (e) => e.accountSheet?.accountName ?? '' },
    {
      id: 'note',
      header: 'Note',
      accessorKey: 'note',
      cell: ({ row }) => (
        <span className="line-clamp-1 max-w-64 text-muted-foreground">{row.original.note ?? '—'}</span>
      ),
    },
    {
      id: 'receipt',
      header: 'Receipt',
      accessorFn: (e) => (e.hasAttachment ? 'Yes' : ''),
      cell: ({ row }) =>
        row.original.hasAttachment ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={(event) => {
              event.stopPropagation();
              void openSignedUrl(() =>
                unwrap(
                  api.GET('/branch/expenses/{id}/attachment-url', {
                    params: { path: { id: row.original.id } },
                  }),
                ).then((r) => r.data),
              );
            }}
          >
            <FileText />
            View
          </Button>
        ) : (
          '—'
        ),
    },
    {
      id: 'amount',
      header: 'Amount',
      accessorKey: 'amount',
      meta: { sortKey: 'amount', align: 'right' },
      cell: ({ row }) => <span className="font-medium">{formatMoney(row.original.amount)}</span>,
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right', hideable: false },
      cell: ({ row }) => (
        <RowActions
          actions={[
            {
              label: 'Edit',
              icon: Pencil,
              hidden: !can('expenses.update'),
              onSelect: () => openSheet(row.original),
            },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              hidden: !can('expenses.delete'),
              onSelect: () => setRemoving(row.original),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={query.data?.data}
        meta={query.data?.meta}
        list={list}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        searchPlaceholder="Search note"
        exportFileName="expenses"
        onRowClick={can('expenses.update') ? openSheet : undefined}
        emptyTitle="No expenses yet"
        actions={
          can('expenses.create') ? (
            <Button size="sm" onClick={() => openSheet(null)}>
              <Plus />
              New expense
            </Button>
          ) : null
        }
        toolbar={
          <>
            <DateRangeFilter list={list} />
            <FilterSelect
              list={list}
              name="categoryId"
              allLabel="All categories"
              className="w-44"
              options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
            <FilterSelect
              list={list}
              name="accountSheetId"
              allLabel="All accounts"
              className="w-44"
              options={(accounts.data ?? []).map((a) => ({ value: a.id, label: a.accountName }))}
            />
          </>
        }
      />
      <ExpenseSheet key={formKey} expense={editing} open={open} onOpenChange={setOpen} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Delete this expense?"
        description="Its journal entry is removed too and the account balance goes back up."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? remove
                .mutateAsync(removing.id)
                .then(() => toast.success('Expense deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}

function CategoriesTab() {
  const { can } = useAuth();
  const list = useListState({ prefix: 'c_', defaultSort: 'name' });
  const query = expenseCategoriesApi.useList(list.query);
  const remove = expenseCategoriesApi.useRemove();
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<ExpenseCategory | null>(null);

  const openSheet = (category: ExpenseCategory | null) => {
    setEditing(category);
    setOpen(true);
  };

  const columns: ColumnDef<ExpenseCategory, unknown>[] = [
    {
      id: 'name',
      header: 'Name',
      accessorKey: 'name',
      meta: { sortKey: 'name', hideable: false },
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      id: 'createdAt',
      header: 'Created',
      accessorKey: 'createdAt',
      meta: { sortKey: 'createdAt' },
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right', hideable: false },
      cell: ({ row }) => (
        <RowActions
          actions={[
            {
              label: 'Edit',
              icon: Pencil,
              hidden: !can('expenses.update'),
              onSelect: () => openSheet(row.original),
            },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              hidden: !can('expenses.delete'),
              onSelect: () => setRemoving(row.original),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={query.data?.data}
        meta={query.data?.meta}
        list={list}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        searchPlaceholder="Search categories"
        onRowClick={can('expenses.update') ? openSheet : undefined}
        emptyTitle="No categories yet"
        actions={
          can('expenses.create') ? (
            <Button size="sm" onClick={() => openSheet(null)}>
              <Tags />
              New category
            </Button>
          ) : null
        }
      />
      <CategorySheet category={editing} open={open} onOpenChange={setOpen} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete ${removing?.name ?? 'category'}?`}
        description="This is refused while expenses use it."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? remove
                .mutateAsync(removing.id)
                .then(() => toast.success('Category deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}

export function ExpensesPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'categories' ? 'categories' : 'expenses';
  return (
    <>
      <PageHeader title="Expenses" description="Money spent from cash and bank accounts, by category." />
      <Tabs
        value={tab}
        onValueChange={(value) =>
          setParams(value === 'categories' ? { tab: 'categories' } : {}, { replace: true })
        }
      >
        <TabsList className="mb-4">
          <TabsTrigger value="expenses">
            <Banknote />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="categories">
            <Tags />
            Categories
          </TabsTrigger>
        </TabsList>
        <TabsContent value="expenses">
          <ExpensesTab />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
