import { zodResolver } from '@hookform/resolvers/zod';
import { ScanLine } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ImageUpload } from '@/components/shared/file-upload';
import {
  FieldRow,
  FormSection,
  MoneyField,
  SelectField,
  TextField,
  TextareaField,
} from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toastError, applyServerErrors } from '@/lib/api/errors';
import { isoDate } from '@/lib/format';
import { moneyString, optionalText, positiveQuantity, quantityString, requiredText } from '@/lib/validation';
import { categoriesApi, productsApi, suppliersApi, type Product } from './api';

const optionalQuantity = z
  .string()
  .trim()
  .regex(/^(\d{1,10}(\.\d{1,3})?)?$/, 'Use a number with up to 3 decimals');

const baseSchema = z.object({
  name: requiredText(200, 'Name'),
  categoryId: z.string().min(1, 'Choose a category'),
  sku: optionalText(60),
  barcode: optionalText(64).refine(
    (v) => !v || /^[!-~]{3,64}$/.test(v),
    'Use the printed barcode characters only',
  ),
  batchNo: optionalText(100),
  sizeGrams: optionalQuantity,
  unit: requiredText(30, 'Unit'),
  lowStockThreshold: quantityString('Low stock threshold'),
  salePrice: z
    .string()
    .trim()
    .regex(/^(\d{1,10}(\.\d{1,2})?)?$/, 'Use a number with up to 2 decimals'),
  status: z.enum(['active', 'inactive']),
  withPurchase: z.boolean(),
  purchase: z.object({
    supplierId: z.string().nullable(),
    date: z.string(),
    quantity: z.string(),
    unitPrice: z.string(),
    note: optionalText(1000),
  }),
});

const schema = baseSchema.superRefine((values, ctx) => {
  if (!values.withPurchase) return;
  const qty = positiveQuantity().safeParse(values.purchase.quantity);
  if (!qty.success)
    ctx.addIssue({ code: 'custom', path: ['purchase', 'quantity'], message: qty.error.issues[0]?.message });
  const price = moneyString('Unit price').safeParse(values.purchase.unitPrice);
  if (!price.success)
    ctx.addIssue({
      code: 'custom',
      path: ['purchase', 'unitPrice'],
      message: price.error.issues[0]?.message,
    });
  if (!values.purchase.date)
    ctx.addIssue({ code: 'custom', path: ['purchase', 'date'], message: 'Choose a date' });
});

type Values = z.input<typeof schema>;

interface ProductFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSaved?: (product: Product) => void;
}

