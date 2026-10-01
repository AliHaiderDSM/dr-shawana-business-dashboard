import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { FormSheet } from '@/components/shared/form-sheet';
import { Form } from '@/components/ui/form';
import { applyServerErrors } from '@/lib/api/errors';
import { useSavePayment, type AppointmentPayment } from './api';
import {
  emptyPayment,
  PaymentFields,
  paymentSchema,
  ReceivingAccountsNotice,
  toPaymentBody,
  useReceivingAccounts,
  type PaymentValues,
} from './payment-fields';

interface PaymentSheetProps {
  appointmentId: string;
  payment: AppointmentPayment | null;
  suggestedAmount?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentSheet({
  appointmentId,
  payment,
  suggestedAmount,
  open,
  onOpenChange,
}: PaymentSheetProps) {
  const save = useSavePayment(appointmentId);
  const accounts = useReceivingAccounts(open);
  const form = useForm<PaymentValues, unknown, z.output<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    values: payment
      ? {
          method: payment.method,
          amount: payment.amount,
          date: payment.date,
          accountSheetId: payment.accountSheetId,
          senderBank: payment.senderBank,
          senderAccountTitle: payment.senderAccountTitle,
          senderAccountNo: payment.senderAccountNo,
          proof: null,
        }
      : emptyPayment(suggestedAmount),
  });

  const submit = form.handleSubmit((values) =>
    save.mutate(
      { paymentId: payment?.id, body: toPaymentBody(values), proof: values.proof },
      {
        onSuccess: () => {
          toast.success(payment ? 'Payment updated' : 'Payment recorded');
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
        title={payment ? 'Edit payment' : 'Record payment'}
        description="Cash or online. Online payments can carry the sender's bank details and a screenshot."
        onSubmit={submit}
        submitting={save.isPending}
        submitLabel={payment ? 'Save changes' : 'Record payment'}
      >
        <ReceivingAccountsNotice error={accounts.error} />
        <PaymentFields accounts={accounts.data ?? []} />
        {payment?.hasProof ? (
          <p className="text-xs text-muted-foreground">
            A screenshot is already attached ({payment.proofOriginalName}). Choosing a new one replaces it.
          </p>
        ) : null}
      </FormSheet>
    </Form>
  );
}
