import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useFieldArray, useForm, useWatch, type Control } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { BarcodeScanInput } from '@/components/shared/barcode-scan-input';
import { ComboboxField } from '@/components/shared/combobox';
import { FilePicker } from '@/components/shared/file-upload';
import {
  FieldRow,
  FormSection,
  SelectField,
  TextField,
  TextareaField,
} from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { arrayError, InlineQuantityField, InlineTextField, LineItems } from '@/components/shared/line-items';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { findProductByBarcode, productsApi, suppliersApi } from '@/features/catalog/api';
import { applyServerErrors, toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { useBranchOptions, useInWarehouse } from '@/lib/auth/branches';
import { formatDate, formatQuantity, isoDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { optionalText, positiveQuantity } from '@/lib/validation';
import {
  findItemBySerial,
  isSerial,
  STOCK_DESTINATIONS,
  useBatches,
  useCreateStockDocument,
  useStockBalances,
} from './api';
import type { StockKindConfig } from './stock-config';

const lineSchema = z.object({
  productId: z.string().min(1, 'Choose a product'),
  qty: positiveQuantity('Qty'),
  detail: z.string().trim().max(150, 'Use at most 150 characters'),
  manufacturingDate: z.string(),
  expiryDate: z.string(),
  unitCost: z.string().regex(/^(\d{1,10}(\.\d{1,2})?)?$/, 'Use a price'),
  labels: z.enum(['none', 'generate', 'existing']),
  firstSerial: z.string().trim(),
  serials: z.array(z.string()),
});

const emptyLine = {
  productId: '',
  qty: '',
  detail: '',
  manufacturingDate: '',
  expiryDate: '',
  unitCost: '',
  labels: 'none' as const,
  firstSerial: '',
  serials: [] as string[],
};

const LABEL_OPTIONS = [
  { value: 'none', label: 'No labels' },
  { value: 'generate', label: 'Print new labels' },
  { value: 'existing', label: 'Already labelled' },
];

function buildSchema(config: StockKindConfig, transfer = false) {
  return z.object({
    partyId: z.string().nullable(),
    toBranchId: transfer ? z.string().min(1, 'Choose the branch') : z.string(),
    date: z.string().min(1, 'Choose a date'),
    note: optionalText(1000),
    items: z
      .array(
        (config.detailRequired && !transfer
          ? lineSchema.extend({ detail: lineSchema.shape.detail.min(1, `${config.detailLabel} is required`) })
          : lineSchema
        ).superRefine((line, ctx) => {
          if ((line.manufacturingDate || line.expiryDate) && !line.detail) {
            ctx.addIssue({ code: 'custom', path: ['detail'], message: 'Enter the batch number' });
          }
          if (line.manufacturingDate && line.expiryDate && line.expiryDate < line.manufacturingDate) {
            ctx.addIssue({ code: 'custom', path: ['expiryDate'], message: 'Before manufacturing' });
          }
          if (line.labels !== 'none' && !Number.isInteger(Number(line.qty))) {
            ctx.addIssue({ code: 'custom', path: ['qty'], message: 'Whole pieces' });
          }
          if (line.labels === 'existing' && !isSerial(line.firstSerial)) {
            ctx.addIssue({ code: 'custom', path: ['firstSerial'], message: 'Like DSM-000001' });
          }
        }),
      )
      .min(1, 'Add at least one product'),
  });
}

type Values = z.input<ReturnType<typeof buildSchema>>;

export function DestinationInput({
  control,
  name,
  label,
}: {
  control: Control<Values>;
  name: `items.${number}.detail`;
  label: string;
}) {
  const listId = useId();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Input list={listId} aria-label={label} placeholder="Choose or type" {...field} />
          </FormControl>
          <datalist id={listId}>
            {STOCK_DESTINATIONS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function StockHint({ productId }: { productId: string }) {
  const balance = useStockBalances({ productId, pageSize: 1 });
  const batches = useBatches({ productId, inStockOnly: 'true', pageSize: 20 });
  const row = balance.data?.data[0];
  if (!row) return <span className="text-xs text-muted-foreground">Checking stock…</span>;
  const expired = Number(row.expiredQuantity);
  const list = batches.data?.data ?? [];
  return (
    <div className="space-y-1.5 rounded-md bg-muted/40 px-2 py-1.5 text-xs">
      <div>
        <span className="font-medium">
          {formatQuantity(row.quantity)} {row.unit} in stock
        </span>
        {expired > 0 ? <span className="text-destructive"> · {formatQuantity(expired)} expired</span> : null}
      </div>
      {list.length ? (
        <table className="w-full tabular-nums">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-0.5 pr-2 text-left font-normal">Batch</th>
              <th className="py-0.5 pr-2 text-left font-normal">Mfg</th>
              <th className="py-0.5 pr-2 text-left font-normal">Expiry</th>
              <th className="py-0.5 text-right font-normal">Qty</th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr
                key={b.id}
                className={cn(
                  'border-t border-border/60',
                  b.status === 'expired' && 'text-destructive',
                  b.status === 'expiring' && 'text-warning-soft-foreground',
                )}
              >
                <td className="py-0.5 pr-2 font-mono">{b.batchNo}</td>
                <td className="py-0.5 pr-2 whitespace-nowrap">
                  {b.manufacturingDate ? formatDate(b.manufacturingDate) : '—'}
                </td>
                <td className="py-0.5 pr-2 whitespace-nowrap">
                  {b.expiryDate ? formatDate(b.expiryDate) : '—'}
                </td>
                <td className="py-0.5 text-right">{formatQuantity(b.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

function LabelsCell({ control, index }: { control: Control<Values>; index: number }) {
  const mode = useWatch({ control, name: `items.${index}.labels` });
  return (
    <div className="space-y-1.5">
      <FormField
        control={control}
        name={`items.${index}.labels`}
        render={({ field }) => (
          <FormItem>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="w-full" aria-label="Labels">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {LABEL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />
      {mode === 'existing' ? (
        <InlineTextField
          control={control}
          name={`items.${index}.firstSerial`}
          label="First label"
          placeholder="DSM-000001"
        />
      ) : null}
    </div>
  );
}

function ScannedCell({ serials, onClear }: { serials: string[]; onClear: () => void }) {
  if (serials.length === 0)
    return <span className="flex h-9 items-center text-xs text-muted-foreground">Not scanned</span>;
  return (
    <div className="flex h-9 items-center gap-1 text-xs" title={serials.join(', ')}>
      <span className="font-medium">{serials.length} scanned</span>
      <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}

interface StockDocumentSheetProps {
  config: StockKindConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockDocumentSheet({ config, open, onOpenChange }: StockDocumentSheetProps) {
  const inWarehouse = useInWarehouse();
  const { isSuperAdmin } = useAuth();
  const branchOptions = useBranchOptions(isSuperAdmin && config.kind === 'out');
  const navigate = useNavigate();
  const create = useCreateStockDocument(config.kind);
  const products = productsApi.useOptions({}, open);
  const parties = suppliersApi.useOptions({ type: config.partyType }, open);
  const [files, setFiles] = useState<File[]>([]);
  const transfer = config.kind === 'out' && inWarehouse;
  const schema = buildSchema(config, transfer);
  const targets = (branchOptions.data ?? []).filter((b) => b.kind === 'branch' && b.status === 'active');
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      partyId: null,
      toBranchId: '',
      date: isoDate(),
      note: null,
      items: [emptyLine],
    },
  });
  const lines = useFieldArray({ control: form.control, name: 'items' });
  const items = useWatch({ control: form.control, name: 'items' });
  const totalQty = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const productOptions = (products.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const tracked = new Set((products.data ?? []).filter((p) => p.trackSerials).map((p) => p.id));
  const scansOnly = (productId: string | undefined) =>
    !config.batched && Boolean(productId && tracked.has(productId));

  const addPiece = async (code: string) => {
    const piece = await findItemBySerial(code);
    if (piece.status !== 'in_stock') {
      toast.error(`${piece.serial} is ${piece.status.replace('_', ' ')}`);
      return;
    }
    const current = form.getValues('items');
    if (current.some((line) => line.serials.includes(piece.serial))) {
      toast.error(`${piece.serial} is already on this entry`);
      return;
    }
    const index = current.findIndex((line) => line.productId === piece.productId);
    if (index >= 0) {
      const serials = [...(current[index]?.serials ?? []), piece.serial];
      form.setValue(`items.${index}.serials`, serials, { shouldDirty: true });
      form.setValue(`items.${index}.qty`, String(serials.length), {
        shouldDirty: true,
        shouldValidate: true,
      });
    } else {
      const line = { ...emptyLine, productId: piece.productId, qty: '1', serials: [piece.serial] };
      const empty = current.findIndex((item) => !item.productId);
      if (empty >= 0) lines.update(empty, { ...line, detail: current[empty]?.detail ?? '' });
      else lines.append(line);
    }
    toast.success(`${piece.serial} · ${piece.productName}`);
  };

  const addScanned = async (code: string) => {
    try {
      if (isSerial(code)) {
        if (config.batched) {
          toast.error('Labels are made when this entry is saved. Scan the product barcode here.');
          return;
        }
        await addPiece(code);
        return;
      }
      const product = await findProductByBarcode(code);
      if (scansOnly(product.id)) {
        toast.error(`${product.name} carries DSM labels. Scan the label of each piece.`);
        return;
      }
      const current = form.getValues('items');
      const existing = current.findIndex((item) => item.productId === product.id);
      if (existing >= 0) {
        const qty = String((Number(current[existing]?.qty) || 0) + 1);
        form.setValue(`items.${existing}.qty`, qty, { shouldDirty: true, shouldValidate: true });
        toast.success(`${product.name} · qty ${qty}`);
        return;
      }
      const line = {
        ...emptyLine,
        productId: product.id,
        qty: '1',
        detail: config.detailField === 'batch' ? (product.batchNo ?? '') : '',
      };
      const empty = current.findIndex((item) => !item.productId);
      if (empty >= 0) lines.update(empty, { ...line, detail: current[empty]?.detail || line.detail });
      else lines.append(line);
      toast.success(`${product.name} added`);
    } catch (error) {
      toastError(error);
    }
  };

  const submit = form.handleSubmit((values) => {
    const body = {
      [config.partyField]: values.partyId,
      ...(transfer ? { toBranchId: values.toBranchId } : {}),
      date: values.date,
      note: values.note,
      items: values.items.map((item) => ({
        productId: item.productId,
        qty: item.qty,
        ...(transfer ? {} : { [config.detailField]: item.detail || null }),
        ...(config.batched
          ? {
              manufacturingDate: item.manufacturingDate || null,
              expiryDate: item.expiryDate || null,
              unitCost: item.unitCost || null,
              labels: item.labels,
              ...(item.labels === 'existing' ? { firstSerial: item.firstSerial.toUpperCase() } : {}),
            }
          : item.serials.length
            ? { serials: item.serials }
            : {}),
      })),
    };
    create.mutate(
      { body: body as never, files },
      {
        onSuccess: (rows) => {
          const labelled = rows.filter((r) => r.labels);
          const slip = () => void navigate(`${config.printPath}?ids=${rows.map((r) => r.id).join(',')}`);
          const count = labelled.reduce((sum, r) => sum + (r.labels?.count ?? 0), 0);
          if (config.batched && labelled.length > 0) {
            toast.success(`${config.title} saved · ${count} labelled pieces created`, {
              duration: 15000,
              action: {
                label: 'Print labels',
                onClick: () =>
                  void navigate(
                    `/print/labels?source=stock_in&sourceIds=${labelled.map((r) => r.id).join(',')}`,
                  ),
              },
              cancel: { label: 'Print slip', onClick: slip },
            });
          } else {
            toast.success(`${config.title} saved`, { action: { label: 'Print slip', onClick: slip } });
          }
          setFiles([]);
          form.reset();
          onOpenChange(false);
        },
        onError: (error) => applyServerErrors(form, error),
      },
    );
  });

  return (
    <Form {...form}>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title={`New ${config.title.toLowerCase()}`}
        description="Each product line is saved as its own entry, as in posSoft."
        onSubmit={submit}
        submitting={create.isPending}
        submitLabel="Save entries"
        size={config.batched ? 'xl' : 'lg'}
      >
        <FieldRow>
          <SelectField
            control={form.control}
            name="partyId"
            label={config.partyLabel}
            allowEmpty
            options={(parties.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
          />
          <TextField control={form.control} name="date" label="Date" type="date" required />
        </FieldRow>
        {transfer ? (
          <SelectField
            control={form.control}
            name="toBranchId"
            label="Transfer to branch"
            required
            placeholder="Choose the branch that receives this stock"
            description="The branch gets this stock straight away, with the same batches and labels."
            options={targets.map((b) => ({ value: b.id, label: `${b.name} · ${b.code}` }))}
          />
        ) : null}
        <FormSection
          title="Products"
          description={
            config.batched
              ? 'Choose products by hand or scan the product barcode. Labelled products need "Print new labels" or the first label already on the packs.'
              : 'Scan the DSM label of every labelled piece that goes out: its batch comes from the label and the qty counts the scans. For other products the batch that expires first goes out first.'
          }
        >
          <BarcodeScanInput onScan={addScanned} autoFocus />
          <LineItems
            columns={[
              { header: 'Product', width: config.batched ? 'minmax(12rem,1fr)' : 'minmax(0,1fr)' },
              { header: 'Qty', width: '7rem' },
              ...(transfer ? [] : [{ header: config.detailLabel, width: '9rem' }]),
              ...(config.batched
                ? [
                    { header: 'Mfg date', width: '9.5rem' },
                    { header: 'Expiry', width: '9.5rem' },
                    { header: 'Unit cost', width: '7rem' },
                    { header: 'Labels', width: '11rem' },
                  ]
                : [{ header: 'Labels', width: '8rem' }]),
            ]}
            rowKeys={lines.fields.map((f) => f.id)}
            renderRow={(index) => [
              <div key="product" className="space-y-1.5">
                <ComboboxField
                  control={form.control}
                  name={`items.${index}.productId`}
                  options={productOptions}
                  placeholder="Choose product"
                  searchPlaceholder="Search products…"
                  loading={products.isLoading}
                />
                {!config.batched && items[index]?.productId ? (
                  <StockHint productId={items[index]!.productId} />
                ) : null}
              </div>,
              <InlineQuantityField
                key="qty"
                control={form.control}
                name={`items.${index}.qty`}
                label="Qty"
                readOnly={scansOnly(items[index]?.productId)}
              />,
              transfer ? null : config.detailField === 'destination' ? (
                <DestinationInput
                  key="detail"
                  control={form.control}
                  name={`items.${index}.detail`}
                  label={config.detailLabel}
                />
              ) : (
                <InlineTextField
                  key="detail"
                  control={form.control}
                  name={`items.${index}.detail`}
                  label={config.detailLabel}
                  placeholder="Optional"
                />
              ),
              ...(config.batched
                ? [
                    <InlineTextField
                      key="mfg"
                      control={form.control}
                      name={`items.${index}.manufacturingDate`}
                      label="Manufacturing date"
                      type="date"
                    />,
                    <InlineTextField
                      key="expiry"
                      control={form.control}
                      name={`items.${index}.expiryDate`}
                      label="Expiry date"
                      type="date"
                    />,
                    <InlineQuantityField
                      key="cost"
                      control={form.control}
                      name={`items.${index}.unitCost`}
                      label="Unit cost"
                      decimals={2}
                      placeholder="Rs"
                    />,
                    <LabelsCell key="labels" control={form.control} index={index} />,
                  ]
                : [
                    <ScannedCell
                      key="labels"
                      serials={items[index]?.serials ?? []}
                      onClear={() => {
                        form.setValue(`items.${index}.serials`, []);
                        if (scansOnly(items[index]?.productId)) form.setValue(`items.${index}.qty`, '');
                      }}
                    />,
                  ]),
            ]}
            onAdd={() => lines.append(emptyLine)}
            onRemove={(index) => lines.remove(index)}
            addLabel="Add product"
            summary={
              <>
                <span className="text-muted-foreground">Total qty </span>
                <span className="font-semibold tabular-nums">{formatQuantity(totalQty)}</span>
              </>
            }
            error={arrayError(form.formState.errors.items)}
          />
        </FormSection>
        <TextareaField control={form.control} name="note" label="Note" rows={2} />
        <FormSection title="Attachments" description="Delivery notes or invoices, saved with every line.">
          <FilePicker files={files} onChange={setFiles} />
        </FormSection>
      </FormSheet>
    </Form>
  );
}
