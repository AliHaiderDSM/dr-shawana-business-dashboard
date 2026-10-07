import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import {
  ArrowLeft,
  Ban,
  CheckCheck,
  FileImage,
  Pencil,
  Plus,
  Printer,
  Trash2,
  Truck,
  Undo2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import type { z } from 'zod';
import { openSignedUrl } from '@/components/shared/attachment-list';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { ErrorState } from '@/components/shared/error-state';
import { FormSheet } from '@/components/shared/form-sheet';
import { PageHeader } from '@/components/shared/page-header';
import { DetailList, Panel } from '@/components/shared/panel';
import { RowActions } from '@/components/shared/row-actions';
import { DetailSkeleton } from '@/components/shared/skeletons';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import {
  emptyPayment,
  PaymentFields,
  paymentSchema,
  ReceivingAccountsNotice,
  toPaymentBody,
  useReceivingAccounts,
  type PaymentValues,
} from '@/features/appointments/payment-fields';
import { REASON_LABELS, useReturns } from '@/features/returns/api';
import { ReturnStatusBadge } from '@/features/returns/returns-page';
import { applyServerErrors, toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatDateTime, formatMoney, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  SALE_TYPE_LABELS,
  salePaymentProofUrl,
  salesApi,
  useRemoveSalePayment,
  useRemoveSalePaymentProof,
  useSaveSalePayment,
  type Sale,
  type SalePayment,
} from './api';
import { DeliveryBadge, useOrderActions } from './delivery-actions';
import { useCanChangeSale } from './sales-page';

type Item = Sale['items'][number];

const itemColumns: ColumnDef<Item, unknown>[] = [
  {
    id: 'product',
    header: 'Product',
    accessorFn: (i) => i.product?.name ?? '',
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.product?.name}</div>
        {row.original.bundle ? (
          <div className="text-xs text-muted-foreground">in {row.original.bundle.name}</div>
        ) : null}
      </div>
    ),
  },
  {
    id: 'qty',
    header: 'Qty',
    accessorKey: 'qty',
    meta: { align: 'right' },
    cell: ({ row }) => formatQuantity(row.original.qty),
  },
  {
    id: 'unitPrice',
    header: 'Price',
    accessorKey: 'unitPrice',
    meta: { align: 'right' },
    cell: ({ row }) => formatMoney(row.original.unitPrice),
  },
  {
    id: 'discount',
    header: 'Discount',
    accessorKey: 'discountAmount',
    meta: { align: 'right' },
    cell: ({ row }) =>
      Number(row.original.discountPercent) ? (
        <span className="tabular-nums">
          {formatMoney(row.original.discountAmount)}
          <span className="text-xs text-muted-foreground"> ({Number(row.original.discountPercent)}%)</span>
        </span>
      ) : (
        '—'
      ),
  },
  {
    id: 'lineTotal',
    header: 'Total',
    accessorKey: 'lineTotal',
    meta: { align: 'right' },
    cell: ({ row }) => <span className="font-medium">{formatMoney(row.original.lineTotal)}</span>,
  },
];

