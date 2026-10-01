import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { ChoiceField } from '@/components/shared/choice-field';
import { FieldRow, MoneyField, SelectField, TextField } from '@/components/shared/form-fields';
import { FilePicker, IMAGE_TYPES } from '@/components/shared/file-upload';
import { FormItem, FormLabel } from '@/components/ui/form';
import { api, ApiError, unwrap } from '@/lib/api/client';
import { isoDate } from '@/lib/format';
import { moneyString, optionalText } from '@/lib/validation';
import { METHOD_LABELS } from './api';

export const paymentSchema = z.object({
  method: z.enum(['cash', 'online']),
  amount: moneyString('Amount').refine((v) => Number(v) > 0, 'Amount must be more than zero'),
  date: z.string().min(1, 'Choose a date'),
  accountSheetId: z.string().min(1, 'Choose the receiving account'),
  senderBank: optionalText(150),
  senderAccountTitle: optionalText(150),
  senderAccountNo: optionalText(100),
  proof: z.instanceof(File).nullable(),
});

export type PaymentValues = z.input<typeof paymentSchema>;

export function emptyPayment(amount = ''): PaymentValues {
  return {
    method: 'cash',
    amount,
    date: isoDate(),
    accountSheetId: '',
    senderBank: null,
    senderAccountTitle: null,
    senderAccountNo: null,
    proof: null,
  };
}

export function toPaymentBody(values: z.output<typeof paymentSchema>) {
  const online = values.method === 'online';
  return {
    method: values.method,
    amount: values.amount,
    date: values.date,
    accountSheetId: values.accountSheetId,
    senderBank: online ? values.senderBank : null,
    senderAccountTitle: online ? values.senderAccountTitle : null,
    senderAccountNo: online ? values.senderAccountNo : null,
  };
}

export function useReceivingAccounts(enabled = true) {
  return useQuery({
    queryKey: ['account-sheets', 'options'],
    queryFn: () => unwrap(api.GET('/branch/account-sheets/options')).then((r) => r.data),
    staleTime: 60_000,
    retry: false,
    enabled,
  });
}

export function ReceivingAccountsNotice({ error }: { error: unknown }) {
  if (!(error instanceof ApiError) || error.status !== 403) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-info-soft px-3 py-2.5 text-sm text-info-soft-foreground">
      <Info className="mt-0.5 size-4 shrink-0" />
      Your role cannot list the receiving accounts, so payments cannot be recorded here. Ask the branch admin
      to record the payment.
    </div>
  );
}

export function PaymentFields({
  prefix = '',
  accounts,
}: {
  prefix?: string;
  accounts: { id: string; accountName: string; type: string }[];
}) {
  const form = useFormContext();
  const name = (field: keyof PaymentValues) => `${prefix}${field}`;
  const method = useWatch({ control: form.control, name: name('method') }) as PaymentValues['method'];
  const proof = useWatch({ control: form.control, name: name('proof') }) as File | null;

  return (
    <div className="space-y-4">
      <FieldRow>
        <ChoiceField
          control={form.control}
          name={name('method')}
          label="Method"
          options={(['cash', 'online'] as const).map((m) => ({ value: m, label: METHOD_LABELS[m] }))}
        />
        <MoneyField control={form.control} name={name('amount')} label="Amount" required />
      </FieldRow>
      <FieldRow>
        <SelectField
          control={form.control}
          name={name('accountSheetId')}
          label="Received in"
          required
          placeholder="Choose account"
          options={accounts.map((a) => ({ value: a.id, label: a.accountName, hint: a.type }))}
        />
        <TextField control={form.control} name={name('date')} label="Date" type="date" required />
      </FieldRow>
      {method === 'online' ? (
        <>
          <FieldRow>
            <TextField control={form.control} name={name('senderBank')} label="Sender bank" />
            <TextField
              control={form.control}
              name={name('senderAccountTitle')}
              label="Sender account title"
            />
          </FieldRow>
          <FieldRow>
            <TextField control={form.control} name={name('senderAccountNo')} label="Sender account no" />
            <FormItem>
              <FormLabel>Screenshot</FormLabel>
              <FilePicker
                files={proof ? [proof] : []}
                maxFiles={1}
                accept={IMAGE_TYPES}
                onChange={(files) => form.setValue(name('proof'), files[0] ?? null)}
              />
            </FormItem>
          </FieldRow>
        </>
      ) : null}
    </div>
  );
}
