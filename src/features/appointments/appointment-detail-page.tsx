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
  METHOD_LABELS,
  MODE_LABELS,
  timeRange,
  useRemoveAppointmentAttachment,
  useRemovePayment,
  VISIT_LABELS,
  type AppointmentPayment,
} from './api';
import { AppointmentFormSheet } from './appointment-form-sheet';
import { PaymentSheet } from './payment-sheet';
import { StatusDialog, type StatusChange } from './status-dialog';

export function AppointmentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const appointment = appointmentsApi.useDetail(id);
  const removePayment = useRemovePayment(id);
  const removeAttachment = useRemoveAppointmentAttachment(id);
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
                      removeAttachment.mutateAsync(file.id).then(() => toast.success('Screenshot removed'))
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
      <ConfirmDialog
        open={removingPayment !== null}
        onOpenChange={(o) => !o && setRemovingPayment(null)}
        title="Delete this payment?"
        description="It is removed from the account balance and payment reports."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removingPayment
            ? removePayment
                .mutateAsync(removingPayment.id)
                .then(() => toast.success('Payment deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
