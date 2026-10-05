import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { ChoiceField } from '@/components/shared/choice-field';
import { BarcodeScanInput } from '@/components/shared/barcode-scan-input';
import { Combobox } from '@/components/shared/combobox';
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
import { arrayError, InlineQuantityField, LineItems } from '@/components/shared/line-items';
import { Form, FormItem, FormLabel } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { ReceivingAccountsNotice, useReceivingAccounts } from '@/features/appointments/payment-fields';
import { applyServerErrors } from '@/lib/api/errors';
import { formatDate, formatMoney, formatQuantity, isoDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { optionalText } from '@/lib/validation';
import { REASON_LABELS, useCreateReturn, useReturnable, useSaleSearch, type ReturnReason } from './api';

const REASONS = Object.keys(REASON_LABELS) as [ReturnReason, ...ReturnReason[]];

const schema = z
  .object({
    saleId: z.string().min(1, 'Choose the sale'),
    date: z.string().min(1, 'Choose a date'),
    reason: z.enum(REASONS, 'Choose a reason'),
    note: optionalText(5000),
    qty: z.record(
      z.string(),
      z
        .string()
        .trim()
        .regex(/^(\d{1,10}(\.\d{1,3})?)?$/, 'Use a number'),
    ),
    serials: z.record(z.string(), z.array(z.string())),
    withRefund: z.boolean(),
    refundAmount: z.string(),
    refundMethod: z.enum(['cash', 'online']),
    refundAccountId: z.string(),
    refundDate: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!Object.values(v.qty).some((qty) => Number(qty) > 0))
      ctx.addIssue({ code: 'custom', path: ['qty'], message: 'Enter the quantity coming back' });
    if (!v.withRefund) return;
    if (!(Number(v.refundAmount) > 0))
      ctx.addIssue({ code: 'custom', path: ['refundAmount'], message: 'Enter the refund amount' });
    if (!v.refundAccountId)
      ctx.addIssue({ code: 'custom', path: ['refundAccountId'], message: 'Choose the account' });
  });

type Values = z.input<typeof schema>;

function emptyValues(saleId = ''): Values {
  return {
    saleId,
    date: isoDate(),
    reason: undefined as unknown as ReturnReason,
    note: null,
    qty: {},
    serials: {},
    withRefund: false,
    refundAmount: '',
    refundMethod: 'cash',
    refundAccountId: '',
    refundDate: isoDate(),
  };
}