export function ProductFormSheet({ open, onOpenChange, product, onSaved }: ProductFormSheetProps) {
  const save = productsApi.useSave();
  const upload = productsApi.useUploadImage();
  const categories = categoriesApi.useOptions({}, open);
  const suppliers = suppliersApi.useOptions({ type: 'supplier' }, open && !product);
  const [pendingImage, setPendingImage] = useState<File | null>(null);

  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    values: {
      name: product?.name ?? '',
      categoryId: product?.categoryId ?? '',
      sku: product?.sku ?? null,
      barcode: product?.barcode ?? null,
      batchNo: product?.batchNo ?? null,
      sizeGrams: product?.sizeGrams ?? '',
      unit: product?.unit ?? 'pcs',
      lowStockThreshold: product?.lowStockThreshold ?? '10',
      salePrice: product?.salePrice ?? '',
      status: (product?.status as 'active' | 'inactive') ?? 'active',
      withPurchase: false,
      purchase: { supplierId: null, date: isoDate(), quantity: '', unitPrice: '', note: null },
    },
  });

  const withPurchase = useWatch({ control: form.control, name: 'withPurchase' });

  const submit = form.handleSubmit((values) => {
    const { withPurchase: includePurchase, purchase, sizeGrams, salePrice, ...rest } = values;
    const body = {
      ...rest,
      ...(sizeGrams ? { sizeGrams } : {}),
      ...(salePrice ? { salePrice } : {}),
      ...(!product && includePurchase ? { initialPurchase: purchase } : {}),
    };
    save.mutate(
      { id: product?.id, body: body as never },
      {
        onSuccess: async ({ data }) => {
          if (!product && pendingImage)
            await upload.mutateAsync({ id: data.id, file: pendingImage }).catch(toastError);
          toast.success(product ? 'Product updated' : 'Product created');
          setPendingImage(null);
          onOpenChange(false);
          onSaved?.(data);
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
        title={product ? 'Edit product' : 'New product'}
        description="The sale price is taken from the latest purchase entry unless you set it here."
        onSubmit={submit}
        submitting={save.isPending || upload.isPending}
        submitLabel={product ? 'Save changes' : 'Create product'}
        size="lg"
      >
        <FormSection title="Product">
          <TextField control={form.control} name="name" label="Name" placeholder="Vitamin C Serum" required />
          <FieldRow>
            <SelectField
              control={form.control}
              name="categoryId"
              label="Category"
              required
              placeholder={categories.isLoading ? 'Loading…' : 'Choose a category'}
              options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
            <SelectField
              control={form.control}
              name="status"
              label="Status"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </FieldRow>
          <FieldRow>
            <TextField
              control={form.control}
              name="sku"
              label="SKU"
              description="Optional, unique in this branch."
            />
            <TextField control={form.control} name="unit" label="Unit" placeholder="pcs" required />
          </FieldRow>
          <FormField
            control={form.control}
            name="barcode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Barcode</FormLabel>
                <div className="relative">
                  <ScanLine className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Scan the code printed on the pack"
                      className="pl-9 font-mono"
                      onKeyDown={(event) => event.key === 'Enter' && event.preventDefault()}
                    />
                  </FormControl>
                </div>
                <FormDescription>Used by the scanner on stock in and stock out.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FieldRow>
            <TextField
              control={form.control}
              name="batchNo"
              label="Batch / Gram"
              description="posSoft's “Gram” label."
            />
            <MoneyField
              control={form.control}
              name="sizeGrams"
              label="Size (grams)"
              prefix=""
              decimals={3}
              placeholder="0"
            />
          </FieldRow>
          <FieldRow>
            <MoneyField control={form.control} name="salePrice" label="Sale price" />
            <MoneyField
              control={form.control}
              name="lowStockThreshold"
              label="Low stock alert at"
              prefix=""
              decimals={3}
              required
            />
          </FieldRow>
        </FormSection>

        <FormSection title="Image">
          {product ? (
            <ImageUpload
              value={product.imageUrl}
              onUpload={(file) => upload.mutateAsync({ id: product.id, file })}
            />
          ) : (
            <ImageUpload value={null} onUpload={async (file) => setPendingImage(file)} />
          )}
        </FormSection>

        {product ? null : (
          <FormSection
            title="First purchase"
            description="Optional. Adds opening stock and sets the sale price."
          >
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <FormLabel>Add a purchase entry now</FormLabel>
                <p className="text-sm text-muted-foreground">Same as posSoft's add-product form.</p>
              </div>
              <Switch checked={withPurchase} onCheckedChange={(v) => form.setValue('withPurchase', v)} />
            </div>
            {withPurchase ? (
              <div className="space-y-5 rounded-lg border bg-muted/30 p-4">
                <FieldRow>
                  <SelectField
                    control={form.control}
                    name="purchase.supplierId"
                    label="Supplier"
                    allowEmpty
                    emptyLabel="No supplier"
                    options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
                  />
                  <TextField control={form.control} name="purchase.date" label="Date" type="date" required />
                </FieldRow>
                <FieldRow>
                  <MoneyField
                    control={form.control}
                    name="purchase.quantity"
                    label="Quantity"
                    prefix=""
                    decimals={3}
                    required
                  />
                  <MoneyField control={form.control} name="purchase.unitPrice" label="Unit price" required />
                </FieldRow>
                <TextareaField control={form.control} name="purchase.note" label="Note" rows={2} />
              </div>
            ) : null}
          </FormSection>
        )}
      </FormSheet>
    </Form>
  );
}
