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
import { Input } from '@/components/ui/input';
import { findProductByBarcode, productsApi, suppliersApi } from '@/features/catalog/api';
import { applyServerErrors, toastError } from '@/lib/api/errors';
import { formatQuantity, isoDate } from '@/lib/format';
import { optionalText, positiveQuantity } from '@/lib/validation';
import { STOCK_DESTINATIONS, useCreateStockDocument } from './api';
import type { StockKindConfig } from './stock-config';

const lineSchema = z.object({
  productId: z.string().min(1, 'Choose a product'),
  qty: positiveQuantity('Qty'),
  detail: z.string().trim().max(150, 'Use at most 150 characters'),
  manufacturingDate: z.string(),
  expiryDate: z.string(),
  unitCost: z.string().regex(/^(\d{1,10}(\.\d{1,2})?)?$/, 'Use a price'),
});

const emptyLine = { productId: '', qty: '', detail: '', manufacturingDate: '', expiryDate: '', unitCost: '' };

function buildSchema(config: StockKindConfig) {
  return z.object({
    partyId: z.string().nullable(),
    date: z.string().min(1, 'Choose a date'),
    note: optionalText(1000),
    items: z
      .array(
        (config.detailRequired
          ? lineSchema.extend({ detail: lineSchema.shape.detail.min(1, `${config.detailLabel} is required`) })
          : lineSchema
        ).superRefine((line, ctx) => {
          if ((line.manufacturingDate || line.expiryDate) && !line.detail) {
            ctx.addIssue({ code: 'custom', path: ['detail'], message: 'Enter the batch number' });
          }
          if (line.manufacturingDate && line.expiryDate && line.expiryDate < line.manufacturingDate) {
            ctx.addIssue({ code: 'custom', path: ['expiryDate'], message: 'Before manufacturing' });
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

interface StockDocumentSheetProps {
  config: StockKindConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockDocumentSheet({ config, open, onOpenChange }: StockDocumentSheetProps) {
  const navigate = useNavigate();
  const create = useCreateStockDocument(config.kind);
  const products = productsApi.useOptions({}, open);
  const parties = suppliersApi.useOptions({ type: config.partyType }, open);
  const [files, setFiles] = useState<File[]>([]);
  const schema = buildSchema(config);
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      partyId: null,
      date: isoDate(),
      note: null,
      items: [emptyLine],
    },
  });
  const lines = useFieldArray({ control: form.control, name: 'items' });
  const items = useWatch({ control: form.control, name: 'items' });
  const totalQty = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const productOptions = (products.data ?? []).map((p) => ({ value: p.id, label: p.name }));

  const addScanned = async (code: string) => {
    try {
      const product = await findProductByBarcode(code);
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
      date: values.date,
      note: values.note,
      items: values.items.map((item) => ({
        productId: item.productId,
        qty: item.qty,
        [config.detailField]: item.detail || null,
        ...(config.batched
          ? {
              manufacturingDate: item.manufacturingDate || null,
              expiryDate: item.expiryDate || null,
              unitCost: item.unitCost || null,
            }
          : {}),
      })),
    };
    create.mutate(
      { body: body as never, files },
      {
        onSuccess: (rows) => {
          toast.success(`${config.title} saved`, {
            action: {
              label: 'Print slip',
              onClick: () => void navigate(`${config.printPath}?ids=${rows.map((r) => r.id).join(',')}`),
            },
          });
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
        <FormSection title="Products" description="Scan each pack, or choose products by hand.">
          <BarcodeScanInput onScan={addScanned} autoFocus />
          <LineItems
            columns={[
              { header: 'Product', width: 'minmax(0,1fr)' },
              { header: 'Qty', width: '7rem' },
              { header: config.detailLabel, width: '9rem' },
              ...(config.batched
                ? [
                    { header: 'Mfg date', width: '9.5rem' },
                    { header: 'Expiry', width: '9.5rem' },
                    { header: 'Unit cost', width: '7rem' },
                  ]
                : []),
            ]}
            rowKeys={lines.fields.map((f) => f.id)}
            renderRow={(index) => [
              <ComboboxField
                key="product"
                control={form.control}
                name={`items.${index}.productId`}
                options={productOptions}
                placeholder="Choose product"
                searchPlaceholder="Search products…"
                loading={products.isLoading}
              />,
              <InlineQuantityField
                key="qty"
                control={form.control}
                name={`items.${index}.qty`}
                label="Qty"
              />,
              config.detailField === 'destination' ? (
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
                  ]
                : []),
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
