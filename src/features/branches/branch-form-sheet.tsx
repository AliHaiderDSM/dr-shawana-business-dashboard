import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  FieldRow,
  SelectField,
  SwitchField,
  TextField,
  TextareaField,
} from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { Form } from '@/components/ui/form';
import { applyServerErrors } from '@/lib/api/errors';
import { optionalEmail, optionalText, requiredText } from '@/lib/validation';
import { useHasDispatch } from '@/lib/auth/branches';
import { useSaveBranchMutation } from '@redux/features/branches';
import type { Branch } from '@redux/features/branches/types';

const schema = z.object({
  name: requiredText(150, 'Name').refine((v) => v.length >= 2, 'Use at least 2 characters'),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, 'Use at least 2 characters')
    .max(12, 'Use at most 12 characters')
    .regex(
      /^[A-Z0-9]+(-[A-Z0-9]+)*$/,
      'Use letters and digits, with a dash between parts, e.g. LHR or LHR-00001',
    ),
  city: requiredText(100, 'City').refine((v) => v.length >= 2, 'Use at least 2 characters'),
  address: optionalText(500),
  phone: optionalText(30),
  email: optionalEmail,
  kind: z.enum(['branch', 'dispatch']),
  onlineSales: z.boolean(),
});

type Values = z.input<typeof schema>;

interface BranchFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch?: Branch | null;
}

export function BranchFormSheet({ open, onOpenChange, branch }: BranchFormSheetProps) {
  const [saveBranch, saveState] = useSaveBranchMutation();
  const hasDispatch = useHasDispatch();
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    values: {
      name: branch?.name ?? '',
      code: branch?.code ?? '',
      city: branch?.city ?? '',
      address: branch?.address ?? null,
      phone: branch?.phone ?? null,
      email: branch?.email ?? null,
      kind: branch?.kind === 'dispatch' ? 'dispatch' : 'branch',
      onlineSales: branch?.onlineSales ?? false,
    },
  });

  const submit = form.handleSubmit((values) => {
    const { onlineSales, ...rest } = values;
    void saveBranch({ id: branch?.id, body: { ...rest, onlineSales: rest.kind === 'branch' && onlineSales } })
      .unwrap()
      .then(() => {
        toast.success(branch ? 'Branch updated' : 'Branch created');
        onOpenChange(false);
        form.reset();
      })
      .catch((error) => applyServerErrors(form, error));
  });

  return (
    <Form {...form}>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title={branch ? 'Edit branch' : 'New branch'}
        description="Branch details appear on bills, slips and reports."
        onSubmit={submit}
        submitting={saveState.isLoading}
        submitLabel={branch ? 'Save changes' : 'Create branch'}
      >
        {branch || hasDispatch ? null : (
          <SelectField
            control={form.control}
            name="kind"
            label="Type"
            description="The Dispatch Department ships every online order from its own stock. There can be only one."
            options={[
              { value: 'branch', label: 'Branch (sells in the office and books online orders)' },
              { value: 'dispatch', label: 'Dispatch Department (ships online orders)' },
            ]}
          />
        )}
        <TextField
          control={form.control}
          name="name"
          label="Branch name"
          placeholder="Lahore Head Office"
          required
        />
        <FieldRow>
          <TextField
            control={form.control}
            name="code"
            label="Code"
            placeholder="LHR-00001"
            description="Used in invoice numbers. Small letters become capitals."
            required
          />
          <TextField control={form.control} name="city" label="City" placeholder="Lahore" required />
        </FieldRow>
        <FieldRow>
          <TextField control={form.control} name="phone" label="Phone" placeholder="03001234567" />
          <TextField control={form.control} name="email" label="Email" type="email" />
        </FieldRow>
        <TextareaField control={form.control} name="address" label="Address" rows={2} />
        {form.watch('kind') === 'branch' && branch?.kind !== 'warehouse' ? (
          <SwitchField
            control={form.control}
            name="onlineSales"
            label="Online sales"
            description="This branch may book online orders. The Dispatch Department ships them."
          />
        ) : null}
      </FormSheet>
    </Form>
  );
}
