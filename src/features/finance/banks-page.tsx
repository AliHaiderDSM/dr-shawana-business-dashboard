import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { Landmark, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { TextField } from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { useListState } from '@/hooks/use-list-state';
import { applyServerErrors, toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate } from '@/lib/format';
import { requiredText } from '@/lib/validation';
import { banksApi, type Bank } from './api';

const schema = z.object({ name: requiredText(150, 'Bank name') });

function BankSheet({
  open,
  onOpenChange,
  bank,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bank: Bank | null;
}) {
  const save = banksApi.useSave();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    values: { name: bank?.name ?? '' },
  });
  const submit = form.handleSubmit((body) =>
    save.mutate(
      { id: bank?.id, body },
      {
        onSuccess: () => {
          toast.success(bank ? 'Bank updated' : 'Bank added');
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
        title={bank ? 'Edit bank' : 'New bank'}
        description="Banks group the account sheets that receive payments."
        onSubmit={submit}
        submitting={save.isPending}
        submitLabel={bank ? 'Save changes' : 'Add bank'}
      >
        <TextField control={form.control} name="name" label="Bank name" placeholder="Meezan Bank" required />
      </FormSheet>
    </Form>
  );
}

export function BanksPage() {
  const { can } = useAuth();
  const list = useListState({ defaultSort: 'name' });
  const query = banksApi.useList(list.query);
  const remove = banksApi.useRemove();
  const [editing, setEditing] = useState<Bank | null>(null);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<Bank | null>(null);

  const openSheet = (bank: Bank | null) => {
    setEditing(bank);
    setOpen(true);
  };

  const columns: ColumnDef<Bank, unknown>[] = [
    {
      id: 'name',
      header: 'Bank',
      accessorKey: 'name',
      meta: { sortKey: 'name', hideable: false },
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
            <Landmark className="size-4" />
          </div>
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
    },
    {
      id: 'createdAt',
      header: 'Added',
      accessorKey: 'createdAt',
      meta: { sortKey: 'createdAt', exportValue: (r: unknown) => formatDate((r as Bank).createdAt) },
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
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
              hidden: !can('banks.update'),
              onSelect: () => openSheet(row.original),
            },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              hidden: !can('banks.delete'),
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
        title="Banks"
        description="Banks used by this branch's account sheets."
        actions={
          can('banks.create') ? (
            <Button onClick={() => openSheet(null)}>
              <Plus />
              New bank
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
        searchPlaceholder="Search banks"
        exportFileName="banks"
        emptyTitle="No banks yet"
        emptyAction={
          can('banks.create') ? (
            <Button size="sm" onClick={() => openSheet(null)}>
              <Landmark />
              Add bank
            </Button>
          ) : null
        }
      />
      <BankSheet open={open} onOpenChange={setOpen} bank={editing} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete ${removing?.name ?? 'bank'}?`}
        description="A bank that account sheets still use cannot be deleted."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? remove
                .mutateAsync(removing.id)
                .then(() => toast.success('Bank deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
