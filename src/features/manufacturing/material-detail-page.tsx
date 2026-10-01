import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { ErrorState } from '@/components/shared/error-state';
import { FieldRow, MoneyField, SelectField, TextField, TextareaField } from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { DetailSkeleton } from '@/components/shared/skeletons';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { applyServerErrors, toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatQuantity, isoDate } from '@/lib/format';
import { optionalText, positiveQuantity } from '@/lib/validation';
import {
  MATERIAL_PLACES,
  materialsApi,
  useMaterialReceipts,
  useRemoveReceipt,
  useSaveReceipt,
  type MaterialReceipt,
} from './api';
import { MaterialFormSheet } from './material-form-sheet';
import { MaterialLevelBadge } from './materials-page';

const receiptSchema = z.object({
  date: z.string().min(1, 'Choose a date'),
  quantity: positiveQuantity(),
  place: z.enum(['falcon', 'pharmacy']),
  note: optionalText(1000),
});

type ReceiptValues = z.input<typeof receiptSchema>;

function ReceiptSheet({
  materialId,
  unit,
  receipt,
  open,
  onOpenChange,
}: {
  materialId: string;
  unit: string;
  receipt: MaterialReceipt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveReceipt(materialId);
  const form = useForm<ReceiptValues, unknown, z.output<typeof receiptSchema>>({
    resolver: zodResolver(receiptSchema),
    values: {
      date: receipt?.date ?? isoDate(),
      quantity: receipt?.quantity ?? '',
      place: receipt?.place ?? 'falcon',
      note: receipt?.note ?? null,
    },
  });

  const submit = form.handleSubmit((body) =>
    save.mutate(
      { receiptId: receipt?.id, body },
      {
        onSuccess: () => {
          toast.success(receipt ? 'Receipt corrected' : 'Receipt added');
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
        title={receipt ? 'Correct receipt' : 'Add receipt'}
        description={
          receipt
            ? 'The old quantity is reversed and the corrected one is posted.'
            : 'Material received into the store.'
        }
        onSubmit={submit}
        submitting={save.isPending}
        submitLabel={receipt ? 'Save correction' : 'Add receipt'}
      >
        <FieldRow>
          <MoneyField
            control={form.control}
            name="quantity"
            label={`Quantity (${unit})`}
            prefix=""
            decimals={3}
            required
          />
          <TextField control={form.control} name="date" label="Date" type="date" required />
        </FieldRow>
        <SelectField control={form.control} name="place" label="Place" options={MATERIAL_PLACES} />
        <TextareaField control={form.control} name="note" label="Note" rows={2} />
      </FormSheet>
    </Form>
  );
}

export function MaterialDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const material = materialsApi.useDetail(id);
  const receipts = useMaterialReceipts(id);
  const removeReceipt = useRemoveReceipt(id);
  const [editOpen, setEditOpen] = useState(false);
  const [receipt, setReceipt] = useState<MaterialReceipt | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [removing, setRemoving] = useState<MaterialReceipt | null>(null);

  if (material.isLoading) return <DetailSkeleton />;
  if (material.error || !material.data)
    return <ErrorState error={material.error} onRetry={() => void material.refetch()} />;
  const m = material.data;

  const openReceipt = (entry: MaterialReceipt | null) => {
    setReceipt(entry);
    setReceiptOpen(true);
  };

  const columns: ColumnDef<MaterialReceipt, unknown>[] = [
    { id: 'date', header: 'Date', accessorKey: 'date', cell: ({ row }) => formatDate(row.original.date) },
    {
      id: 'quantity',
      header: 'Quantity',
      accessorKey: 'quantity',
      meta: { align: 'right' },
      cell: ({ row }) => `${formatQuantity(row.original.quantity)} ${m.unit}`,
    },
    {
      id: 'place',
      header: 'Place',
      accessorKey: 'place',
      cell: ({ row }) => (
        <StatusBadge tone={row.original.place === 'falcon' ? 'primary' : 'info'}>
          {MATERIAL_PLACES.find((p) => p.value === row.original.place)?.label}
        </StatusBadge>
      ),
    },
    {
      id: 'note',
      header: 'Note',
      accessorKey: 'note',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.note ?? '—'}</span>,
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right', hideable: false },
      cell: ({ row }) => (
        <RowActions
          actions={[
            {
              label: 'Correct',
              icon: Pencil,
              hidden: !can('materials.update'),
              onSelect: () => openReceipt(row.original),
            },
            {
              label: 'Remove',
              icon: Trash2,
              destructive: true,
              hidden: !can('materials.delete'),
              onSelect: () => setRemoving(row.original),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
        <Link to="/materials">
          <ArrowLeft />
          Materials
        </Link>
      </Button>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {m.name}
            <MaterialLevelBadge material={m} />
          </span>
        }
        description={`${m.category?.name ?? 'No category'} · measured in ${m.unit}`}
        actions={
          <>
            {can('materials.update') ? (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil />
                Edit
              </Button>
            ) : null}
            {can('materials.create') ? (
              <Button onClick={() => openReceipt(null)}>
                <Plus />
                Add receipt
              </Button>
            ) : null}
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="In store" value={`${formatQuantity(m.storeQuantity)} ${m.unit}`} />
        <StatCard label="In pharmacy lab" value={`${formatQuantity(m.labQuantity)} ${m.unit}`} />
        <StatCard label="Minimum" value={`${formatQuantity(m.minimum)} ${m.unit}`} />
        <StatCard label="Bare minimum" value={`${formatQuantity(m.bareMinimum)} ${m.unit}`} />
      </div>
      <h2 className="mb-3 text-sm font-semibold">Receipts</h2>
      <DataTable
        columns={columns}
        data={receipts.data?.data}
        isLoading={receipts.isLoading}
        error={receipts.error}
        onRetry={() => void receipts.refetch()}
        exportFileName={`material-receipts-${m.name}`}
        emptyTitle="No receipts yet"
        emptyDescription="Add a receipt when material arrives in the store."
      />
      <MaterialFormSheet material={m} open={editOpen} onOpenChange={setEditOpen} />
      <ReceiptSheet
        materialId={id}
        unit={m.unit}
        receipt={receipt}
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this receipt?"
        description="Its quantity is reversed. This is refused if the material has already been used."
        confirmLabel="Remove"
        destructive
        onConfirm={() =>
          removing
            ? removeReceipt
                .mutateAsync(removing.id)
                .then(() => toast.success('Receipt removed'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