function SalePaymentSheet({
  saleId,
  payment,
  suggested,
  open,
  onOpenChange,
}: {
  saleId: string;
  payment: SalePayment | null;
  suggested: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveSalePayment(saleId);
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
          proofs: [],
        }
      : emptyPayment(suggested),
  });

  const submit = form.handleSubmit((values) =>
    save.mutate(
      {
        paymentId: payment?.id,
        body: toPaymentBody(values),
        proofs: values.method === 'online' ? values.proofs : [],
      },
      {
        onSuccess: () => {
          toast.success(payment ? 'Payment updated' : 'Payment added');
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
        title={payment ? 'Edit payment' : 'Add payment'}
        description="Received and remaining are recalculated by the server."
        onSubmit={submit}
        submitting={save.isPending}
        submitLabel={payment ? 'Save changes' : 'Add payment'}
      >
        <ReceivingAccountsNotice error={accounts.error} />
        <PaymentFields accounts={accounts.data ?? []} maxProofs={5 - (payment?.proofs.length ?? 0)} />
      </FormSheet>
    </Form>
  );
}

function DeliveryTimeline({ sale }: { sale: Sale }) {
  const cancelled = sale.deliveryStatus === 'cancelled';
  const returned = sale.deliveryStatus === 'returned';
  const steps = [
    { label: 'Ordered', date: sale.date, done: true, hint: 'Stock booked for this order' },
    cancelled
      ? { label: 'Cancelled', date: null, done: true, hint: 'Booked stock was freed' }
      : {
          label: 'Dispatched',
          date: sale.dispatchedOn,
          done: Boolean(sale.dispatchedOn),
          hint: sale.dispatchedOn ? 'Stock left the inventory' : 'Waiting for dispatch',
        },
    ...(cancelled
      ? []
      : [
          returned
            ? { label: 'Returned', date: null, done: true, hint: 'Sent to the returns section' }
            : {
                label: 'Delivered',
                date: sale.deliveredOn,
                done: Boolean(sale.deliveredOn),
                hint: sale.deliveredOn ? 'Reached the customer' : 'Not delivered yet',
              },
        ]),
  ];
  return (
    <Panel title="Delivery">
      <ol className="space-y-0">
        {steps.map((step, index) => (
          <li key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'mt-1 size-2.5 rounded-full border-2',
                  step.done ? 'border-primary bg-primary' : 'border-muted-foreground/40 bg-background',
                )}
              />
              {index < steps.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
            </div>
            <div className="pb-4 text-sm">
              <div className={cn('font-medium', !step.done && 'text-muted-foreground')}>
                {step.label}
                {step.date ? (
                  <span className="font-normal text-muted-foreground"> · {formatDate(step.date)}</span>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground">{step.hint}</div>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function SaleDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const canChange = useCanChangeSale();
  const sale = salesApi.useDetail(id);
  const returns = useReturns({ saleId: id, pageSize: 50 });
  const removePayment = useRemoveSalePayment(id);
  const removeProof = useRemoveSalePaymentProof(id);
  const orders = useOrderActions();
  const [payment, setPayment] = useState<SalePayment | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentKey, setPaymentKey] = useState(0);
  const [removing, setRemoving] = useState<SalePayment | null>(null);

  if (sale.isLoading) return <DetailSkeleton />;
  if (sale.error || !sale.data) return <ErrorState error={sale.error} onRetry={() => void sale.refetch()} />;
  const s = sale.data;
  const editable = canChange(s, 'update');
  const online = s.saleType === 'online';

  const openPayment = (entry: SalePayment | null) => {
    setPayment(entry);
    setPaymentKey((k) => k + 1);
    setPaymentOpen(true);
  };

  const paymentColumns: ColumnDef<SalePayment, unknown>[] = [
    { id: 'date', header: 'Date', accessorKey: 'date', cell: ({ row }) => formatDate(row.original.date) },
    {
      id: 'method',
      header: 'Method',
      accessorKey: 'method',
      cell: ({ row }) => (
        <StatusBadge tone={row.original.method === 'cash' ? 'neutral' : 'primary'}>
          {row.original.method === 'cash' ? 'Cash' : 'Online'}
        </StatusBadge>
      ),
    },
    {
      id: 'account',
      header: 'Received in',
      accessorFn: (p) => p.accountSheet?.accountName ?? '',
    },
    {
      id: 'sender',
      header: 'Sender',
      accessorFn: (p) => [p.senderBank, p.senderAccountTitle].filter(Boolean).join(' · '),
      cell: ({ row }) =>
        row.original.method === 'online' ? (
          <span className="text-xs">
            {[row.original.senderBank, row.original.senderAccountTitle, row.original.senderAccountNo]
              .filter(Boolean)
              .join(' · ') || '—'}
          </span>
        ) : (
          '—'
        ),
    },
    {
      id: 'proof',
      header: 'Screenshots',
      accessorFn: (p) => p.proofs.length,
      cell: ({ row }) =>
        row.original.proofs.length ? (
          <div className="flex flex-col items-start gap-1">
            {row.original.proofs.map((proof, i) => (
              <div key={proof.id} className="flex items-center gap-1">
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  title={proof.originalName}
                  onClick={() =>
                    void openSignedUrl(() => salePaymentProofUrl(s.id, row.original.id, proof.id))
                  }
                >
                  <FileImage />
                  Screenshot {i + 1}
                </Button>
                {editable ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove screenshot ${i + 1}`}
                    disabled={removeProof.isPending}
                    onClick={() =>
                      removeProof.mutate(
                        { paymentId: row.original.id, proofId: proof.id },
                        {
                          onSuccess: () => toast.success('Screenshot removed'),
                          onError: (error) => toastError(error),
                        },
                      )
                    }
                  >
                    <X className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          '—'
        ),
    },
    {
      id: 'amount',
      header: 'Amount',
      accessorKey: 'amount',
      meta: { align: 'right' },
      cell: ({ row }) => <span className="font-medium">{formatMoney(row.original.amount)}</span>,
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right', hideable: false },
      cell: ({ row }) => (
        <RowActions
          actions={[
            { label: 'Edit', icon: Pencil, hidden: !editable, onSelect: () => openPayment(row.original) },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              hidden: !editable,
              onSelect: () => setRemoving(row.original),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
        <Link to="/sales">
          <ArrowLeft />
          Sales
        </Link>
      </Button>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {s.invoiceNo}
            <StatusBadge status={s.paymentStatus} />
            {s.deliveryStatus ? <DeliveryBadge status={s.deliveryStatus} /> : null}
          </span>
        }
        description={`${SALE_TYPE_LABELS[s.saleType]} · ${s.city} · ${formatDate(s.date)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => void navigate(`/print/bill/${s.id}`)}>
              <Printer />
              Print bill
            </Button>
            {online && s.deliveryStatus === 'pending' && editable ? (
              <Button variant="outline" onClick={() => orders.cancel(s)}>
                <Ban />
                Cancel order
              </Button>
            ) : null}
            {online && s.deliveryStatus === 'pending' && can('sales.update') ? (
              <Button onClick={() => orders.dispatch(s)}>
                <Truck />
                Dispatch
              </Button>
            ) : null}
            {online && s.deliveryStatus === 'dispatched' && can('sales.update') ? (
              <Button variant="outline" onClick={() => orders.delivered(s)}>
                <CheckCheck />
                Delivered
              </Button>
            ) : null}
            {online &&
            (s.deliveryStatus === 'dispatched' || s.deliveryStatus === 'delivered') &&
            can('sales.update') ? (
              <Button variant="outline" onClick={() => orders.returned(s)}>
                <Undo2 />
                Returned
              </Button>
            ) : null}
            {editable &&
            s.deliveryStatus !== 'returned' &&
            s.deliveryStatus !== 'cancelled' &&
            !returns.data?.data.length ? (
              <Button onClick={() => void navigate(`/sales/${s.id}/edit`)}>
                <Pencil />
                Edit sale
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Items</h2>
            <DataTable columns={itemColumns} data={s.items} emptyTitle="No items" />
          </div>
          {s.serials?.length ? (
            <Panel title="Labelled pieces" description="The exact packs on this sale." bodyClassName="p-4">
              <div className="flex flex-wrap gap-1.5">
                {s.serials.map((p) => (
                  <Link
                    key={p.serial}
                    to={`/inventory/labels/${p.serial}`}
                    title={`${s.items.find((i) => i.productId === p.productId)?.product?.name ?? ''} · ${p.status}`}
                    className={cn(
                      'rounded-md border px-2 py-0.5 font-mono text-xs hover:border-primary hover:text-primary',
                      p.status !== 'sold' && 'text-muted-foreground line-through',
                    )}
                  >
                    {p.serial}
                  </Link>
                ))}
              </div>
            </Panel>
          ) : null}
          {s.batches?.length ? (
            <Panel
              title="Batches"
              description="Stock is taken from the batch that expires first."
              bodyClassName="p-0"
            >
              <ul className="divide-y">
                {s.batches.map((b) => (
                  <li
                    key={`${b.productId}-${b.batchId ?? 'none'}`}
                    className="flex items-center gap-3 px-5 py-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {s.items.find((i) => i.productId === b.productId)?.product?.name ?? 'Product'}
                    </span>
                    {b.batchId ? (
                      <Link
                        to={`/inventory/batches/${b.batchId}`}
                        className="font-mono text-primary hover:underline"
                      >
                        {b.batchNo}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">No batch</span>
                    )}
                    <span className="w-28 text-muted-foreground">
                      {b.expiryDate ? `exp ${formatDate(b.expiryDate)}` : ''}
                    </span>
                    <span className="w-16 text-right tabular-nums">{formatQuantity(b.qty)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Payments</h2>
              {editable ? (
                <Button size="sm" variant="outline" onClick={() => openPayment(null)}>
                  <Plus />
                  Add payment
                </Button>
              ) : null}
            </div>
            <DataTable columns={paymentColumns} data={s.payments} emptyTitle="No payments yet" />
          </div>
          {returns.data?.data.length ? (
            <Panel title="Returns" bodyClassName="p-0">
              <ul className="divide-y">
                {returns.data.data.map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/returns/${r.id}`}
                      className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-muted/50"
                    >
                      <span className="font-medium">{r.returnNo}</span>
                      <span className="text-muted-foreground">
                        {REASON_LABELS[r.reason]} · {formatQuantity(r.totalQty)} items · {formatDate(r.date)}
                      </span>
                      <span className="ml-auto">
                        <ReturnStatusBadge record={r} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
        <div className="space-y-6">
          {online ? <DeliveryTimeline sale={s} /> : null}
          <Panel title="Customer">
            <DetailList
              items={[
                {
                  label: 'Name',
                  value: s.patient ? (
                    <Link to={`/patients/${s.patient.id}`} className="text-primary hover:underline">
                      {s.patient.name}
                    </Link>
                  ) : null,
                },
                { label: 'Phone', value: s.patient?.phone },
                { label: 'Patient city', value: s.patientCity },
                { label: 'Created', value: formatDateTime(s.createdAt) },
              ]}
            />
            {s.note ? <p className="mt-4 border-t pt-4 text-sm whitespace-pre-wrap">{s.note}</p> : null}
          </Panel>
          <Panel title="Totals">
            <dl className="space-y-2 text-sm">
              {(
                [
                  ['Total qty', formatQuantity(s.totalQty)],
                  ['Sub amount', formatMoney(s.subtotal)],
                  [`Discount (${Number(s.discountPercent)}%)`, formatMoney(s.discountAmount)],
                  ['Total', formatMoney(s.total)],
                  ['Received', formatMoney(s.received)],
                  ['Remaining', formatMoney(s.remaining)],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          {can('returns.create') ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                void navigate(
                  `/returns?new=1&saleId=${s.id}&saleLabel=${encodeURIComponent(`${s.invoiceNo} · ${s.patient?.name ?? ''}`)}`,
                )
              }
            >
              <Undo2 />
              Receive a return for this sale
            </Button>
          ) : null}
        </div>
      </div>

      <SalePaymentSheet
        key={paymentKey}
        saleId={s.id}
        payment={payment}
        suggested={Number(s.remaining) > 0 ? s.remaining : ''}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
      />
      {orders.dialogs}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Delete this payment?"
        description="Received and remaining are recalculated."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? removePayment
                .mutateAsync(removing.id)
                .then(() => toast.success('Payment deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
