import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckCircle2, Pencil, Plus, ScrollText, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ComboboxField } from '@/components/shared/combobox';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { FieldRow, FormSection, TextField } from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { arrayError, InlineQuantityField, InlineTextField, LineItems } from '@/components/shared/line-items';
import { DateRangeFilter, FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { useListState } from '@/hooks/use-list-state';
import { applyServerErrors, toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatMoney, isoDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { optionalText, requiredText } from '@/lib/validation';
import { accountSheetsApi, journalApi, type JournalEntry } from './api';

const amount = z
  .string()
  .trim()
  .regex(/^(\d{1,10}(\.\d{1,2})?)?$/, 'Amount');

const cents = (value: string | undefined) => Math.round((Number(value) || 0) * 100);

const schema = z
  .object({
    date: z.string().min(1, 'Choose a date'),
    narration: requiredText(2000, 'Narration'),
    reference: optionalText(150),
    lines: z
      .array(
        z.object({
          accountSheetId: z.string().min(1, 'Choose an account'),
          description: optionalText(1000),
          debit: amount,
          credit: amount,
        }),
      )
      .min(2, 'A journal entry needs at least two lines'),
  })
  .superRefine((v, ctx) => {
    v.lines.forEach((line, index) => {
      const debit = cents(line.debit);
      const credit = cents(line.credit);
      if (debit > 0 === credit > 0)
        ctx.addIssue({ code: 'custom', path: ['lines', index, 'debit'], message: 'Debit or credit' });
    });
    const debit = v.lines.reduce((sum, l) => sum + cents(l.debit), 0);
    const credit = v.lines.reduce((sum, l) => sum + cents(l.credit), 0);
    if (debit !== credit)
      ctx.addIssue({ code: 'custom', path: ['lines'], message: 'Debits and credits must be equal' });
  });

type Values = z.input<typeof schema>;

const emptyLine = { accountSheetId: '', description: null, debit: '', credit: '' };

function JournalSheet({
  entry,
  open,
  onOpenChange,
}: {
  entry: JournalEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = journalApi.useSave();
  const accounts = accountSheetsApi.useOptions({}, open);
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    values: {
      date: entry?.date ?? isoDate(),
      narration: entry?.narration ?? '',
      reference: entry?.reference ?? null,
      lines: entry?.lines.map((l) => ({
        accountSheetId: l.accountSheetId ?? '',
        description: l.description,
        debit: Number(l.debit) > 0 ? l.debit : '',
        credit: Number(l.credit) > 0 ? l.credit : '',
      })) ?? [emptyLine, emptyLine],
    },
  });
  const lines = useFieldArray({ control: form.control, name: 'lines' });
  const watched = useWatch({ control: form.control, name: 'lines' });
  const debit = watched.reduce((sum, l) => sum + cents(l.debit), 0);
  const credit = watched.reduce((sum, l) => sum + cents(l.credit), 0);
  const balanced = debit === credit && debit > 0;

  const submit = form.handleSubmit((values) =>
    save.mutate(
      {
        id: entry?.id,
        body: {
          ...values,
          lines: values.lines.map((l) => ({
            accountSheetId: l.accountSheetId,
            description: l.description,
            debit: l.debit || '0',
            credit: l.credit || '0',
          })),
        },
      },
      {
        onSuccess: () => {
          toast.success(entry ? 'Entry updated' : 'Entry posted');
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
        title={entry ? `Edit ${entry.entryNo}` : 'New general entry'}
        description="Double entry: every debit needs an equal credit."
        onSubmit={submit}
        submitting={save.isPending}
        submitLabel={entry ? 'Save changes' : 'Post entry'}
        size="lg"
      >
        <FieldRow>
          <TextField control={form.control} name="date" label="Date" type="date" required />
          <TextField control={form.control} name="reference" label="Reference" />
        </FieldRow>
        <TextField control={form.control} name="narration" label="Narration" required />
        <FormSection title="Lines">
          <LineItems
            columns={[
              { header: 'Account', width: 'minmax(0,1fr)' },
              { header: 'Description', width: '9rem' },
              { header: 'Debit', width: '7.5rem' },
              { header: 'Credit', width: '7.5rem' },
            ]}
            rowKeys={lines.fields.map((f) => f.id)}
            minRows={2}
            renderRow={(index) => [
              <ComboboxField
                key="account"
                control={form.control}
                name={`lines.${index}.accountSheetId`}
                placeholder="Account"
                options={(accounts.data ?? []).map((a) => ({
                  value: a.id,
                  label: a.accountName,
                  hint: a.accountCode,
                }))}
              />,
              <InlineTextField
                key="desc"
                control={form.control}
                name={`lines.${index}.description`}
                label="Description"
              />,
              <InlineQuantityField
                key="debit"
                control={form.control}
                name={`lines.${index}.debit`}
                label="Debit"
                decimals={2}
                placeholder="0.00"
              />,
              <InlineQuantityField
                key="credit"
                control={form.control}
                name={`lines.${index}.credit`}
                label="Credit"
                decimals={2}
                placeholder="0.00"
              />,
            ]}
            onAdd={() => lines.append(emptyLine)}
            onRemove={(index) => lines.remove(index)}
            addLabel="Add line"
            summary={
              <span
                className={cn(
                  'inline-flex items-center gap-3 tabular-nums',
                  balanced ? 'text-success' : 'text-destructive',
                )}
              >
                {balanced ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                <span>Dr {formatMoney(debit / 100)}</span>
                <span>Cr {formatMoney(credit / 100)}</span>
              </span>
            }
            error={arrayError(form.formState.errors.lines)}
          />
        </FormSection>
      </FormSheet>
    </Form>
  );
}

export function JournalPage() {
  const { can } = useAuth();
  const list = useListState({ defaultSort: '-date' });
  const query = journalApi.useList(list.query);
  const accounts = accountSheetsApi.useOptions();
  const remove = journalApi.useRemove();
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [removing, setRemoving] = useState<JournalEntry | null>(null);

  const openSheet = (entry: JournalEntry | null) => {
    setEditing(entry);
    setFormKey((k) => k + 1);
    setOpen(true);
  };

  const columns: ColumnDef<JournalEntry, unknown>[] = [
    {
      id: 'entryNo',
      header: 'Entry',
      accessorKey: 'entryNo',
      meta: { sortKey: 'entrySeq', hideable: false },
      cell: ({ row }) => <span className="font-medium">{row.original.entryNo}</span>,
    },
    {
      id: 'date',
      header: 'Date',
      accessorKey: 'date',
      meta: { sortKey: 'date' },
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      id: 'narration',
      header: 'Narration',
      accessorKey: 'narration',
      cell: ({ row }) => (
        <div className="max-w-md">
          <div className="line-clamp-1">{row.original.narration}</div>
          <div className="line-clamp-1 text-xs text-muted-foreground">
            {row.original.lines
              .map(
                (l) =>
                  `${l.accountSheet?.accountName ?? l.expenseCategory?.name ?? ''} ${Number(l.debit) > 0 ? 'Dr' : 'Cr'}`,
              )
              .join(' · ')}
          </div>
        </div>
      ),
    },
    {
      id: 'source',
      header: 'Source',
      accessorKey: 'source',
      cell: ({ row }) => (
        <StatusBadge tone={row.original.source === 'expense' ? 'warning' : 'primary'} dot={false}>
          {row.original.source === 'expense' ? 'Expense' : 'Manual'}
        </StatusBadge>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      accessorKey: 'totalDebit',
      meta: { align: 'right' },
      cell: ({ row }) => <span className="font-medium">{formatMoney(row.original.totalDebit)}</span>,
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
              hidden: !can('journal.update') || row.original.source !== 'manual',
              onSelect: () => openSheet(row.original),
            },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              hidden: !can('journal.delete') || row.original.source !== 'manual',
              onSelect: () => setRemoving(row.original),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="General entries"
        description="Double-entry journal. Expense entries are created and changed through Expenses."
        actions={
          can('journal.create') ? (
            <Button onClick={() => openSheet(null)}>
              <Plus />
              New entry
            </Button>
          ) : null
        }
      />
      <DataTable
        columns={columns}
        data={query.data?.data}
        meta={query.data?.meta}
        list={list}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        searchPlaceholder="Entry no, narration or reference"
        exportFileName="general-entries"
        onRowClick={(e) => (can('journal.update') && e.source === 'manual' ? openSheet(e) : undefined)}
        emptyTitle="No entries yet"
        emptyAction={
          can('journal.create') ? (
            <Button size="sm" onClick={() => openSheet(null)}>
              <ScrollText />
              Post entry
            </Button>
          ) : null
        }
        toolbar={
          <>
            <DateRangeFilter list={list} />
            <FilterSelect
              list={list}
              name="accountSheetId"
              allLabel="All accounts"
              className="w-44"
              options={(accounts.data ?? []).map((a) => ({
                value: a.id,
                label: a.accountName,
                hint: a.accountCode,
              }))}
            />
            <FilterSelect
              list={list}
              name="source"
              allLabel="All sources"
              options={[
                { value: 'manual', label: 'Manual' },
                { value: 'expense', label: 'Expense' },
              ]}
            />
          </>
        }
      />
      <JournalSheet key={formKey} entry={editing} open={open} onOpenChange={setOpen} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete ${removing?.entryNo ?? 'entry'}?`}
        description="The account balances are recalculated without it."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? remove
                .mutateAsync(removing.id)
                .then(() => toast.success('Entry deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
