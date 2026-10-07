import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Minus,
  Plus,
  Save,
  ShoppingCart,
  UserPlus,
  X,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { ChoiceField } from '@/components/shared/choice-field';
import { Combobox } from '@/components/shared/combobox';
import { ErrorState } from '@/components/shared/error-state';
import { FieldRow, TextField, TextareaField } from '@/components/shared/form-fields';
import { MoneyInput } from '@/components/shared/money-input';
import { PageHeader } from '@/components/shared/page-header';
import { DetailSkeleton } from '@/components/shared/skeletons';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  emptyPayment,
  PaymentFields,
  paymentSchema,
  ReceivingAccountsNotice,
  toPaymentBody,
  useReceivingAccounts,
} from '@/features/appointments/payment-fields';
import { bundlesApi, type Bundle } from '@/features/catalog/api';
import { usePatientSearch } from '@/features/patients/api';
import {
  patientDefaults,
  PatientFields,
  patientFieldsSchema,
  type PatientFieldValues,
  toPatientInput,
} from '@/features/patients/patient-fields';
import { ApiError } from '@/lib/api/client';
import { applyServerErrors, toastError, toastInvalid } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatMoney, formatQuantity, isoDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { optionalText } from '@/lib/validation';
import { SALE_CITIES, salesApi, useCreateSale, type Sale, type SaleInput } from './api';
import { PosCatalog, type CatalogPick } from './pos-catalog';
import { findItemBySerial } from '@/features/inventory/api';

const lineSchema = z.object({
  kind: z.enum(['product', 'bundle']),
  refId: z.string(),
  name: z.string(),
  price: z.string(),
  available: z.string().optional(),
  tracked: z.boolean().optional(),
  parts: z.array(z.object({ productId: z.string(), qty: z.string() })).optional(),
  discount: z
    .string()
    .trim()
    .regex(/^(\d{1,3}(\.\d{1,2})?)?$/, '%')
    .refine((v) => !v || Number(v) <= 100, 'At most 100')
    .optional(),
  qty: z
    .string()
    .trim()
    .regex(/^\d{1,10}(\.\d{1,3})?$/, 'Qty')
    .refine((v) => Number(v) > 0, 'Qty'),
});

const schema = z
  .object({
    patientMode: z.enum(['existing', 'new']),
    patientId: z.string(),
    patient: z.custom<PatientFieldValues>(),
    saleType: z.enum(['office', 'online']),
    city: z.string().trim().max(100),
    date: z.string().min(1, 'Choose a date'),
    note: optionalText(2000),
    items: z.array(lineSchema).min(1, 'Add at least one product'),
    pieces: z.array(z.object({ serial: z.string(), productId: z.string(), productName: z.string() })),
    autoDiscount: z.boolean(),
    discountPercent: z
      .string()
      .trim()
      .regex(/^(\d{1,3}(\.\d{1,2})?)?$/, 'Use a percentage')
      .refine((v) => !v || Number(v) <= 100, 'At most 100'),
    payments: z.array(paymentSchema).max(10),
  })
  .superRefine((v, ctx) => {
    if (v.patientMode === 'existing') {
      if (!v.patientId) ctx.addIssue({ code: 'custom', path: ['patientId'], message: 'Choose the customer' });
      return;
    }
    const patient = patientFieldsSchema.safeParse(v.patient);
    if (!patient.success)
      for (const issue of patient.error.issues)
        ctx.addIssue({
          code: 'custom',
          path: ['patient', ...issue.path.map(String)],
          message: issue.message,
        });
  });

type Values = z.input<typeof schema>;

interface Shortage {
  productId: string;
  productName: string;
  available: string;
  required: string;
  expired?: string;
}

const discountText = (percent: string) => (Number(percent) ? String(Number(percent)) : '');

export function lineAmounts(line: { qty?: string; price?: string; discount?: string }) {
  const gross = (Number(line.qty) || 0) * (Number(line.price) || 0);
  const off = Math.round(gross * (Number(line.discount) || 0)) / 100;
  return { gross, off, net: gross - off };
}

