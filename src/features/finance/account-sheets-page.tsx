import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { FieldRow, SelectField, TextField } from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useListState } from '@/hooks/use-list-state';
import { applyServerErrors, toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, isoDate } from '@/lib/format';
import { requiredText } from '@/lib/validation';
import { accountSheetsApi, banksApi, type AccountSheet } from './api';

const schema = z
  .object({
    accountName: requiredText(150, 'Account name'),
    accountCode: requiredText(100, 'Account number'),
    type: z.enum(['cash', 'bank']),
    bankId: z.string().nullable(),
    date: z.string().min(1, 'Choose a date'),
  })
  .refine((v) => v.type === 'cash' || Boolean(v.bankId), { path: ['bankId'], message: 'Choose the bank' });

type Values = z.input<typeof schema>;

function AccountSheetSheet({
  open,
  onOpenChange,
  sheet,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sheet: AccountSheet | null;
}) {
  const save = accountSheetsApi.useSave();
  const banks = banksApi.useOptions({}, open);
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    values: {
      accountName: sheet?.accountName ?? '',
      accountCode: sheet?.accountCode ?? '',
      type: (sheet?.type as 'cash' | 'bank') ?? 'cash',
      bankId: sheet?.bankId ?? null,
      date: sheet?.date ?? isoDate(),
    },
  });
  const type = useWatch({ control: form.control, name: 'type' });

  const submit = form.handleSubmit((values) =>
    save.mutate(
      { id: sheet?.id, body: { ...values, bankId: values.type === 'bank' ? values.bankId : null } },
      {
        onSuccess: () => {
          toast.success(sheet ? 'Account updated' : 'Account added');
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
        title={sheet ? 'Edit account sheet' : 'New account sheet'}
        description="Accounts receive cash and online payments and appear in the balance report."
        onSubmit={submit}
        submitting={save.isPending}
        submitLabel={sheet ? 'Save changes' : 'Add account'}
      >
        <TextField
          control={form.control}
          name="accountName"
          label="Account name"
          placeholder="Clinic Meezan"
          required
        />
        <FieldRow>
          <TextField control={form.control} name="accountCode" label="Account number" required />
          <SelectField
            control={form.control}
            name="type"
            label="Type"
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'bank', label: 'Bank' },
            ]}
          />
        </FieldRow>
        {type === 'bank' ? (
          <SelectField
            control={form.control}
            name="bankId"
            label="Bank"
            required
            placeholder={banks.data?.length === 0 ? 'Add a bank first' : 'Choose a bank'}
            options={(banks.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
          />
        ) : null}
        <TextField control={form.control} name="date" label="Date" type="date" required />
      </FormSheet>
    </Form>
  );
}

export function AccountSheetsPage() {
  const { can } = useAuth();
  const list = useListState({ defaultSort: 'accountName' });
  const query = accountSheetsApi.useList(list.query);
  const remove = accountSheetsApi.useRemove();
  const [editing, setEditing] = useState<AccountSheet | null>(null);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<AccountSheet | null>(null);

  const openSheet = (sheet: AccountSheet | null) => {
    setEditing(sheet);
    setOpen(true);
  };

  const columns: ColumnDef<AccountSheet, unknown>[] = [
    {
      id: 'accountName',
      header: 'Account',
      accessorKey: 'accountName',
      meta: { sortKey: 'accountName', hideable: false },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{row.original.accountName}</div>
          <div className="truncate text-xs text-muted-foreground">
            {row.original.bank?.name ?? 'Cash in hand'}
          </div>
        </div>
      ),
    },
    {
      id: 'accountCode',
      header: 'Account no.',
      accessorKey: 'accountCode',
      meta: { sortKey: 'accountCode' },
    },
    {
      id: 'type',
      header: 'Type',
      accessorKey: 'type',
      cell: ({ row }) => <StatusBadge status={row.original.type} dot={false} />,
    },
    {
      id: 'date',
      header: 'Opened',
      accessorKey: 'date',
      meta: { sortKey: 'date' },
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.date)}</span>,
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
              hidden: !can('accounts.update'),
              onSelect: () => openSheet(row.original),
            },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              hidden: !can('accounts.delete'),
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
        title="Account sheets"
        description="Cash and bank accounts that receive payments."
        actions={
          can('accounts.create') ? (
            <Button onClick={() => openSheet(null)}>
              <Plus />
              New account
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
        searchPlaceholder="Search name or number"
        exportFileName="account-sheets"
        emptyTitle="No account sheets yet"
        emptyDescription="Add the cash and bank accounts that receive money."
        emptyAction={
          can('accounts.create') ? (
            <Button size="sm" onClick={() => openSheet(null)}>
              <Wallet />
              Add account
            </Button>
          ) : null
        }
        toolbar={
          <Select
            value={list.filters.type ?? 'all'}
            onValueChange={(v) => list.setFilter('type', v === 'all' ? undefined : v)}
          >
            <SelectTrigger size="sm" className="h-9 w-32" aria-label="Type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <AccountSheetSheet open={open} onOpenChange={setOpen} sheet={editing} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete ${removing?.accountName ?? 'account'}?`}
        description="Past payments keep their reference to this account."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? remove
                .mutateAsync(removing.id)
                .then(() => toast.success('Account deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
