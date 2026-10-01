import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Trash2, Truck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { FieldRow, SelectField, TextField, TextareaField } from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useListState } from '@/hooks/use-list-state';
import { applyServerErrors, toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate } from '@/lib/format';
import { optionalText, phoneString, requiredText } from '@/lib/validation';
import { suppliersApi, type Supplier } from './api';

type PartyType = 'supplier' | 'dispatcher';

const schema = z.object({
  name: requiredText(150, 'Name'),
  phone: phoneString,
  address: optionalText(500),
  type: z.enum(['supplier', 'dispatcher']),
});

type Values = z.input<typeof schema>;

const LABEL: Record<PartyType, string> = { supplier: 'Supplier', dispatcher: 'Dispatcher' };

function PartySheet({
  open,
  onOpenChange,
  party,
  type,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  party: Supplier | null;
  type: PartyType;
}) {
  const save = suppliersApi.useSave();
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    values: {
      name: party?.name ?? '',
      phone: party?.phone ?? '',
      address: party?.address ?? null,
      type: (party?.type as PartyType) ?? type,
    },
  });

  const submit = form.handleSubmit((body) =>
    save.mutate(
      { id: party?.id, body },
      {
        onSuccess: () => {
          toast.success(`${LABEL[body.type]} ${party ? 'updated' : 'added'}`);
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
        title={
          party ? `Edit ${LABEL[party.type as PartyType].toLowerCase()}` : `New ${LABEL[type].toLowerCase()}`
        }
        description="Suppliers deliver stock in; dispatchers carry stock out."
        onSubmit={submit}
        submitting={save.isPending}
        submitLabel={party ? 'Save changes' : 'Add'}
      >
        <TextField control={form.control} name="name" label="Name" required />
        <FieldRow>
          <TextField control={form.control} name="phone" label="Phone" placeholder="923001234567" required />
          <SelectField
            control={form.control}
            name="type"
            label="Type"
            options={[
              { value: 'supplier', label: 'Supplier' },
              { value: 'dispatcher', label: 'Dispatcher' },
            ]}
          />
        </FieldRow>
        <TextareaField control={form.control} name="address" label="Address" rows={3} />
      </FormSheet>
    </Form>
  );
}

export function SupplyChainPage() {
  const { can } = useAuth();
  const list = useListState({ defaultSort: 'name' });
  const type: PartyType = list.filters.type === 'dispatcher' ? 'dispatcher' : 'supplier';
  const query = suppliersApi.useList({ ...list.query, type });
  const remove = suppliersApi.useRemove();
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<Supplier | null>(null);

  const openSheet = (party: Supplier | null) => {
    setEditing(party);
    setOpen(true);
  };

  const columns: ColumnDef<Supplier, unknown>[] = [
    {
      id: 'name',
      header: 'Name',
      accessorKey: 'name',
      meta: { sortKey: 'name', hideable: false },
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    { id: 'phone', header: 'Phone', accessorKey: 'phone' },
    {
      id: 'address',
      header: 'Address',
      accessorKey: 'address',
      cell: ({ row }) => (
        <span className="line-clamp-1 text-muted-foreground">{row.original.address ?? '—'}</span>
      ),
    },
    {
      id: 'createdAt',
      header: 'Added',
      accessorKey: 'createdAt',
      meta: { sortKey: 'createdAt', exportValue: (r: unknown) => formatDate((r as Supplier).createdAt) },
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
              hidden: !can('suppliers.update'),
              onSelect: () => openSheet(row.original),
            },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              hidden: !can('suppliers.delete'),
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
        title="Supply chain"
        description="Suppliers who deliver stock and dispatchers who carry it out."
        actions={
          can('suppliers.create') ? (
            <Button onClick={() => openSheet(null)}>
              <Plus />
              New {LABEL[type].toLowerCase()}
            </Button>
          ) : null
        }
      />
      <Tabs
        value={type}
        onValueChange={(v) => list.setFilter('type', v === 'supplier' ? undefined : v)}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="supplier">Suppliers</TabsTrigger>
          <TabsTrigger value="dispatcher">Dispatchers</TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable
        columns={columns}
        data={query.data?.data}
        meta={query.data?.meta}
        list={list}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        searchPlaceholder={`Search ${type}s`}
        exportFileName={`${type}s`}
        emptyTitle={`No ${type}s yet`}
        emptyAction={
          can('suppliers.create') ? (
            <Button size="sm" onClick={() => openSheet(null)}>
              <Truck />
              Add {LABEL[type].toLowerCase()}
            </Button>
          ) : null
        }
      />
      <PartySheet open={open} onOpenChange={setOpen} party={editing} type={type} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete ${removing?.name ?? ''}?`}
        description="Past stock entries keep their reference."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? remove
                .mutateAsync(removing.id)
                .then(() => toast.success('Deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
