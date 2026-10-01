import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, CheckCheck, FileImage, Pencil, Plus, Printer, Trash2, Undo2 } from 'lucide-react';
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
import {
  SALE_TYPE_LABELS,
  salePaymentProofUrl,
  salesApi,
  useRemoveSalePayment,
  useSaveSalePayment,
  type Sale,
  type SalePayment,
} from './api';
import { useCanChangeSale, useDeliveryAction } from './sales-page';

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
          proof: null,
        }
      : emptyPayment(suggested),
  });

  const submit = form.handleSubmit((values) =>
    save.mutate(
      { paymentId: payment?.id, body: toPaymentBody(values), proof: values.proof },
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
        <PaymentFields accounts={accounts.data ?? []} />
      </FormSheet>
    </Form>
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
  const delivery = useDeliveryAction();
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
      header: 'Screenshot',
      accessorFn: (p) => (p.hasProof ? 'Yes' : ''),
      cell: ({ row }) =>
        row.original.hasProof ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => void openSignedUrl(() => salePaymentProofUrl(s.id, row.original.id))}
          >
            <FileImage />
            View
          </Button>
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
            {s.deliveryStatus ? <StatusBadge status={s.deliveryStatus} /> : null}
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
              <Button variant="outline" onClick={() => delivery.ask(s, 'delivered')}>
                <CheckCheck />
                Delivered
              </Button>
            ) : null}
            {online && s.deliveryStatus !== 'returned' && editable ? (
              <Button variant="outline" onClick={() => delivery.ask(s, 'returned')}>
                <Undo2 />
                Returned
              </Button>
            ) : null}
            {editable && s.deliveryStatus !== 'returned' && !returns.data?.data.length ? (
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
      {delivery.dialog}
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
