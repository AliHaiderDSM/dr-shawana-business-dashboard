import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  FieldRow,
  FormSection,
  MoneyField,
  SelectField,
  SwitchField,
  TextField,
  TextareaField,
} from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { Form } from '@/components/ui/form';
import { applyServerErrors } from '@/lib/api/errors';
import { isoDate } from '@/lib/format';
import { optionalText, quantityString, requiredText } from '@/lib/validation';
import { MATERIAL_PLACES, materialCategoriesApi, materialsApi, type Material } from './api';

const schema = z
  .object({
    name: requiredText(150, 'Name'),
    categoryId: z.string().min(1, 'Choose a category'),
    unit: requiredText(30, 'Unit'),
    minimum: quantityString('Minimum'),
    bareMinimum: quantityString('Bare minimum'),
    addReceipt: z.boolean(),
    receiptDate: z.string(),
    receiptQuantity: z.string(),
    receiptPlace: z.enum(['falcon', 'pharmacy']),
    receiptNote: optionalText(1000),
  })
  .refine((v) => Number(v.bareMinimum) <= Number(v.minimum), {
    path: ['bareMinimum'],
    message: 'Bare minimum cannot be above minimum',
  })
  .refine((v) => !v.addReceipt || Number(v.receiptQuantity) > 0, {
    path: ['receiptQuantity'],
    message: 'Enter the quantity received',
  })
  .refine((v) => !v.addReceipt || v.receiptDate, { path: ['receiptDate'], message: 'Choose a date' });

type Values = z.input<typeof schema>;

interface MaterialFormSheetProps {
  material: Material | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MaterialFormSheet({ material, open, onOpenChange }: MaterialFormSheetProps) {
  const save = materialsApi.useSave();
  const categories = materialCategoriesApi.useOptions({}, open);
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    values: {
      name: material?.name ?? '',
      categoryId: material?.categoryId ?? '',
      unit: material?.unit ?? 'g',
      minimum: material?.minimum ?? '0',
      bareMinimum: material?.bareMinimum ?? '0',
      addReceipt: false,
      receiptDate: isoDate(),
      receiptQuantity: '',
      receiptPlace: 'falcon',
      receiptNote: null,
    },
  });
  const addReceipt = useWatch({ control: form.control, name: 'addReceipt' });

  const submit = form.handleSubmit((values) => {
    const base = {
      name: values.name,
      categoryId: values.categoryId,
      unit: values.unit,
      minimum: values.minimum,
      bareMinimum: values.bareMinimum,
    };
    const body =
      !material && values.addReceipt
        ? {
            ...base,
            initialReceipt: {
              date: values.receiptDate,
              quantity: values.receiptQuantity,
              place: values.receiptPlace,
              note: values.receiptNote,
            },
          }
        : base;
    save.mutate(
      { id: material?.id, body },
      {
        onSuccess: () => {
          toast.success(material ? 'Material updated' : 'Material created');
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
        title={material ? 'Edit material' : 'New material'}
        description="Alerts show when the store quantity falls to the minimum or bare-minimum level."
        onSubmit={submit}
        submitting={save.isPending}
        submitLabel={material ? 'Save changes' : 'Create material'}
      >
        <TextField control={form.control} name="name" label="Material name" required />
        <FieldRow>
          <SelectField
            control={form.control}
            name="categoryId"
            label="Category"
            required
            placeholder="Choose a category"
            options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
          <TextField control={form.control} name="unit" label="Unit" placeholder="g" required />
        </FieldRow>
        <FieldRow>
          <MoneyField control={form.control} name="minimum" label="Minimum" prefix="" decimals={3} required />
          <MoneyField
            control={form.control}
            name="bareMinimum"
            label="Bare minimum"
            prefix=""
            decimals={3}
            required
          />
        </FieldRow>
        {material ? null : (
          <FormSection title="Opening quantity">
            <SwitchField
              control={form.control}
              name="addReceipt"
              label="Add the first receipt now"
              description="Same as the quantity field on posSoft's add-material form."
            />
            {addReceipt ? (
              <>
                <FieldRow>
                  <MoneyField
                    control={form.control}
                    name="receiptQuantity"
                    label="Quantity"
                    prefix=""
                    decimals={3}
                    required
                  />
                  <TextField control={form.control} name="receiptDate" label="Date" type="date" required />
                </FieldRow>
                <SelectField
                  control={form.control}
                  name="receiptPlace"
                  label="Place"
                  options={MATERIAL_PLACES}
                />
                <TextareaField control={form.control} name="receiptNote" label="Note" rows={2} />
              </>
            ) : null}
          </FormSection>
        )}
      </FormSheet>
    </Form>
  );
}
