import { useQuery } from '@tanstack/react-query';
import { Info, Landmark } from 'lucide-react';
import { useEffect } from 'react';
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
  proofs: z.array(z.instanceof(File)),
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
    proofs: [],
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

export interface ReceivingAccount {
  id: string;
  accountName: string;
  accountCode?: string | null;
  type: string;
  bankName?: string | null;
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
  maxProofs = 1,
}: {
  prefix?: string;
  accounts: ReceivingAccount[];
  maxProofs?: number;
}) {
  const form = useFormContext();
  const name = (field: keyof PaymentValues) => `${prefix}${field}`;
  const method = useWatch({ control: form.control, name: name('method') }) as PaymentValues['method'];
  const accountSheetId = useWatch({ control: form.control, name: name('accountSheetId') }) as string;
  const wanted = method === 'online' ? 'bank' : 'cash';
  const matching = accounts.filter((a) => a.type === wanted);
  const choices = matching.length ? matching : accounts;
  const selected = accounts.find((a) => a.id === accountSheetId);
  const accountField = name('accountSheetId');
  const onlyChoice = choices.length === 1 ? choices[0]?.id : undefined;
  const selectedFits = Boolean(selected && choices.some((a) => a.id === selected.id));

  useEffect(() => {
    if (selectedFits) return;
    form.setValue(accountField, onlyChoice ?? '', { shouldDirty: true });
  }, [form, accountField, onlyChoice, selectedFits]);
  const proofs = (useWatch({ control: form.control, name: name('proofs') }) ?? []) as File[];

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
          label={method === 'online' ? 'Received in bank' : 'Received in'}
          required
          placeholder={method === 'online' ? 'Choose bank' : 'Choose account'}
          options={choices.map((a) => ({
            value: a.id,
            label: a.type === 'bank' && a.bankName ? `${a.bankName} · ${a.accountName}` : a.accountName,
            hint: a.type === 'bank' ? (a.accountCode ?? 'bank') : 'cash',
          }))}
        />
        <TextField control={form.control} name={name('date')} label="Date" type="date" required />
      </FieldRow>
      {method === 'online' && selected?.type === 'bank' ? (
        <div className="flex items-start gap-3 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
          <Landmark className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <dl className="grid flex-1 gap-x-6 gap-y-1 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Bank</dt>
              <dd className="font-medium">{selected.bankName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Account title</dt>
              <dd className="font-medium">{selected.accountName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Account no</dt>
              <dd className="font-mono">{selected.accountCode ?? '—'}</dd>
            </div>
          </dl>
        </div>
      ) : null}
      {method === 'online' && matching.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No bank account yet. Add one under Bank &amp; Cash Accounts to pick it here.
        </p>
      ) : null}
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
              <FormLabel>{maxProofs > 1 ? 'Screenshots' : 'Screenshot'}</FormLabel>
              <FilePicker
                files={proofs}
                maxFiles={maxProofs}
                accept={IMAGE_TYPES}
                onChange={(files) => form.setValue(name('proofs'), files)}
              />
            </FormItem>
          </FieldRow>
        </>
      ) : null}
    </div>
  );
}
