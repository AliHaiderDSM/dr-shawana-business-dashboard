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
import { categoriesApi, type Category } from '@redux/features/catalog';

const schema = z.object({ name: requiredText(100, 'Name') });
type Values = z.infer<typeof schema>;

function CategorySheet({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
}) {
  const [save, saveState] = categoriesApi.useSave();
  const form = useForm<Values>({ resolver: zodResolver(schema), values: { name: category?.name ?? '' } });

  const submit = form.handleSubmit(
    (values) =>
      void save({ id: category?.id, body: values })
        .unwrap()
        .then(() => {
          toast.success(category ? 'Category updated' : 'Category created');
          onOpenChange(false);
        })
        .catch((error) => applyServerErrors(form, error)),
  );

  return (
    <Form {...form}>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title={category ? 'Edit category' : 'New category'}
        description="Categories group products on the sale screen and in reports."
        onSubmit={submit}
        submitting={saveState.isLoading}
        submitLabel={category ? 'Save changes' : 'Create category'}
      >
        <TextField control={form.control} name="name" label="Name" placeholder="Skin care" required />
      </FormSheet>
    </Form>
  );
}

export function CategoriesPage() {
  const { can } = useAuth();
  const list = useListState({ defaultSort: 'name' });
  const query = categoriesApi.useList(list.query);
  const [remove] = categoriesApi.useRemove();
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<Category | null>(null);

  const openSheet = (category: Category | null) => {
    setEditing(category);
    setOpen(true);
  };

  const columns: ColumnDef<Category, unknown>[] = [
    {
      id: 'name',
      header: 'Category',
      accessorKey: 'name',
      meta: { sortKey: 'name', hideable: false },
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      id: 'createdAt',
      header: 'Created',
      accessorKey: 'createdAt',
      meta: { sortKey: 'createdAt', exportValue: (r: unknown) => formatDate((r as Category).createdAt) },
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
              hidden: !can('categories.update'),
              onSelect: () => openSheet(row.original),
            },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              hidden: !can('categories.delete'),
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
        title="Categories"
        description="Organize products into groups."
        actions={
          can('categories.create') ? (
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
        exportFileName="categories"
        emptyTitle="No categories yet"
        emptyDescription="Create a category before adding products."
        emptyAction={
          can('categories.create') ? (
            <Button size="sm" onClick={() => openSheet(null)}>
              <FolderTree />
              Create category
            </Button>
          ) : null
        }
      />
      <CategorySheet open={open} onOpenChange={setOpen} category={editing} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete ${removing?.name ?? 'category'}?`}
        description="A category that still has products cannot be deleted."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? remove(removing.id)
                .unwrap()
                .then(() => toast.success('Category deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
