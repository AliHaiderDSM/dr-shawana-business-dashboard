import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ComboboxField } from '@/components/shared/combobox';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { FieldRow, FormSection, TextField, TextareaField } from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { arrayError, InlineQuantityField, LineItems } from '@/components/shared/line-items';
import { FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { productsApi } from '@/features/catalog/api';
import { useListState } from '@/hooks/use-list-state';
import { applyServerErrors, toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatQuantity, isoDate } from '@/lib/format';
import { optionalText } from '@/lib/validation';
import { materialsApi, recipesApi, type Recipe } from './api';

const schema = z.object({
  productId: z.string().min(1, 'Choose a product'),
  date: z.string().min(1, 'Choose a date'),
  note: optionalText(1000),
  items: z
    .array(
      z.object({
        materialId: z.string().min(1, 'Choose a material'),
        qty: z
          .string()
          .trim()
          .regex(/^(\d{1,10}(\.\d{1,3})?)?$/, 'Use a number with up to 3 decimals'),
      }),
    )
    .min(1, 'Add at least one material')
    .refine(
      (items) => new Set(items.map((i) => i.materialId)).size === items.length,
      'Each material can appear once',
    ),
});

type Values = z.input<typeof schema>;

function RecipeSheet({
  recipe,
  open,
  onOpenChange,
}: {
  recipe: Recipe | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = recipesApi.useSave();
  const products = productsApi.useOptions({}, open);
  const materials = materialsApi.useOptions({}, open);
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    values: {
      productId: recipe?.productId ?? '',
      date: recipe?.date ?? isoDate(),
      note: recipe?.note ?? null,
      items: recipe?.items.map((i) => ({ materialId: i.materialId, qty: i.qty ?? '' })) ?? [
        { materialId: '', qty: '' },
      ],
    },
  });
  const lines = useFieldArray({ control: form.control, name: 'items' });
  const materialOptions = (materials.data ?? []).map((m) => ({ value: m.id, label: m.name }));

  const submit = form.handleSubmit((values) =>
    save.mutate(
      {
        id: recipe?.id,
        body: {
          ...values,
          items: values.items.map((i) => ({ materialId: i.materialId, ...(i.qty ? { qty: i.qty } : {}) })),
        },
      },
      {
        onSuccess: () => {
          toast.success(recipe ? 'Recipe updated' : 'Recipe created');
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
        title={recipe ? 'Edit recipe' : 'New product recipe'}
        description="The materials that make one batch of the product."
        onSubmit={submit}
        submitting={save.isPending}
        submitLabel={recipe ? 'Save changes' : 'Create recipe'}
        size="lg"
      >
        <FieldRow>
          <ComboboxField
            control={form.control}
            name="productId"
            label="Product"
            required
            options={(products.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            selectedLabel={recipe?.product?.name}
            placeholder="Choose product"
          />
          <TextField control={form.control} name="date" label="Date" type="date" required />
        </FieldRow>
        <FormSection title="Materials" description="Quantity is optional, as in posSoft.">
          <LineItems
            columns={[
              { header: 'Material', width: 'minmax(0,1fr)' },
              { header: 'Qty', width: '8rem' },
            ]}
            rowKeys={lines.fields.map((f) => f.id)}
            renderRow={(index) => [
              <ComboboxField
                key="material"
                control={form.control}
                name={`items.${index}.materialId`}
                options={materialOptions}
                selectedLabel={recipe?.items[index]?.materialName}
                placeholder="Choose material"
              />,
              <InlineQuantityField
                key="qty"
                control={form.control}
                name={`items.${index}.qty`}
                label="Qty"
              />,
            ]}
            onAdd={() => lines.append({ materialId: '', qty: '' })}
            onRemove={(index) => lines.remove(index)}
            addLabel="Add material"
            error={arrayError(form.formState.errors.items)}
          />
        </FormSection>
        <TextareaField control={form.control} name="note" label="Note" rows={2} />
      </FormSheet>
    </Form>
  );
}

export function RecipesPage() {
  const { can } = useAuth();
  const list = useListState({ defaultSort: '-date' });
  const query = recipesApi.useList(list.query);
  const products = productsApi.useOptions();
  const remove = recipesApi.useRemove();
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<Recipe | null>(null);

  const openSheet = (recipe: Recipe | null) => {
    setEditing(recipe);
    setOpen(true);
  };

  const columns: ColumnDef<Recipe, unknown>[] = [
    {
      id: 'product',
      header: 'Product',
      accessorFn: (r) => r.product?.name ?? '',
      meta: { hideable: false },
      cell: ({ row }) => <span className="font-medium">{row.original.product?.name ?? '—'}</span>,
    },
    {
      id: 'materials',
      header: 'Materials',
      accessorFn: (r) => r.items.map((i) => `${i.materialName ?? ''} ${i.qty ?? ''}`).join('; '),
      cell: ({ row }) => (
        <div className="flex max-w-xl flex-wrap gap-1.5">
          {row.original.items.map((item) => (
            <span key={item.materialId} className="rounded-md bg-muted px-2 py-0.5 text-xs">
              {item.materialName ?? 'Removed material'}
              {item.qty ? <span className="text-muted-foreground"> · {formatQuantity(item.qty)}</span> : null}
            </span>
          ))}
        </div>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      accessorKey: 'date',
      meta: { sortKey: 'date' },
      cell: ({ row }) => formatDate(row.original.date),
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
              hidden: !can('recipes.update'),
              onSelect: () => openSheet(row.original),
            },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              hidden: !can('recipes.delete'),
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
        title="Product recipes"
        description="Which materials make each product."
        actions={
          can('recipes.create') ? (
            <Button onClick={() => openSheet(null)}>
              <Plus />
              New recipe
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
        searchPlaceholder="Search recipes"
        exportFileName="product-recipes"
        onRowClick={can('recipes.update') ? openSheet : undefined}
        emptyTitle="No recipes yet"
        emptyAction={
          can('recipes.create') ? (
            <Button size="sm" onClick={() => openSheet(null)}>
              <BookOpen />
              Add recipe
            </Button>
          ) : null
        }
        toolbar={
          <FilterSelect
            list={list}
            name="productId"
            allLabel="All products"
            className="w-48"
            options={(products.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
          />
        }
      />
      <RecipeSheet recipe={editing} open={open} onOpenChange={setOpen} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Delete this recipe?"
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? remove
                .mutateAsync(removing.id)
                .then(() => toast.success('Recipe deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
