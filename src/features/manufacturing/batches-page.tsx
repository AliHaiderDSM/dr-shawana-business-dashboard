import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { Eye, FlaskRound, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm, useFormContext, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ComboboxField } from '@/components/shared/combobox';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { FieldRow, FormSection, MoneyField, TextField, TextareaField } from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { arrayError, InlineQuantityField, LineItems } from '@/components/shared/line-items';
import { DateRangeFilter } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { DetailList } from '@/components/shared/panel';
import { RowActions } from '@/components/shared/row-actions';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { productsApi } from '@/features/catalog/api';
import { useListState } from '@/hooks/use-list-state';
import { applyServerErrors, toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatQuantity, isoDate } from '@/lib/format';
import { optionalText, positiveQuantity, requiredText } from '@/lib/validation';
import { fetchLabTransfer, labTransfersApi, materialsApi, productionsApi, type LabTransfer } from './api';

type Batch = LabTransfer;

const itemsSchema = z
  .array(z.object({ materialId: z.string().min(1, 'Choose a material'), qty: positiveQuantity('Qty') }))
  .min(1, 'Add at least one material')
  .refine(
    (items) => new Set(items.map((i) => i.materialId)).size === items.length,
    'Each material can appear once',
  );

interface MaterialLineValues {
  items: { materialId: string; qty: string }[];
}

function MaterialLines({
  fieldIds,
  onAdd,
  onRemove,
  open,
}: {
  fieldIds: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  open: boolean;
}) {
  const form = useFormContext<MaterialLineValues>();
  const materials = materialsApi.useOptions({}, open);
  const items = useWatch({ control: form.control, name: 'items' });
  const total = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  return (
    <LineItems
      columns={[
        { header: 'Material', width: 'minmax(0,1fr)' },
        { header: 'Qty', width: '8rem' },
      ]}
      rowKeys={fieldIds}
      renderRow={(index) => [
        <ComboboxField
          key="material"
          control={form.control}
          name={`items.${index}.materialId`}
          options={(materials.data ?? []).map((m) => ({ value: m.id, label: m.name }))}
          placeholder="Choose material"
        />,
        <InlineQuantityField key="qty" control={form.control} name={`items.${index}.qty`} label="Qty" />,
      ]}
      onAdd={onAdd}
      onRemove={onRemove}
      addLabel="Add material"
      summary={
        <>
          <span className="text-muted-foreground">Total </span>
          <span className="font-semibold tabular-nums">{formatQuantity(total)}</span>
        </>
      }
      error={arrayError(form.formState.errors.items)}
    />
  );
}

const labTransferSchema = z.object({
  batchNo: requiredText(50, 'Batch no'),
  date: z.string().min(1, 'Choose a date'),
  note: optionalText(1000),
  items: itemsSchema,
});

type LabTransferValues = z.input<typeof labTransferSchema>;

function LabTransferSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const save = labTransfersApi.useSave();
  const form = useForm<LabTransferValues, unknown, z.output<typeof labTransferSchema>>({
    resolver: zodResolver(labTransferSchema),
    defaultValues: { batchNo: '', date: isoDate(), note: null, items: [{ materialId: '', qty: '' }] },
  });
  const lines = useFieldArray({ control: form.control, name: 'items' });

  const submit = form.handleSubmit((body) =>
    save.mutate(
      { body },
      {
        onSuccess: () => {
          toast.success('Materials sent to the pharmacy lab');
          form.reset();
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
        title="Material out to pharmacy lab"
        description="Moves materials from the store to the lab under one batch number."
        onSubmit={submit}
        submitting={save.isPending}
        submitLabel="Send to lab"
        size="lg"
      >
        <FieldRow>
          <TextField control={form.control} name="batchNo" label="Batch no" required />
          <TextField control={form.control} name="date" label="Date" type="date" required />
        </FieldRow>
        <FormSection title="Materials">
          <MaterialLines
            open={open}
            fieldIds={lines.fields.map((f) => f.id)}
            onAdd={() => lines.append({ materialId: '', qty: '' })}
            onRemove={(index) => lines.remove(index)}
          />
        </FormSection>
        <TextareaField control={form.control} name="note" label="Note" rows={2} />
      </FormSheet>
    </Form>
  );
}

const productionSchema = z
  .object({
    labBatchId: z.string().min(1, 'Choose a lab batch'),
    date: z.string().min(1, 'Choose a date'),
    note: optionalText(1000),
    productId: z.string().nullable(),
    producedQty: z.string(),
    items: itemsSchema,
  })
  .refine((v) => !v.productId || Number(v.producedQty) > 0, {
    path: ['producedQty'],
    message: 'Enter the quantity produced',
  });

type ProductionValues = z.input<typeof productionSchema>;

function ProductionSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const save = productionsApi.useSave();
  const batches = labTransfersApi.useOptions({}, open);
  const products = productsApi.useOptions({}, open);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const form = useForm<ProductionValues, unknown, z.output<typeof productionSchema>>({
    resolver: zodResolver(productionSchema),
    defaultValues: {
      labBatchId: '',
      date: isoDate(),
      note: null,
      productId: null,
      producedQty: '',
      items: [{ materialId: '', qty: '' }],
    },
  });
  const lines = useFieldArray({ control: form.control, name: 'items' });
  const productId = useWatch({ control: form.control, name: 'productId' });

  const loadBatch = async (id: string | null) => {
    if (!id) return;
    setLoadingBatch(true);
    try {
      const batch = await fetchLabTransfer(id);
      lines.replace(batch.items.map((i) => ({ materialId: i.materialId, qty: i.qty })));
    } catch (error) {
      toastError(error);
    } finally {
      setLoadingBatch(false);
    }
  };

  const submit = form.handleSubmit((values) =>
    save.mutate(
      {
        body: {
          labBatchId: values.labBatchId,
          date: values.date,
          note: values.note,
          items: values.items,
          productId: values.productId,
          ...(values.productId ? { producedQty: values.producedQty } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success('Production saved');
          form.reset();
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
        title="Material out to finished product"
        description="Uses lab materials from a batch. The produced quantity is added to the product's stock."
        onSubmit={submit}
        submitting={save.isPending || loadingBatch}
        submitLabel="Save production"
        size="lg"
      >
        <FieldRow>
          <ComboboxField
            control={form.control}
            name="labBatchId"
            label="Lab batch"
            required
            placeholder="Choose batch"
            options={(batches.data ?? []).map((b) => ({
              value: b.id,
              label: b.batchNo,
              hint: formatDate(b.date),
            }))}
            onSelect={(option) => void loadBatch(option?.value ?? null)}
          />
          <TextField control={form.control} name="date" label="Date" type="date" required />
        </FieldRow>
        <FormSection title="Materials used" description="Filled from the lab batch. Adjust to what was used.">
          <MaterialLines
            open={open}
            fieldIds={lines.fields.map((f) => f.id)}
            onAdd={() => lines.append({ materialId: '', qty: '' })}
            onRemove={(index) => lines.remove(index)}
          />
        </FormSection>
        <FormSection
          title="Finished product"
          description="Optional. Leave empty if nothing was produced yet."
        >
          <FieldRow>
            <ComboboxField
              control={form.control}
              name="productId"
              label="Product"
              clearable
              placeholder="Choose product"
              options={(products.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
            <MoneyField
              control={form.control}
              name="producedQty"
              label="Quantity produced"
              prefix=""
              decimals={3}
              placeholder="0"
              disabled={!productId}
            />
          </FieldRow>
        </FormSection>
        <TextareaField control={form.control} name="note" label="Note" rows={2} />
      </FormSheet>
    </Form>
  );
}

function BatchSheet({ batch, onOpenChange }: { batch: Batch | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={batch !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg">
        {batch ? (
          <>
            <SheetHeader className="border-b px-6 py-5">
              <SheetTitle>Batch {batch.batchNo}</SheetTitle>
              <SheetDescription>{formatDate(batch.date)}</SheetDescription>
            </SheetHeader>
            <div className="space-y-6 overflow-y-auto px-6 py-6">
              <DetailList
                items={[
                  {
                    label: 'Stage',
                    value: batch.stage === 'pharmacy_lab' ? 'Pharmacy lab' : 'Finished product',
                  },
                  { label: 'Total material', value: formatQuantity(batch.totalQty) },
                  ...(batch.stage === 'finished_product'
                    ? [
                        { label: 'Product', value: batch.product?.name ?? '—' },
                        { label: 'Produced', value: formatQuantity(batch.producedQty) },
                      ]
                    : []),
                  { label: 'Note', value: batch.note },
                ]}
              />
              <ul className="divide-y rounded-lg border">
                {batch.items.map((item) => (
                  <li key={item.materialId} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span>{item.materialName ?? 'Removed material'}</span>
                    <span className="font-medium tabular-nums">{formatQuantity(item.qty)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

const productionColumns: ColumnDef<Batch, unknown>[] = [
  {
    id: 'product',
    header: 'Product',
    accessorFn: (b) => b.product?.name ?? '',
    cell: ({ row }) => row.original.product?.name ?? '—',
  },
  {
    id: 'producedQty',
    header: 'Produced',
    accessorKey: 'producedQty',
    meta: { align: 'right' },
    cell: ({ row }) => formatQuantity(row.original.producedQty),
  },
];

interface BatchesPageProps {
  stage: 'lab' | 'production';
}

function BatchesPage({ stage }: BatchesPageProps) {
  const { can } = useAuth();
  const isLab = stage === 'lab';
  const resource = isLab ? labTransfersApi : productionsApi;
  const permission = isLab ? 'labTransfers' : 'production';
  const list = useListState({ defaultSort: '-date' });
  const query = resource.useList(list.query);
  const remove = resource.useRemove();
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Batch | null>(null);
  const [removing, setRemoving] = useState<Batch | null>(null);

  const columns: ColumnDef<Batch, unknown>[] = [
    {
      id: 'batchNo',
      header: 'Batch no',
      accessorKey: 'batchNo',
      meta: { sortKey: 'batchNo', hideable: false },
      cell: ({ row }) => <span className="font-medium">{row.original.batchNo}</span>,
    },
    {
      id: 'date',
      header: 'Date',
      accessorKey: 'date',
      meta: { sortKey: 'date' },
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      id: 'materials',
      header: 'Materials',
      accessorFn: (b) => b.items.map((i) => `${i.materialName ?? ''} ${i.qty}`).join('; '),
      cell: ({ row }) => (
        <span className="line-clamp-1 max-w-md text-muted-foreground">
          {row.original.items
            .map((i) => `${i.materialName ?? 'Removed'} × ${formatQuantity(i.qty)}`)
            .join(', ')}
        </span>
      ),
    },
    {
      id: 'totalQty',
      header: 'Total qty',
      accessorKey: 'totalQty',
      meta: { align: 'right' },
      cell: ({ row }) => formatQuantity(row.original.totalQty),
    },
    ...(isLab ? [] : productionColumns),
    {
      id: 'actions',
      header: '',
      meta: { align: 'right', hideable: false },
      cell: ({ row }) => (
        <RowActions
          actions={[
            { label: 'View', icon: Eye, onSelect: () => setViewing(row.original) },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              hidden: !can(`${permission}.delete`),
              onSelect: () => setRemoving(row.original),
            },
          ]}
        />
      ),
    },
  ];

  const title = isLab ? 'Material out to pharmacy lab' : 'Production';
  return (
    <>
      <PageHeader
        title={title}
        description={
          isLab
            ? 'Batches of materials the store sends to the pharmacy lab.'
            : 'Lab materials turned into finished products.'
        }
        actions={
          can(`${permission}.create`) ? (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              {isLab ? 'Send materials' : 'New production'}
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
        searchPlaceholder="Search batch no"
        exportFileName={isLab ? 'lab-transfers' : 'productions'}
        onRowClick={setViewing}
        emptyTitle={isLab ? 'No lab transfers yet' : 'No production yet'}
        emptyAction={
          can(`${permission}.create`) ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <FlaskRound />
              {isLab ? 'Send materials' : 'Record production'}
            </Button>
          ) : null
        }
        toolbar={<DateRangeFilter list={list} />}
      />
      {isLab ? (
        <LabTransferSheet open={creating} onOpenChange={setCreating} />
      ) : (
        <ProductionSheet open={creating} onOpenChange={setCreating} />
      )}
      <BatchSheet batch={viewing} onOpenChange={(open) => !open && setViewing(null)} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete batch ${removing?.batchNo ?? ''}?`}
        description="Its material movements are reversed. This is refused if a later step already used the batch."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? remove
                .mutateAsync(removing.id)
                .then(() => toast.success('Batch deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}

export function LabTransfersPage() {
  return <BatchesPage stage="lab" />;
}

export function ProductionsPage() {
  return <BatchesPage stage="production" />;
}