function fromSale(sale: Sale | undefined, bundles: Bundle[]): Values {
  const lines: Values['items'] = [];
  for (const item of sale?.items ?? []) {
    if (item.bundleId) {
      if (lines.some((l) => l.kind === 'bundle' && l.refId === item.bundleId)) continue;
      const bundle = bundles.find((b) => b.id === item.bundleId);
      const part = bundle?.items.find((b) => b.productId === item.productId);
      lines.push({
        kind: 'bundle',
        refId: item.bundleId,
        name: item.bundle?.name ?? bundle?.name ?? 'Bundle',
        price: bundle?.totalPrice ?? '0',
        qty: String(part ? Number(item.qty) / Number(part.qty) : 1),
        parts: bundle?.items.map((i) => ({ productId: i.productId, qty: i.qty })),
        discount: discountText(item.discountPercent),
      });
      continue;
    }
    lines.push({
      kind: 'product',
      refId: item.productId,
      name: item.product?.name ?? 'Product',
      price: item.unitPrice,
      qty: String(Number(item.qty)),
      tracked: (sale?.serials ?? []).some((p) => p.productId === item.productId),
      discount: discountText(item.discountPercent),
    });
  }
  const names = new Map((sale?.items ?? []).map((i) => [i.productId, i.product?.name ?? 'Product']));
  const pieces = (sale?.serials ?? [])
    .filter((p) => p.status === 'sold')
    .map((p) => ({
      serial: p.serial,
      productId: p.productId,
      productName: names.get(p.productId) ?? 'Product',
    }));
  return {
    patientMode: 'existing',
    patientId: sale?.patientId ?? '',
    patient: patientDefaults(),
    saleType: sale?.saleType ?? 'office',
    city: sale?.city ?? '',
    date: sale?.date ?? isoDate(),
    note: sale?.note ?? null,
    items: lines,
    pieces,
    autoDiscount: false,
    discountPercent: sale ? String(Number(sale.discountPercent)) : '0',
    payments: [],
  };
}

function Totals({ values, saving }: { values: Values; saving: boolean }) {
  const subtotal = values.items.reduce((sum, l) => sum + lineAmounts(l).net, 0);
  const lineOff = values.items.reduce((sum, l) => sum + lineAmounts(l).off, 0);
  const received = values.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const discount = values.autoDiscount
    ? Math.max(0, subtotal - received)
    : (subtotal * (Number(values.discountPercent) || 0)) / 100;
  const total = subtotal - discount;
  const qty = values.items.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
  const percent = Number(values.discountPercent) || 0;
  const rows: [string, string][] = [
    ['Total qty', formatQuantity(qty)],
    ...(lineOff > 0
      ? ([
          ['Products before discount', formatMoney(subtotal + lineOff)],
          ['Product discounts', `− ${formatMoney(lineOff)}`],
        ] as [string, string][])
      : []),
    ['Sub amount', formatMoney(subtotal)],
    [`Overall discount (${percent}%)`, discount > 0 ? `− ${formatMoney(discount)}` : formatMoney(0)],
  ];
  return (
    <div className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between">
          <span className="text-muted-foreground">{label}</span>
          <span className="tabular-nums">{value}</span>
        </div>
      ))}
      <div className="flex items-baseline justify-between border-t pt-2">
        <span className="font-medium">Total</span>
        <span className="text-lg font-semibold tabular-nums">{formatMoney(total)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {saving ? 'Saving…' : 'Preview. The server prices the sale and calculates the saved totals.'}
      </p>
    </div>
  );
}