function PieceChooser({
  serials,
  picked,
  onToggle,
}: {
  serials: string[];
  picked: string[];
  onToggle: (serial: string) => void;
}) {
  if (serials.length === 0)
    return <span className="flex h-9 items-center text-xs text-muted-foreground">None left</span>;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium tabular-nums">{picked.length} picked</span>
      <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
        {serials.map((serial) => (
          <button
            key={serial}
            type="button"
            onClick={() => onToggle(serial)}
            className={cn(
              'rounded-md border px-1.5 py-0.5 font-mono text-[11px] transition-colors',
              picked.includes(serial)
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-muted/40 text-muted-foreground hover:bg-muted',
            )}
          >
            {serial}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReturnFormSheet({
  open,
  onOpenChange,
  initialSale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSale?: { id: string; label: string };
}) {
  const navigate = useNavigate();
  const create = useCreateReturn();
  const [search, setSearch] = useState('');
  const [saleLabel, setSaleLabel] = useState<string | null>(initialSale?.label ?? null);
  const sales = useSaleSearch(search, open);
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(initialSale?.id),
  });
  const [saleId, withRefund] = useWatch({ control: form.control, name: ['saleId', 'withRefund'] });
  const returnable = useReturnable(saleId || null);
  const accounts = useReceivingAccounts(open && withRefund);
  const items = saleId && returnable.data?.saleId === saleId ? returnable.data.items : [];
  const refundable = returnable.data
    ? Number(returnable.data.received) - Number(returnable.data.refunded)
    : 0;

  const chooseSale = (id: string | null, label: string | null) => {
    form.setValue('saleId', id ?? '', { shouldValidate: true });
    form.setValue('qty', {});
    form.setValue('serials', {});
    setSaleLabel(label);
  };

  const togglePiece = (productId: string, serial: string) => {
    const current = form.getValues(`serials.${productId}`) ?? [];
    const next = current.includes(serial) ? current.filter((x) => x !== serial) : [...current, serial];
    form.setValue(`serials.${productId}`, next);
    form.setValue(`qty.${productId}`, next.length ? String(next.length) : '', { shouldValidate: true });
  };

  const scanPiece = async (code: string) => {
    const serial = code.trim().toUpperCase();
    const item = items.find((i) => i.serials.includes(serial));
    if (!item) {
      toast.error(`${serial} was not sold on this sale, or it is already returned`);
      return;
    }
    if ((form.getValues(`serials.${item.productId}`) ?? []).includes(serial)) {
      toast.error(`${serial} is already picked`);
      return;
    }
    togglePiece(item.productId, serial);
    toast.success(`${item.product?.name ?? 'Item'} · ${serial}`);
  };

  const submit = form.handleSubmit((values) => {
    const tooMany = items.filter((item) => Number(values.qty[item.productId] ?? 0) > Number(item.returnable));
    for (const item of tooMany)
      form.setError(`qty.${item.productId}`, { message: `At most ${Number(item.returnable)}` });
    if (tooMany.length) return;
    create.mutate(
      {
        saleId: values.saleId,
        date: values.date,
        reason: values.reason,
        note: values.note,
        items: Object.entries(values.qty)
          .filter(([, qty]) => Number(qty) > 0)
          .map(([productId, qty]) => ({
            productId,
            qty,
            ...(values.serials[productId]?.length ? { serials: values.serials[productId] } : {}),
          })),
        ...(values.withRefund
          ? {
              refund: {
                amount: values.refundAmount,
                method: values.refundMethod,
                accountSheetId: values.refundAccountId,
                date: values.refundDate,
              },
            }
          : {}),
      },
      {
        onSuccess: (created) => {
          toast.success(`Return ${created.returnNo} received. Inspect the items next.`);
          form.reset(emptyValues());
          setSaleLabel(null);
          onOpenChange(false);
          void navigate(`/returns/${created.id}`);
        },
        onError: (error) => applyServerErrors(form, error),
      },
    );
  });

  const qtyError = arrayError(form.formState.errors.qty);
  const pickedSerials = useWatch({ control: form.control, name: 'serials' });

  return (
    <Form {...form}>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Receive a return"
        description="Returned goods wait in the returns section until each item is inspected."
        onSubmit={submit}
        submitting={create.isPending}
        submitLabel="Receive return"
        size="lg"
      >
        <FormItem>
          <FormLabel>
            Sale<span className="text-destructive">*</span>
          </FormLabel>
          <Combobox
            value={saleId || null}
            onChange={(value, option) =>
              chooseSale(value, option ? `${option.label} · ${option.hint ?? ''}` : null)
            }
            selectedLabel={saleLabel}
            onSearchChange={setSearch}
            loading={sales.isFetching && !sales.data}
            placeholder="Search invoice no, patient or phone"
            searchPlaceholder="Invoice, patient or phone…"
            emptyText="No sale found."
            options={(sales.data ?? []).map((sale) => ({
              value: sale.id,
              label: sale.invoiceNo,
              hint: `${sale.patient?.name ?? ''} · ${formatDate(sale.date)}`,
            }))}
          />
          {form.formState.errors.saleId ? (
            <p className="text-sm text-destructive">{form.formState.errors.saleId.message}</p>
          ) : null}
        </FormItem>

        {saleId ? (
          <FormSection
            title="Products coming back"
            description="Enter only what came back. For labelled products scan or tick the label of each piece."
          >
            {items.some((i) => i.trackSerials) ? (
              <BarcodeScanInput onScan={scanPiece} placeholder="Scan the DSM label of a returned piece" />
            ) : null}
            {returnable.isLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : (
              <LineItems
                columns={[
                  { header: 'Product', width: 'minmax(0,1fr)' },
                  { header: 'Sold', width: '5rem', align: 'right' },
                  { header: 'Returnable', width: '6rem', align: 'right' },
                  { header: 'Returning', width: '7rem' },
                ]}
                rowKeys={items.map((item) => item.productId)}
                renderRow={(index) => {
                  const item = items[index];
                  if (!item) return [];
                  return [
                    <div key="name" className="flex h-9 flex-col justify-center">
                      <span className="truncate text-sm font-medium">{item.product?.name}</span>
                      {item.product?.barcode ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          {item.product.barcode}
                        </span>
                      ) : null}
                    </div>,
                    <span key="sold" className="flex h-9 items-center justify-end text-sm tabular-nums">
                      {formatQuantity(item.sold)}
                    </span>,
                    <span key="returnable" className="flex h-9 items-center justify-end text-sm tabular-nums">
                      {formatQuantity(item.returnable)}
                    </span>,
                    item.trackSerials ? (
                      <PieceChooser
                        key="qty"
                        serials={item.serials}
                        picked={pickedSerials[item.productId] ?? []}
                        onToggle={(serial) => togglePiece(item.productId, serial)}
                      />
                    ) : (
                      <InlineQuantityField
                        key="qty"
                        control={form.control}
                        name={`qty.${item.productId}`}
                        label={`Returning ${item.product?.name ?? ''}`}
                        placeholder="0"
                      />
                    ),
                  ];
                }}
                error={qtyError}
              />
            )}
          </FormSection>
        ) : null}

        <FieldRow>
          <SelectField
            control={form.control}
            name="reason"
            label="Reason"
            required
            placeholder="Why did it come back?"
            options={REASONS.map((r) => ({ value: r, label: REASON_LABELS[r] }))}
          />
          <TextField control={form.control} name="date" label="Received on" type="date" required />
        </FieldRow>
        <TextareaField control={form.control} name="note" label="Note" rows={2} />

        <FormSection title="Refund">
          <SwitchField
            control={form.control}
            name="withRefund"
            label="Refund the customer"
            description={
              returnable.data
                ? `Up to ${formatMoney(refundable)} can still be refunded on this sale.`
                : 'Leave off when no money is given back.'
            }
          />
          {withRefund ? (
            <>
              <ReceivingAccountsNotice error={accounts.error} />
              <FieldRow>
                <MoneyField control={form.control} name="refundAmount" label="Amount" required />
                <ChoiceField
                  control={form.control}
                  name="refundMethod"
                  label="Method"
                  options={[
                    { value: 'cash', label: 'Cash' },
                    { value: 'online', label: 'Online' },
                  ]}
                />
              </FieldRow>
              <FieldRow>
                <SelectField
                  control={form.control}
                  name="refundAccountId"
                  label="Paid from"
                  required
                  placeholder="Choose account"
                  options={(accounts.data ?? []).map((a) => ({
                    value: a.id,
                    label: a.accountName,
                    hint: a.type,
                  }))}
                />
                <TextField
                  control={form.control}
                  name="refundDate"
                  label="Refund date"
                  type="date"
                  required
                />
              </FieldRow>
            </>
          ) : null}
        </FormSection>
      </FormSheet>
    </Form>
  );
}
