import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FieldRow, SelectField, TextField, TextareaField } from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { Form } from '@/components/ui/form';
import { applyServerErrors } from '@/lib/api/errors';
import { optionalEmail, optionalText, requiredText } from '@/lib/validation';
import { useSaveBranch, type Branch } from './api';

const schema = z.object({
  name: requiredText(150, 'Name').refine((v) => v.length >= 2, 'Use at least 2 characters'),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, '2–10 capital letters or digits, e.g. LHR'),
  city: requiredText(100, 'City').refine((v) => v.length >= 2, 'Use at least 2 characters'),
  address: optionalText(500),
  phone: optionalText(30),
  email: optionalEmail,
  kind: z.enum(['branch', 'dispatch']),
});

type Values = z.input<typeof schema>;

interface BranchFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch?: Branch | null;
}

export function BranchFormSheet({ open, onOpenChange, branch }: BranchFormSheetProps) {
  const save = useSaveBranch();
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
    },
  });

  const submit = form.handleSubmit((values) =>
    save.mutate(
      { id: branch?.id, body: values },
      {
        onSuccess: () => {
          toast.success(branch ? 'Branch updated' : 'Branch created');
          onOpenChange(false);
          form.reset();
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
        title={branch ? 'Edit branch' : 'New branch'}
        description="Branch details appear on bills, slips and reports."
        onSubmit={submit}
        submitting={save.isPending}
        submitLabel={branch ? 'Save changes' : 'Create branch'}
      >
        {branch ? null : (
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
            placeholder="LHR"
            description="Used in invoice numbers."
            required
          />
          <TextField control={form.control} name="city" label="City" placeholder="Lahore" required />
        </FieldRow>
        <FieldRow>
          <TextField control={form.control} name="phone" label="Phone" placeholder="03001234567" />
          <TextField control={form.control} name="email" label="Email" type="email" />
        </FieldRow>
        <TextareaField control={form.control} name="address" label="Address" rows={2} />
      </FormSheet>
    </Form>
  );
}