function PosForm({ sale, bundles }: { sale?: Sale; bundles: Bundle[] }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const editing = Boolean(sale);
  const create = useCreateSale();
  const update = salesApi.useSave();
  const accounts = useReceivingAccounts(!editing);
  const cityListId = useId();
  const [patientSearch, setPatientSearch] = useState('');
  const patients = usePatientSearch(patientSearch);
  const [patientLabel, setPatientLabel] = useState<string | null>(
    sale?.patient ? `${sale.patient.name} · ${sale.patient.phone}` : null,
  );
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: fromSale(sale, bundles),
  });
  const lines = useFieldArray({ control: form.control, name: 'items' });
  const payments = useFieldArray({ control: form.control, name: 'payments' });
  const values = useWatch({ control: form.control }) as Values;
  const patientMode = values.patientMode;
  const saving = create.isPending || update.isPending;
  const shortProducts = new Set(shortages.map((s) => s.productId));

  const withinStock = (line: { name: string; available?: string }, qty: number) => {
    if (line.available === undefined || qty <= Number(line.available)) return true;
    toast.error(`Only ${formatQuantity(line.available)} ${line.name} in stock`);
    return false;
  };

  const pick = (item: CatalogPick) => {
    const current = form.getValues('items');
    const index = current.findIndex((l) => l.kind === item.kind && l.refId === item.refId);
    const line = current[index];
    if (line) {
      const qty = (Number(line.qty) || 0) + 1;
      if (!withinStock({ name: line.name, available: line.available ?? item.available }, qty)) return;
      form.setValue(`items.${index}.qty`, String(qty), { shouldDirty: true });
      return;
    }
    if (!withinStock(item, 1)) return;
    lines.append({ ...item, qty: '1' });
  };

  const bundleNeed = (productId: string) =>
    form
      .getValues('items')
      .filter((l) => l.kind === 'bundle')
      .reduce(
        (sum, l) =>
          sum +
          (Number(l.qty) || 0) *
            (l.parts ?? []).filter((p) => p.productId === productId).reduce((n, p) => n + Number(p.qty), 0),
        0,
      );

  const syncPieces = (productId: string, name: string, price: string) => {
    const count = form.getValues('pieces').filter((p) => p.productId === productId).length;
    const qty = Math.max(0, count - bundleNeed(productId));
    const current = form.getValues('items');
    const index = current.findIndex((l) => l.kind === 'product' && l.refId === productId);
    if (index >= 0 && qty === 0) lines.remove(index);
    else if (index >= 0) form.setValue(`items.${index}.qty`, String(qty), { shouldDirty: true });
    else if (qty > 0)
      lines.append({ kind: 'product', refId: productId, name, price, tracked: true, qty: String(qty) });
  };

  const addPiece = async (code: string) => {
    try {
      const piece = await findItemBySerial(code);
      if (piece.status !== 'in_stock') {
        toast.error(
          `${piece.serial} ${piece.status === 'sold' ? `is already sold (${piece.invoiceNo ?? ''})` : `is ${piece.status.replace('_', ' ')}`}`,
        );
        return;
      }
      if (piece.expiryDate && piece.expiryDate < form.getValues('date')) {
        toast.error(`${piece.serial} expired on ${formatDate(piece.expiryDate)}`);
        return;
      }
      if (form.getValues('pieces').some((p) => p.serial === piece.serial)) {
        toast.error(`${piece.serial} is already in the cart`);
        return;
      }
      form.setValue('pieces', [
        ...form.getValues('pieces'),
        { serial: piece.serial, productId: piece.productId, productName: piece.productName },
      ]);
      syncPieces(piece.productId, piece.productName, piece.salePrice);
      toast.success(`${piece.productName} · ${piece.serial}`);
    } catch (error) {
      toastError(error);
    }
  };

  const removePiece = (serial: string) => {
    const piece = form.getValues('pieces').find((p) => p.serial === serial);
    if (!piece) return;
    form.setValue(
      'pieces',
      form.getValues('pieces').filter((p) => p.serial !== serial),
    );
    const line = form.getValues('items').find((l) => l.kind === 'product' && l.refId === piece.productId);
    syncPieces(piece.productId, piece.productName, line?.price ?? '0');
  };

  const step = (index: number, delta: number) => {
    const line = form.getValues(`items.${index}`);
    const qty = (Number(line.qty) || 0) + delta;
    if (qty <= 0) lines.remove(index);
    else if (delta < 0 || withinStock(line, qty))
      form.setValue(`items.${index}.qty`, String(qty), { shouldDirty: true });
  };

  const handleError = (error: unknown) => {
    if (error instanceof ApiError && error.status === 422) {
      const details = error.details as { shortages?: Shortage[] } | undefined;
      if (details?.shortages?.length) {
        setShortages(details.shortages);
        toast.error('Not enough stock for some products');
        return;
      }
    }
    applyServerErrors(form, error);
  };

  const cityEdited = useRef(Boolean(sale));
  const newPatientCity = values.patientMode === 'new' ? values.patient?.city : undefined;
  useEffect(() => {
    if (newPatientCity && !cityEdited.current) form.setValue('city', newPatientCity);
  }, [newPatientCity, form]);

  const submit = form.handleSubmit((v) => {
    if (!sale && v.payments.length === 0) {
      form.setError('payments', { message: 'Add the payment. A sale is saved only with its payment.' });
      toast.error('Add the payment first. A sale is saved only with its payment.');
      return;
    }
    setShortages([]);
    const items = v.items.map((l) => ({
      ...(l.kind === 'product' ? { productId: l.refId } : { bundleId: l.refId }),
      qty: l.qty,
      ...(l.discount ? { discountPercent: l.discount } : {}),
    }));
    const serials = v.pieces.map((p) => p.serial);
    if (v.saleType === 'online' && serials.length) {
      toast.error(
        'Online orders are scanned when they are dispatched. Remove the scanned labels or choose Office sale.',
      );
      return;
    }
    if (sale) {
      update.mutate(
        {
          id: sale.id,
          body: {
            patientId: v.patientId,
            date: v.date,
            saleType: v.saleType,
            ...(v.city ? { city: v.city } : {}),
            note: v.note,
            items,
            serials,
            discountPercent: v.discountPercent || '0',
          },
        },
        {
          onSuccess: () => {
            toast.success(`${sale.invoiceNo} updated`);
            void navigate(`/sales/${sale.id}`);
          },
          onError: handleError,
        },
      );
      return;
    }
    const proofs: File[] = [];
    const body: SaleInput = {
      ...(v.patientMode === 'existing'
        ? { patientId: v.patientId }
        : { patient: toPatientInput(patientFieldsSchema.parse(v.patient)) }),
      date: v.date,
      saleType: v.saleType,
      ...(v.city ? { city: v.city } : {}),
      note: v.note,
      items,
      ...(serials.length ? { serials } : {}),
      autoDiscount: v.autoDiscount,
      ...(v.autoDiscount ? {} : { discountPercent: v.discountPercent || '0' }),
      payments: v.payments.map((p) => {
        const proofIndexes = p.method === 'online' ? p.proofs.map((file) => proofs.push(file) - 1) : [];
        return { ...toPaymentBody(p), ...(proofIndexes.length ? { proofIndexes } : {}) };
      }),
    };
    create.mutate(
      { body, proofs },
      {
        onSuccess: (created) => {
          toast.success(
            created.saleType === 'online'
              ? `Order ${created.invoiceNo} booked · awaiting dispatch`
              : `Sale ${created.invoiceNo} saved`,
          );
          void navigate(`/print/bill/${created.id}`);
        },
        onError: handleError,
      },
    );
  }, toastInvalid);

  const itemsError = form.formState.errors.items?.root?.message ?? form.formState.errors.items?.message;

  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <section className="min-w-0 rounded-xl border bg-card p-4 shadow-xs">
          <PosCatalog
            online={values.saleType === 'online'}
            onPick={pick}
            onPiece={addPiece}
            inCart={(kind, refId) => {
              const line = values.items.find((l) => l.kind === kind && l.refId === refId);
              return line ? formatQuantity(line.qty) : undefined;
            }}
          />
        </section>

        <aside className="space-y-4 xl:sticky xl:top-[calc(var(--topbar-height)+1.5rem)] xl:self-start">
          <section className="space-y-4 rounded-xl border bg-card p-4 shadow-xs">
            {patientMode === 'existing' ? (
              <FormField
                control={form.control}
                name="patientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Customer<span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value}
                        onChange={(value, option) => {
                          field.onChange(value ?? '');
                          setPatientLabel(option ? `${option.label} · ${option.hint ?? ''}` : null);
                          const city = option?.hint?.split(' · ')[1];
                          if (city && !cityEdited.current) form.setValue('city', city);
                        }}
                        selectedLabel={patientLabel}
                        onSearchChange={setPatientSearch}
                        loading={patients.isFetching && !patients.data}
                        placeholder="Search by phone or name"
                        options={(patients.data ?? []).map((p) => ({
                          value: p.id,
                          label: p.name,
                          hint: `${p.phone} · ${p.city}`,
                        }))}
                        footer={
                          editing || !can('patients.create')
                            ? undefined
                            : (close) => (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start"
                                  onClick={() => {
                                    close();
                                    form.setValue('patientMode', 'new');
                                    if (/\d{4,}/.test(patientSearch))
                                      form.setValue('patient.phone', patientSearch.trim());
                                  }}
                                >
                                  <UserPlus />
                                  Add a new customer
                                </Button>
                              )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">New customer</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => form.setValue('patientMode', 'existing')}
                  >
                    <X />
                    Pick existing
                  </Button>
                </div>
                <PatientFields
                  prefix="patient."
                  onUseExisting={(existing) => {
                    form.setValue('patientMode', 'existing');
                    form.setValue('patientId', existing.id);
                    setPatientLabel(`${existing.name} · ${existing.phone}`);
                  }}
                />
              </div>
            )}
            {sale ? (
              <div className="space-y-1">
                <div className="text-sm font-medium">Sale type</div>
                <div className="text-sm text-muted-foreground">
                  {sale.saleType === 'online' ? 'Online sale' : 'Office sale'} · cannot change after saving
                </div>
              </div>
            ) : (
              <ChoiceField
                control={form.control}
                name="saleType"
                label="Sale type"
                description={
                  values.saleType === 'online'
                    ? 'The stock is booked now and leaves the inventory when the order is dispatched and scanned.'
                    : undefined
                }
                options={[
                  { value: 'office', label: 'Office sale' },
                  { value: 'online', label: 'Online sale' },
                ]}
              />
            )}
            <FieldRow>
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sale city</FormLabel>
                    <FormControl>
                      <Input
                        list={cityListId}
                        placeholder="Customer city"
                        {...field}
                        onChange={(event) => {
                          cityEdited.current = true;
                          field.onChange(event);
                        }}
                      />
                    </FormControl>
                    <datalist id={cityListId}>
                      {SALE_CITIES.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <TextField control={form.control} name="date" label="Date" type="date" required />
            </FieldRow>
          </section>

          <section className="rounded-xl border bg-card shadow-xs">
            <header className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <ShoppingCart className="size-4" />
                Cart
              </h2>
              <span className="text-xs text-muted-foreground">{lines.fields.length} lines</span>
            </header>
            {shortages.length ? (
              <div className="m-3 flex gap-2 rounded-lg border border-destructive/40 bg-destructive-soft p-3 text-sm text-destructive-soft-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <ul className="space-y-0.5">
                  {shortages.map((s) => (
                    <li key={s.productId}>
                      {s.productName}: need {formatQuantity(s.required)}, only {formatQuantity(s.available)}{' '}
                      in stock
                      {s.expired ? ` (${formatQuantity(s.expired)} more are expired and cannot be sold)` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {lines.fields.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {itemsError ?? 'Tap products or scan barcodes to add them.'}
              </p>
            ) : (
              <ul className="max-h-80 divide-y overflow-y-auto">
                {lines.fields.map((field, index) => {
                  const line = values.items[index];
                  const overStock =
                    line?.available !== undefined && (Number(line.qty) || 0) > Number(line.available);
                  const short = (field.kind === 'product' && shortProducts.has(field.refId)) || overStock;
                  return (
                    <li
                      key={field.id}
                      className={cn('flex items-center gap-2 px-4 py-2.5', short && 'bg-destructive-soft/50')}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{field.name}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {field.kind === 'bundle' ? 'Bundle · ' : ''}
                          {formatMoney(line?.price)} each
                          {line?.available !== undefined ? (
                            <span className={cn(overStock && 'font-medium text-destructive')}>
                              {' · '}
                              {formatQuantity(line.available)} in stock
                            </span>
                          ) : null}
                        </div>
                        {field.kind === 'product' && line?.tracked ? (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {(values.pieces ?? [])
                              .filter((p) => p.productId === field.refId)
                              .map((p) => (
                                <span
                                  key={p.serial}
                                  className="inline-flex items-center gap-0.5 rounded-md border bg-muted/50 py-0.5 pr-0.5 pl-1.5 font-mono text-[11px]"
                                >
                                  {p.serial}
                                  <button
                                    type="button"
                                    className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                    aria-label={`Remove ${p.serial}`}
                                    onClick={() => removePiece(p.serial)}
                                  >
                                    <X className="size-3" />
                                  </button>
                                </span>
                              ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-7"
                          aria-label="Less"
                          disabled={line?.tracked && values.saleType !== 'online'}
                          onClick={() => step(index, -1)}
                        >
                          <Minus />
                        </Button>
                        <FormField
                          control={form.control}
                          name={`items.${index}.qty`}
                          render={({ field: qty }) => (
                            <MoneyInput
                              prefix=""
                              decimals={3}
                              aria-label={`${field.name} quantity`}
                              className={cn('mx-1 h-7 w-14 px-1 text-center', short && 'border-destructive')}
                              {...qty}
                              readOnly={line?.tracked && values.saleType !== 'online'}
                            />
                          )}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-7"
                          aria-label="More"
                          disabled={line?.tracked && values.saleType !== 'online'}
                          onClick={() => step(index, 1)}
                        >
                          <Plus />
                        </Button>
                      </div>
                      <FormField
                        control={form.control}
                        name={`items.${index}.discount`}
                        render={({ field: off, fieldState }) => (
                          <div className="relative" title="Discount on this product only">
                            <MoneyInput
                              prefix=""
                              decimals={2}
                              placeholder="0"
                              aria-label={`${field.name} discount percent`}
                              className={cn(
                                'h-7 w-16 pr-5 pl-1.5 text-right',
                                fieldState.error && 'border-destructive',
                              )}
                              {...off}
                              value={off.value ?? ''}
                            />
                            <span className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-xs text-muted-foreground">
                              %
                            </span>
                          </div>
                        )}
                      />
                      <span className="w-24 text-right text-sm font-medium tabular-nums">
                        {line && lineAmounts(line).off > 0 ? (
                          <span className="block text-xs font-normal text-muted-foreground line-through">
                            {formatMoney(lineAmounts(line).gross)}
                          </span>
                        ) : null}
                        {formatMoney(line ? lineAmounts(line).net : 0)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground"
                        aria-label={`Remove ${field.name}`}
                        onClick={() => {
                          if (line?.tracked) {
                            form.setValue(
                              'pieces',
                              form.getValues('pieces').filter((p) => p.productId !== field.refId),
                            );
                          }
                          lines.remove(index);
                        }}
                      >
                        <X />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Discount</div>
                <div className="text-xs text-muted-foreground">Overall discount on the sub amount.</div>
              </div>
              <FormField
                control={form.control}
                name="discountPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <MoneyInput
                        prefix="%"
                        decimals={2}
                        className="w-24"
                        aria-label="Discount percent"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!editing ? (
              <div className="space-y-3">
                <ReceivingAccountsNotice error={accounts.error} />
                {payments.fields.map((field, index) => (
                  <div key={field.id} className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Payment {index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Remove payment"
                        onClick={() => payments.remove(index)}
                      >
                        <X />
                      </Button>
                    </div>
                    <PaymentFields
                      prefix={`payments.${index}.`}
                      accounts={accounts.data ?? []}
                      maxProofs={5}
                    />
                  </div>
                ))}
                {accounts.data ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={payments.fields.length >= 10}
                    onClick={() => {
                      const subtotal = values.items.reduce((s, l) => s + lineAmounts(l).net, 0);
                      const paid = values.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                      payments.append(emptyPayment(subtotal > paid ? (subtotal - paid).toFixed(2) : ''));
                    }}
                  >
                    <Plus />
                    Add payment
                  </Button>
                ) : null}
                {payments.fields.length === 0 ? (
                  <p
                    className={cn(
                      'text-xs',
                      form.formState.errors.payments ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    A sale is saved only with its payment. New payments wait for approval before the sale
                    shows as paid.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Payments are managed on the sale page.</p>
            )}

            <Totals values={values} saving={saving} />
            <TextareaField control={form.control} name="note" label="Note" rows={2} />
            <Button type="submit" className="h-11 w-full text-base" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {editing ? 'Save changes' : 'Save sale & print bill'}
            </Button>
          </section>
        </aside>
      </form>
    </Form>
  );
}

export function PosPage() {
  const { id } = useParams();
  const sale = salesApi.useDetail(id);
  const bundles = bundlesApi.useList({ pageSize: 100 }, Boolean(id));

  if (id && (sale.isLoading || bundles.isLoading)) return <DetailSkeleton />;
  if (id && (sale.error || !sale.data))
    return <ErrorState error={sale.error} onRetry={() => void sale.refetch()} />;

  return (
    <>
      {id ? (
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
          <Link to={`/sales/${id}`}>
            <ArrowLeft />
            {sale.data?.invoiceNo}
          </Link>
        </Button>
      ) : null}
      <PageHeader
        title={id ? `Edit sale ${sale.data?.invoiceNo ?? ''}` : 'Add sale'}
        description={
          id
            ? 'Change the customer, items or discount. Payments are managed on the sale page.'
            : 'Tap products or scan barcodes, choose the customer, take payment and print the bill.'
        }
      />
      <PosForm key={sale.data?.id ?? 'new'} sale={sale.data} bundles={bundles.data?.data ?? []} />
    </>
  );
}
