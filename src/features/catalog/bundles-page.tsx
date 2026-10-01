import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { Gift, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { ImageUpload } from '@/components/shared/file-upload';
import { FormSection, TextField } from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { MoneyInput } from '@/components/shared/money-input';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { Thumb } from '@/components/shared/thumb';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useListState } from '@/hooks/use-list-state';
import { applyServerErrors, toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatCount, formatMoney } from '@/lib/format';
import { moneyString, positiveQuantity, requiredText } from '@/lib/validation';
import { bundlesApi, productsApi, type Bundle } from './api';

const schema = z.object({
  name: requiredText(150, 'Name'),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Choose a product'),
        qty: positiveQuantity(),
        price: moneyString('Price'),
      }),
    )
    .min(1, 'Add at least one product')
    .refine(
      (items) => new Set(items.map((i) => i.productId)).size === items.length,
      'Each product can appear once',
    ),
});

type Values = z.input<typeof schema>;

function BundleSheet({
  open,
  onOpenChange,
  bundle,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bundle: Bundle | null;
}) {
  const save = bundlesApi.useSave();
  const upload = bundlesApi.useUploadImage();
  const products = productsApi.useOptions({}, open);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    values: {
      name: bundle?.name ?? '',
      items: bundle?.items.map((i) => ({ productId: i.productId, qty: i.qty, price: i.price })) ?? [
        { productId: '', qty: '1', price: '' },
      ],
    },
  });
  const lines = useFieldArray({ control: form.control, name: 'items' });
  const items = useWatch({ control: form.control, name: 'items' });
  const preview = items.reduce((sum, i) => sum + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
  const productList = products.data ?? [];

  const submit = form.handleSubmit((values) =>
    save.mutate(
      { id: bundle?.id, body: values },
      {
        onSuccess: async ({ data }) => {
          if (!bundle && pendingImage)
            await upload.mutateAsync({ id: data.id, file: pendingImage }).catch(toastError);
          toast.success(bundle ? 'Bundle updated' : 'Bundle created');
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
        title={bundle ? 'Edit bundle' : 'New bundle'}
        description="A bundle sells several products together at the prices you set here."
        onSubmit={submit}
        submitting={save.isPending || upload.isPending}
        submitLabel={bundle ? 'Save changes' : 'Create bundle'}
        size="lg"
      >
        <TextField control={form.control} name="name" label="Bundle name" placeholder="Glow kit" required />
        <FormSection title="Products" description="Price is per unit inside the bundle.">
          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-[minmax(0,1fr)_6rem_8rem_2.25rem] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Product</span>
              <span>Qty</span>
              <span>Price</span>
              <span />
            </div>
            <div className="divide-y">
              {lines.fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid grid-cols-[minmax(0,1fr)_6rem_8rem_2.25rem] items-start gap-2 px-3 py-2.5"
                >
                  <FormField
                    control={form.control}
                    name={`items.${index}.productId`}
                    render={({ field: f }) => (
                      <FormItem>
                        <Select
                          value={f.value || undefined}
                          onValueChange={(value) => {
                            f.onChange(value);
                            const product = productList.find((p) => p.id === value);
                            if (product?.salePrice && !form.getValues(`items.${index}.price`)) {
                              form.setValue(`items.${index}.price`, product.salePrice);
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Choose product" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {productList.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`items.${index}.qty`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormControl>
                          <MoneyInput prefix="" decimals={3} aria-label="Quantity" {...f} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`items.${index}.price`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormControl>
                          <MoneyInput aria-label="Price" {...f} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 text-muted-foreground"
                    disabled={lines.fields.length === 1}
                    onClick={() => lines.remove(index)}
                    aria-label="Remove line"
                  >
                    <X />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-2.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => lines.append({ productId: '', qty: '1', price: '' })}
              >
                <Plus />
                Add product
              </Button>
              <div className="text-right text-sm">
                <span className="text-muted-foreground">Preview total </span>
                <span className="font-semibold tabular-nums">{formatMoney(preview)}</span>
              </div>
            </div>
          </div>
          {form.formState.errors.items?.root?.message || form.formState.errors.items?.message ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.items.root?.message ?? form.formState.errors.items.message}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">The saved total is calculated by the server.</p>
        </FormSection>
        <FormSection title="Image">
          {bundle ? (
            <ImageUpload
              value={bundle.imageUrl}
              onUpload={(file) => upload.mutateAsync({ id: bundle.id, file })}
            />
          ) : (
            <ImageUpload value={null} onUpload={async (file) => setPendingImage(file)} />
          )}
        </FormSection>
      </FormSheet>
    </Form>
  );
}

export function BundlesPage() {
  const { can } = useAuth();
  const list = useListState({ defaultSort: 'name' });
  const query = bundlesApi.useList(list.query);
  const remove = bundlesApi.useRemove();
  const [editing, setEditing] = useState<Bundle | null>(null);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<Bundle | null>(null);

  const openSheet = (bundle: Bundle | null) => {
    setEditing(bundle);
    setOpen(true);
  };

  const columns: ColumnDef<Bundle, unknown>[] = [
    {
      id: 'name',
      header: 'Bundle',
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
      id: 'items',
      header: 'Products',
      accessorFn: (b) => b.items.map((i) => `${i.productName ?? ''} x${i.qty}`).join('; '),
      cell: ({ row }) => (
        <div className="max-w-md truncate text-muted-foreground">
          {row.original.items
            .map((i) => `${i.productName ?? 'Removed product'} × ${Number(i.qty)}`)
            .join(', ')}
        </div>
      ),
    },
    {
      id: 'count',
      header: 'Lines',
      accessorFn: (b) => b.items.length,
      meta: { align: 'right' },
      cell: ({ row }) => formatCount(row.original.items.length),
    },
    {
      id: 'totalPrice',
      header: 'Total price',
      accessorKey: 'totalPrice',
      meta: { sortKey: 'totalPrice', align: 'right' },
      cell: ({ row }) => <span className="font-medium">{formatMoney(row.original.totalPrice)}</span>,
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
              hidden: !can('bundles.update'),
              onSelect: () => openSheet(row.original),
            },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              hidden: !can('bundles.delete'),
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
        title="Bundles"
        description="Product kits sold together at a combined price."
        actions={
          can('bundles.create') ? (
            <Button onClick={() => openSheet(null)}>
              <Plus />
              New bundle
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
        searchPlaceholder="Search bundles"
        exportFileName="bundles"
        onRowClick={can('bundles.update') ? (b) => openSheet(b) : undefined}
        emptyTitle="No bundles yet"
        emptyDescription="Combine products into a kit with its own prices."
        emptyAction={
          can('bundles.create') ? (
            <Button size="sm" onClick={() => openSheet(null)}>
              <Gift />
              Create bundle
            </Button>
          ) : null
        }
      />
      <BundleSheet open={open} onOpenChange={setOpen} bundle={editing} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete ${removing?.name ?? 'bundle'}?`}
        description="The bundle can no longer be sold. Past sales keep their lines."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? remove
                .mutateAsync(removing.id)
                .then(() => toast.success('Bundle deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
