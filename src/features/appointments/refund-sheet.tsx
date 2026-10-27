import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ChoiceField } from '@/components/shared/choice-field';
import { FieldRow, MoneyField, SelectField, TextareaField, TextField } from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { Form } from '@/components/ui/form';
import { applyServerErrors } from '@/lib/api/errors';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { formatMoney, isoDate } from '@/lib/format';
import { useAddAppointmentRefundMutation, useReceivingAccounts } from '@redux/features/appointments';
import { METHOD_LABELS } from './constants';
import { ReceivingAccountsNotice } from './payment-fields';

const schema = z.object({
  method: z.enum(['cash', 'online']),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Use an amount')
    .refine((v) => Number(v) > 0, 'Must be greater than zero'),
  accountSheetId: z.string().min(1, 'Choose the account'),
  date: z.string().min(1, 'Choose a date'),
  note: z.string().trim().max(500),
});

type Values = z.input<typeof schema>;

interface RefundSheetProps {
  appointmentId: string;
  refundable: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RefundSheet({ appointmentId, refundable, open, onOpenChange }: RefundSheetProps) {
  const [save, saveState] = useAddAppointmentRefundMutation();
  const accounts = useReceivingAccounts(open);
  const refundKey = useIdempotencyKey();
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      method: 'cash',
      amount: refundable > 0 ? String(refundable) : '',
      accountSheetId: '',
      date: isoDate(),
      note: '',
    },
  });
  const method = useWatch({ control: form.control, name: 'method' });
  const choices = (accounts.data ?? []).filter((a) =>
    method === 'online' ? a.type === 'bank' : a.type === 'cash',
  );

  const submit = form.handleSubmit((values) => {
    if (Number(values.amount) > refundable) {
      form.setError('amount', { message: `At most ${formatMoney(refundable)}` });
      return;
    }
    void save({
      appointmentId,
      idempotencyKey: refundKey.key,
      body: {
        method: values.method,
        amount: values.amount,
        accountSheetId: values.accountSheetId,
        date: values.date,
        note: values.note || null,
      },
    })
      .unwrap()
      .then(() => {
        refundKey.renew();
        toast.success('Refund recorded');
        onOpenChange(false);
      })
      .catch((error) => applyServerErrors(form, error));
  });

  return (
    <Form {...form}>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Refund"
        description={`Money paid back for this cancelled appointment. Up to ${formatMoney(refundable)} can be refunded.`}
        onSubmit={submit}
        submitting={saveState.isLoading}
        submitLabel="Record refund"
      >
        <ReceivingAccountsNotice error={accounts.error} />
        <FieldRow>
          <ChoiceField
            control={form.control}
            name="method"
            label="Method"
            options={(['cash', 'online'] as const).map((m) => ({ value: m, label: METHOD_LABELS[m] }))}
          />
          <MoneyField control={form.control} name="amount" label="Amount" required />
        </FieldRow>
        <FieldRow>
          <SelectField
            control={form.control}
            name="accountSheetId"
            label={method === 'online' ? 'Paid from bank' : 'Paid from'}
            required
            placeholder={method === 'online' ? 'Choose bank' : 'Choose account'}
            options={choices.map((a) => ({
              value: a.id,
              label: a.type === 'bank' && a.bankName ? `${a.bankName} · ${a.accountName}` : a.accountName,
              hint: a.type === 'bank' ? (a.accountCode ?? 'bank') : 'cash',
            }))}
          />
          <TextField control={form.control} name="date" label="Date" type="date" required />
        </FieldRow>
        <TextareaField control={form.control} name="note" label="Note" rows={2} />
      </FormSheet>
    </Form>
  );
}
