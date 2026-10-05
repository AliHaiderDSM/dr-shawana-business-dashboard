import { useCanReceiveStock } from '@/lib/auth/branches';
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
import { Panel } from '@/components/shared/panel';
import { RowActions } from '@/components/shared/row-actions';
import { DetailSkeleton } from '@/components/shared/skeletons';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Thumb } from '@/components/shared/thumb';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { applyServerErrors, toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatMoney, formatQuantity, isoDate, titleCase } from '@/lib/format';
import { moneyString, optionalText, positiveQuantity } from '@/lib/validation';
import {
  productsApi,
  suppliersApi,
  usePurchases,
  useProductStock,
  useRemovePurchase,
  useSavePurchase,
  type PurchaseEntry,
} from './api';
import { ProductFormSheet } from './product-form-sheet';

const purchaseSchema = z.object({
  supplierId: z.string().nullable(),
  date: z.string().min(1, 'Choose a date'),
  quantity: positiveQuantity(),
  unitPrice: moneyString('Unit price'),
  note: optionalText(1000),
});

type PurchaseValues = z.input<typeof purchaseSchema>;

function PurchaseSheet({
  productId,
  entry,
  open,
  onOpenChange,
}: {
  productId: string;
  entry: PurchaseEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSavePurchase(productId);
  const suppliers = suppliersApi.useOptions({ type: 'supplier' }, open);
  const form = useForm<PurchaseValues, unknown, z.output<typeof purchaseSchema>>({
    resolver: zodResolver(purchaseSchema),
    values: {
      supplierId: entry?.supplierId ?? null,
      date: entry?.date ?? isoDate(),
      quantity: entry?.quantity ?? '',
      unitPrice: entry?.unitPrice ?? '',
      note: entry?.note ?? null,
    },
  });

  const submit = form.handleSubmit((body) =>
    save.mutate(
      { entryId: entry?.id, body },
      {
        onSuccess: () => {
          toast.success(entry ? 'Purchase corrected' : 'Purchase added');
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
        title={entry ? 'Correct purchase' : 'Add stock purchase'}
        description={
          entry
            ? 'The stock movement is reversed and posted again with the new values.'
            : 'Adds stock and, as the latest entry, sets the sale price.'
        }
        onSubmit={submit}
        submitting={save.isPending}
        submitLabel={entry ? 'Save correction' : 'Add purchase'}
      >
        <FieldRow>
          <SelectField
            control={form.control}
            name="supplierId"
            label="Supplier"
            allowEmpty
            emptyLabel="No supplier"
            options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
          />
          <TextField control={form.control} name="date" label="Date" type="date" required />
        </FieldRow>
        <FieldRow>
          <MoneyField
            control={form.control}
            name="quantity"
            label="Quantity"
            prefix=""
            decimals={3}
            required
          />
          <MoneyField control={form.control} name="unitPrice" label="Unit price" required />
        </FieldRow>
        <TextareaField control={form.control} name="note" label="Note" rows={2} />
      </FormSheet>
    </Form>
  );
}

export function ProductDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const product = productsApi.useDetail(id);
  const purchases = usePurchases(id);
  const stock = useProductStock(id, can('stock.view') || can('inventoryReport.view'));
  const removePurchase = useRemovePurchase(id);
  const [editOpen, setEditOpen] = useState(false);
  const [entry, setEntry] = useState<PurchaseEntry | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const canReceive = useCanReceiveStock();
  const [removing, setRemoving] = useState<PurchaseEntry | null>(null);

  if (product.isLoading) return <DetailSkeleton />;
  if (product.error || !product.data)
    return <ErrorState error={product.error} onRetry={() => void product.refetch()} />;
  const p = product.data;
  const closing = stock.data?.closing;
  const low = closing !== undefined && Number(closing) <= Number(p.lowStockThreshold);

  const columns: ColumnDef<PurchaseEntry, unknown>[] = [
    { id: 'date', header: 'Date', accessorKey: 'date', cell: ({ row }) => formatDate(row.original.date) },
    {
      id: 'supplier',
      header: 'Supplier',
      accessorFn: (e) => e.supplier?.name ?? '',
      cell: ({ row }) => row.original.supplier?.name ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'quantity',
      header: 'Qty',
      accessorKey: 'quantity',
      meta: { align: 'right' },
      cell: ({ row }) => formatQuantity(row.original.quantity),
    },
    {
      id: 'unitPrice',
      header: 'Unit price',
      accessorKey: 'unitPrice',
      meta: { align: 'right' },
      cell: ({ row }) => formatMoney(row.original.unitPrice),
    },
    {
      id: 'note',
      header: 'Note',
      accessorKey: 'note',
      cell: ({ row }) => (
        <span className="line-clamp-1 text-muted-foreground">{row.original.note ?? '—'}</span>
      ),
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
              hidden: !can('products.update'),
              onSelect: () => {
                setEntry(row.original);
                setPurchaseOpen(true);
              },
            },
            {
              label: 'Remove',
              icon: Trash2,
              destructive: true,
              hidden: !can('products.delete'),
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
        <Link to="/products">
          <ArrowLeft />
          Products
        </Link>
      </Button>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Thumb src={p.imageUrl} name={p.name} className="size-10" />
            {p.name}
            <StatusBadge status={p.status} />
          </span>
        }
        description={[
          p.category?.name,
          p.sku ? `SKU ${p.sku}` : null,
          p.barcode ? `Barcode ${p.barcode}` : null,
          p.batchNo ? `Batch ${p.batchNo}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            {can('products.update') ? (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil />
                Edit
              </Button>
            ) : null}
            {can('products.create') && canReceive ? (
              <Button
                onClick={() => {
                  setEntry(null);
                  setPurchaseOpen(true);
                }}
              >
                <Plus />
                Add stock
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Current stock"
          tone={low ? 'warning' : undefined}
          value={stock.isLoading ? '…' : closing !== undefined ? `${formatQuantity(closing)} ${p.unit}` : '—'}
          hint={low ? 'At or below the low-stock level' : 'From the stock ledger'}
        />
        <StatCard label="Sale price" value={formatMoney(p.salePrice)} hint="Latest purchase entry price" />
        <StatCard label="Low stock at" value={`${formatQuantity(p.lowStockThreshold)} ${p.unit}`} />
        <StatCard
          label="Size"
          value={p.sizeGrams ? `${formatQuantity(p.sizeGrams)} g` : '—'}
          hint="Used for production loss"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Purchase entries</h2>
          <DataTable
            columns={columns}
            data={purchases.data}
            isLoading={purchases.isLoading}
            error={purchases.error}
            onRetry={() => void purchases.refetch()}
            emptyTitle="No purchases yet"
            emptyDescription={
              canReceive
                ? 'Add a purchase to bring this product into stock.'
                : 'Stock of this branch comes from the Main Warehouse.'
            }
          />
        </div>
        <Panel title="Recent stock movements" bodyClassName="p-0">
          {stock.data?.movements.length ? (
            <ul className="divide-y">
              {[...stock.data.movements]
                .reverse()
                .slice(0, 8)
                .map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{titleCase(m.type)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(m.date)}
                        {m.isReversal ? ' · reversal' : ''}
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className={Number(m.in) > 0 ? 'text-success' : 'text-destructive'}>
                        {Number(m.in) > 0 ? `+${formatQuantity(m.in)}` : `−${formatQuantity(m.out)}`}
                      </div>
                      <div className="text-xs text-muted-foreground">Bal. {formatQuantity(m.balance)}</div>
                    </div>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              {stock.isLoading
                ? 'Loading…'
                : stock.error
                  ? 'Stock history is not available for your role.'
                  : 'No movements yet.'}
            </p>
          )}
        </Panel>
      </div>

      <ProductFormSheet open={editOpen} onOpenChange={setEditOpen} product={p} />
      <PurchaseSheet productId={id} entry={entry} open={purchaseOpen} onOpenChange={setPurchaseOpen} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this purchase?"
        description="Its stock is reversed. This is refused if that stock has already been sold or moved."
        confirmLabel="Remove"
        destructive
        onConfirm={() =>
          removing
            ? removePurchase
                .mutateAsync(removing.id)
                .then(() => toast.success('Purchase removed'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
