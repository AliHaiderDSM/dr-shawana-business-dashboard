import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { materialCategoriesApi, type MaterialCategory } from './api';

const schema = z.object({ name: requiredText(100, 'Name') });
type Values = z.input<typeof schema>;

function CategorySheet({
  category,
  open,
  onOpenChange,
}: {
  category: MaterialCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = materialCategoriesApi.useSave();
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
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
        title={category ? 'Edit material category' : 'New material category'}
        onSubmit={submit}
        submitting={save.isPending}
        submitLabel={category ? 'Save changes' : 'Create category'}
      >
        <TextField control={form.control} name="name" label="Name" placeholder="Oils" required />
      </FormSheet>
    </Form>
  );
}

export function MaterialCategoriesPage() {
  const { can } = useAuth();
  const list = useListState({ defaultSort: 'name' });
  const query = materialCategoriesApi.useList(list.query);
  const remove = materialCategoriesApi.useRemove();
  const [editing, setEditing] = useState<MaterialCategory | null>(null);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<MaterialCategory | null>(null);

  const openSheet = (category: MaterialCategory | null) => {
    setEditing(category);
    setOpen(true);
  };

  const columns: ColumnDef<MaterialCategory, unknown>[] = [
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
              hidden: !can('materialCategories.update'),
              onSelect: () => openSheet(row.original),
            },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              hidden: !can('materialCategories.delete'),
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
        title="Material categories"
        description="Groups for raw materials."
        actions={
          can('materialCategories.create') ? (
            <Button onClick={() => openSheet(null)}>
              <Plus />
              New category
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
        searchPlaceholder="Search categories"
        exportFileName="material-categories"
        onRowClick={can('materialCategories.update') ? openSheet : undefined}
        emptyTitle="No material categories yet"
        emptyAction={
          can('materialCategories.create') ? (
            <Button size="sm" onClick={() => openSheet(null)}>
              <FolderTree />
              Add category
            </Button>
          ) : null
        }
      />
      <CategorySheet category={editing} open={open} onOpenChange={setOpen} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete ${removing?.name ?? 'category'}?`}
        description="This is refused while materials still use the category."
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
