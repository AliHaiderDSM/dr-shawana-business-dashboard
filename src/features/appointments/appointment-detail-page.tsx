import type { ColumnDef } from '@tanstack/react-table';
import {
  ArrowLeft,
  CalendarCheck,
  CalendarX,
  FileImage,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Undo2,
  Stethoscope,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { AttachmentList, openSignedUrl } from '@/components/shared/attachment-list';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { DetailList, Panel } from '@/components/shared/panel';
import { RowActions } from '@/components/shared/row-actions';
import { DetailSkeleton } from '@/components/shared/skeletons';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { BhrtBadge } from '@/features/patients/bhrt-badge';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import {
  appointmentFiles,
  appointmentsApi,
  useRemoveAppointmentAttachmentMutation,
  useRemoveAppointmentPaymentMutation,
  useRemoveAppointmentRefundMutation,
  type AppointmentPayment,
  type AppointmentRefund,
} from '@redux/features/appointments';
import { METHOD_LABELS, MODE_LABELS, timeRange, VISIT_LABELS } from './constants';
import { AppointmentFormSheet } from './appointment-form-sheet';
import { PaymentSheet } from './payment-sheet';
import { RefundSheet } from './refund-sheet';
import { StatusDialog, type StatusChange } from './status-dialog';

export function AppointmentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can, isSuperAdmin } = useAuth();
  const [removeRefund] = useRemoveAppointmentRefundMutation();
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundKey, setRefundKey] = useState(0);
  const [removingRefund, setRemovingRefund] = useState<AppointmentRefund | null>(null);
  const appointment = appointmentsApi.useDetail(id);
  const [removePayment] = useRemoveAppointmentPaymentMutation();
  const [removeAttachment] = useRemoveAppointmentAttachmentMutation();
  const [editOpen, setEditOpen] = useState(false);
  const [statusChange, setStatusChange] = useState<StatusChange | null>(null);
  const [payment, setPayment] = useState<AppointmentPayment | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentKey, setPaymentKey] = useState(0);
  const [removingPayment, setRemovingPayment] = useState<AppointmentPayment | null>(null);

  if (appointment.isLoading) return <DetailSkeleton />;
  if (appointment.error || !appointment.data)
    return <ErrorState error={appointment.error} onRetry={() => void appointment.refetch()} />;
  const a = appointment.data;
  const isOpen = a.status === 'booked';
  const refundable = Math.max(0, Number(a.receivedAmount) - Number(a.refundedAmount));
  const canUpdate = can('appointments.update');

  const openPayment = (entry: AppointmentPayment | null) => {
    setPayment(entry);
    setPaymentKey((k) => k + 1);
    setPaymentOpen(true);
  };

  const paymentColumns: ColumnDef<AppointmentPayment, unknown>[] = [
    { id: 'date', header: 'Date', accessorKey: 'date', cell: ({ row }) => formatDate(row.original.date) },
    {
      id: 'method',
      header: 'Method',
      accessorKey: 'method',
      cell: ({ row }) => (
        <StatusBadge tone={row.original.method === 'cash' ? 'neutral' : 'primary'}>
          {METHOD_LABELS[row.original.method]}
        </StatusBadge>
      ),
    },
    {
      id: 'account',
      header: 'Received in',
      accessorFn: (p) => p.accountSheet?.accountName ?? '',
      cell: ({ row }) => row.original.accountSheet?.accountName ?? '—',
    },
    {
      id: 'sender',
      header: 'Sender',
      accessorFn: (p) => [p.senderBank, p.senderAccountTitle, p.senderAccountNo].filter(Boolean).join(' / '),
      cell: ({ row }) =>
        row.original.method === 'online' ? (
          <div className="text-xs">
            <div>{row.original.senderBank ?? '—'}</div>
            <div className="text-muted-foreground">
              {[row.original.senderAccountTitle, row.original.senderAccountNo].filter(Boolean).join(' · ')}
            </div>
          </div>
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
            onClick={() => void openSignedUrl(() => appointmentFiles.paymentProof(a.id, row.original.id))}
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
            {
              label: 'Edit',
              icon: Pencil,
              hidden: !can('appointmentPayments.update'),
              onSelect: () => openPayment(row.original),
            },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              hidden: !can('appointmentPayments.delete'),
              onSelect: () => setRemovingPayment(row.original),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
        <Link to="/appointments">
          <ArrowLeft />
          Appointments
        </Link>
      </Button>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Appointment #{a.appointmentNo}
            <StatusBadge status={a.status} />
          </span>
        }
        description={`${formatDate(a.date, 'EEEE, dd MMM yyyy')} · ${timeRange(a.timeFrom, a.timeTo)} · ${a.doctor?.name ?? ''}`}
        actions={
          <>
            <Button variant="outline" onClick={() => void navigate(`/print/appointment/${a.id}`)}>
              <Printer />
              Print slip
            </Button>
            {canUpdate && isOpen ? (
              <>
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStatusChange({ appointment: a, status: 'cancelled' })}
                >
                  <CalendarX />
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStatusChange({ appointment: a, status: 'completed' })}
                >
                  <CalendarCheck />
                  Complete
                </Button>
              </>
            ) : null}
            {canUpdate && !isOpen ? (
              <Button variant="outline" onClick={() => setStatusChange({ appointment: a, status: 'booked' })}>
                <RotateCcw />
                Reopen
              </Button>
            ) : null}
            {can('consultations.view') && a.status !== 'cancelled' ? (
              <Button onClick={() => void navigate(`/appointments/${a.id}/consultation`)}>
                <Stethoscope />
                {a.status === 'completed' ? 'Open consultation' : 'Start consultation'}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Panel title="Visit">
            <DetailList
              items={[
                {
                  label: 'Patient',
                  value: (
                    <Link to={`/patients/${a.patientId}`} className="text-primary hover:underline">
                      {a.patient?.name}
                    </Link>
                  ),
                },
                { label: 'Phone', value: a.patient?.phone },
                { label: 'City', value: a.patientCity ?? a.patient?.city },
                { label: 'BHRT', value: <BhrtBadge status={a.patient?.bhrtStatus ?? 'none'} /> },
                { label: 'Doctor', value: a.doctor?.name },
                { label: 'Online / physical', value: MODE_LABELS[a.mode] },
                { label: 'Type', value: VISIT_LABELS[a.visitType] },
                {
                  label: 'Booked',
                  value: `${formatDateTime(a.createdAt)}${a.source === 'app' ? ' · app' : ''}`,
                },
              ]}
            />
            {a.issues ? (
              <div className="mt-5 border-t pt-4">
                <div className="text-xs text-muted-foreground">Issues</div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{a.issues}</p>
              </div>
            ) : null}
            {a.remark ? (
              <div className="mt-5 border-t pt-4">
                <div className="text-xs text-muted-foreground">Remark</div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{a.remark}</p>
              </div>
            ) : null}
          </Panel>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Payments{' '}
                <span className="font-normal text-muted-foreground">
                  · {formatMoney(a.receivedAmount)} received
                </span>
              </h2>
              {can('appointmentPayments.create') ? (
                <Button size="sm" variant="outline" onClick={() => openPayment(null)}>
                  <Plus />
                  Add payment
                </Button>
              ) : null}
            </div>
            <DataTable
              columns={paymentColumns}
              data={a.payments}
              emptyTitle="No payments yet"
              emptyDescription="Record cash or online payments for this visit."
            />
          </div>

          {a.status === 'cancelled' && (a.refunds.length > 0 || (isSuperAdmin && refundable > 0)) ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  Refunds{' '}
                  <span className="font-normal text-muted-foreground">
                    · {formatMoney(a.refundedAmount)} refunded
                    {refundable > 0 ? ` · ${formatMoney(refundable)} still held` : ''}
                  </span>
                </h2>
                {isSuperAdmin && refundable > 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRefundKey((k) => k + 1);
                      setRefundOpen(true);
                    }}
                  >
                    <Undo2 />
                    Refund
                  </Button>
                ) : null}
              </div>
              {a.refunds.length ? (
                <ul className="divide-y rounded-xl border bg-card text-sm">
                  {a.refunds.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium tabular-nums">{formatMoney(r.amount)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(r.date)} · {METHOD_LABELS[r.method]} ·{' '}
                          {r.accountSheet?.accountName ?? '—'}
                          {r.note ? ` · ${r.note}` : ''}
                        </div>
                      </div>
                      {isSuperAdmin ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="Remove refund"
                          onClick={() => setRemovingRefund(r)}
                        >
                          <Trash2 />
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No refund yet. {formatMoney(refundable)} received for this cancelled visit is still held.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <Panel title="Remark screenshots">
            <AttachmentList
              files={a.attachments}
              emptyText="No screenshots."
              getUrl={(file) => appointmentFiles.attachment(a.id, file.id)}
              onRemove={
                canUpdate
                  ? (file) =>
                      removeAttachment({ appointmentId: id, attachmentId: file.id })
                        .unwrap()
                        .then(() => toast.success('Screenshot removed'))
                  : undefined
              }
            />
          </Panel>
          <Panel title="Medical records">
            {a.medicalRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground">No records with this booking.</p>
            ) : (
              <div className="space-y-4">
                {a.medicalRecords.map((record) => (
                  <div key={record.id} className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      {formatDate(record.date)}
                      {record.note ? ` · ${record.note}` : ''}
                    </div>
                    <AttachmentList
                      files={record.files}
                      getUrl={(file) => appointmentFiles.medicalRecord(a.id, file.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <AppointmentFormSheet appointment={a} open={editOpen} onOpenChange={setEditOpen} />
      <StatusDialog change={statusChange} onClose={() => setStatusChange(null)} />
      <PaymentSheet
        key={paymentKey}
        appointmentId={a.id}
        payment={payment}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
      />
      <RefundSheet
        key={refundKey}
        appointmentId={a.id}
        refundable={refundable}
        open={refundOpen}
        onOpenChange={setRefundOpen}
      />
      <ConfirmDialog
        open={removingRefund !== null}
        onOpenChange={(o) => !o && setRemovingRefund(null)}
        title="Remove this refund?"
        description="Use this only for a refund entered by mistake. The money counts as held again."
        confirmLabel="Remove"
        destructive
        onConfirm={() =>
          removingRefund
            ? removeRefund({ appointmentId: id, refundId: removingRefund.id })
                .unwrap()
                .then(() => toast.success('Refund removed'))
                .catch(toastError)
            : undefined
        }
      />
      <ConfirmDialog
        open={removingPayment !== null}
        onOpenChange={(o) => !o && setRemovingPayment(null)}
        title="Delete this payment?"
        description="It is removed from the account balance and payment reports."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removingPayment
            ? removePayment({ appointmentId: id, paymentId: removingPayment.id })
                .unwrap()
                .then(() => toast.success('Payment deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
