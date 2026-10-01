import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { ImageUpload } from '@/components/shared/file-upload';
import { TextField } from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { Thumb } from '@/components/shared/thumb';
import { Button } from '@/components/ui/button';
import { Form, FormLabel } from '@/components/ui/form';
import { useListState } from '@/hooks/use-list-state';
import { applyServerErrors, toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate } from '@/lib/format';
import { requiredText } from '@/lib/validation';
import { categoriesApi, type Category } from './api';

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
  const save = categoriesApi.useSave();
  const upload = categoriesApi.useUploadImage();
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), values: { name: category?.name ?? '' } });

  const submit = form.handleSubmit((values) =>
    save.mutate(
      { id: category?.id, body: values },
      {
        onSuccess: async ({ data }) => {
          if (!category && pendingImage)
            await upload.mutateAsync({ id: data.id, file: pendingImage }).catch(toastError);
          toast.success(category ? 'Category updated' : 'Category created');
          setPendingImage(null);
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
        title={category ? 'Edit category' : 'New category'}
        description="Categories group products on the sale screen and in reports."
        onSubmit={submit}
        submitting={save.isPending || upload.isPending}
        submitLabel={category ? 'Save changes' : 'Create category'}
      >
        <TextField control={form.control} name="name" label="Name" placeholder="Skin care" required />
        <div className="space-y-2">
          <FormLabel>Image</FormLabel>
          {category ? (
            <ImageUpload
              value={category.imageUrl}
              onUpload={(file) => upload.mutateAsync({ id: category.id, file })}
            />
          ) : (
            <ImageUpload value={null} onUpload={async (file) => setPendingImage(file)} />
          )}
        </div>
      </FormSheet>
    </Form>
  );
}

export function CategoriesPage() {
  const { can } = useAuth();
  const list = useListState({ defaultSort: 'name' });
  const query = categoriesApi.useList(list.query);
  const remove = categoriesApi.useRemove();
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
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Thumb src={row.original.imageUrl} name={row.original.name} />
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
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
