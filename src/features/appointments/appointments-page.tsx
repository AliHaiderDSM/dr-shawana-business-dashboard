import type { ColumnDef } from '@tanstack/react-table';
import {
  CalendarCheck,
  CalendarPlus,
  CalendarX,
  Eye,
  FilePlus2,
  FileText,
  HeartPulse,
  LayoutList,
  CalendarDays,
  Link2,
  MessageSquareText,
  Pencil,
  Printer,
  Stethoscope,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { DateRangeFilter, enumOptions, FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { doctorsApi } from '@/features/doctors/api';
import { BHRT_LABELS, patientsApi } from '@/features/patients/api';
import { useListState } from '@/hooks/use-list-state';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatMoney } from '@/lib/format';
import {
  appointmentsApi,
  MODE_LABELS,
  patientLink,
  STATUS_LABELS,
  timeRange,
  useAppointmentList,
  VISIT_LABELS,
  type Appointment,
} from './api';
import { AppointmentCalendar } from './appointment-calendar';
import { AppointmentFormSheet } from './appointment-form-sheet';
import { ClinicalSheet, type ClinicalTarget } from './clinical-sheet';
import { StatusDialog, type StatusChange } from './status-dialog';

const CALENDAR_KEYS = new Set(['view', 'span', 'day']);

export function AppointmentsPage() {
  const navigate = useNavigate();
  const { me, can, isSuperAdmin } = useAuth();
  const isDoctor = me?.role === 'doctor';
  const [params, setParams] = useSearchParams();
  const list = useListState({ defaultSort: '-date' });
  const view = list.filters.view === 'calendar' ? 'calendar' : 'list';
  const listQuery = useMemo(
    () => Object.fromEntries(Object.entries(list.query).filter(([key]) => !CALENDAR_KEYS.has(key))),
    [list.query],
  );
  const query = useAppointmentList(listQuery);
  const doctors = doctorsApi.useOptions();
  const remove = appointmentsApi.useRemove();
  const prefillPatientId = params.get('patientId') ?? undefined;
  const prefillPatient = patientsApi.useDetail(params.get('new') === '1' ? prefillPatientId : undefined);
  const [booking, setBooking] = useState(params.get('new') === '1');
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [statusChange, setStatusChange] = useState<StatusChange | null>(null);
  const [removing, setRemoving] = useState<Appointment | null>(null);
  const [clinical, setClinical] = useState<ClinicalTarget | null>(null);
  const canConsult = can('consultations.view');

  const copyLink = (a: Appointment) => {
    patientLink(a.id)
      .then((link) => navigator.clipboard.writeText(link))
      .then(
        () => toast.success('Patient link copied. It works without login for 30 days.'),
        (error: unknown) => toastError(error),
      );
  };

  const openBooking = () => {
    setEditing(null);
    setFormKey((k) => k + 1);
    setBooking(true);
  };

  const closeBooking = (open: boolean) => {
    setBooking(open);
    if (!open && params.has('new')) {
      params.delete('new');
      params.delete('patientId');
      setParams(params, { replace: true });
    }
  };

  const columns: ColumnDef<Appointment, unknown>[] = [
    {
      id: 'appointmentNo',
      header: 'Appointment #',
      accessorFn: (a) => `APP#${a.appointmentNo}`,
      meta: { sortKey: 'appointmentNo' },
      cell: ({ row }) => (
        <span className="font-medium whitespace-nowrap">APP#{row.original.appointmentNo}</span>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      accessorKey: 'date',
      meta: { sortKey: 'date', hideable: false },
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <div className="font-medium">{formatDate(row.original.date)}</div>
          <div className="text-xs text-muted-foreground">{formatDate(row.original.date, 'EEEE')}</div>
        </div>
      ),
    },
    {
      id: 'time',
      header: 'Time',
      accessorFn: (a) => timeRange(a.timeFrom, a.timeTo),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{timeRange(row.original.timeFrom, row.original.timeTo)}</span>
      ),
    },
    {
      id: 'patient',
      header: 'Patient',
      accessorFn: (a) => `${a.patient?.name ?? ''} ${a.patient?.phone ?? ''}`,
      meta: { hideable: false },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-medium">{row.original.patient?.name}</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {row.original.patient?.phone}
            {row.original.patientCity ? ` · ${row.original.patientCity}` : ''}
          </div>
        </div>
      ),
    },
    {
      id: 'doctor',
      header: 'Doctor',
      accessorFn: (a) => a.doctor?.name ?? '',
      cell: ({ row }) => row.original.doctor?.name ?? '—',
    },
    {
      id: 'visit',
      header: 'Visit',
      accessorFn: (a) => `${MODE_LABELS[a.mode]} / ${VISIT_LABELS[a.visitType]}`,
      cell: ({ row }) => (
        <div className="text-sm">
          <div>{MODE_LABELS[row.original.mode]}</div>
          <div className="text-xs text-muted-foreground">{VISIT_LABELS[row.original.visitType]}</div>
        </div>
      ),
    },
    {
      id: 'receivedAmount',
      header: 'Received',
      accessorKey: 'receivedAmount',
      meta: { align: 'right' },
      cell: ({ row }) => formatMoney(row.original.receivedAmount),
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'createdBy',
      header: 'Entered by',
      accessorFn: (a) => a.createdByName ?? '',
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <div>{row.original.createdByName ?? '—'}</div>
          <div className="text-xs text-muted-foreground">{formatDate(row.original.createdAt)}</div>
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right', hideable: false },
      cell: ({ row }) => {
        const a = row.original;
        const open = a.status === 'booked';
        return (
          <RowActions
            actions={[
              {
                label: 'Add prescription',
                icon: FilePlus2,
                hidden: !can('prescriptions.create'),
                onSelect: () =>
                  void navigate(`/prescriptions/new?patientId=${a.patientId}&doctorId=${a.doctorId}`),
              },
              { label: 'View', icon: Eye, onSelect: () => void navigate(`/appointments/${a.id}`) },
              {
                label: 'Copy link',
                icon: Link2,
                hidden: !canConsult || isSuperAdmin,
                onSelect: () => copyLink(a),
              },
              {
                label: 'Remarks 2.0',
                icon: Stethoscope,
                hidden: !canConsult || isSuperAdmin || a.status === 'cancelled',
                onSelect: () => void navigate(`/appointments/${a.id}/consultation`),
              },
              {
                label: 'Remarks',
                icon: MessageSquareText,
                hidden: !can('appointments.update'),
                onSelect: () => setStatusChange({ appointment: a, status: a.status, remarks: true }),
              },
              {
                label: 'BHRT',
                icon: HeartPulse,
                hidden: !canConsult || isSuperAdmin,
                onSelect: () => setClinical({ appointment: a, view: 'bhrt' }),
              },
              {
                label: 'Medical record',
                icon: FileText,
                hidden: !canConsult || isSuperAdmin,
                onSelect: () => setClinical({ appointment: a, view: 'records' }),
              },
              {
                label: 'Print',
                icon: Printer,
                hidden: isSuperAdmin,
                onSelect: () => void navigate(`/print/appointment/${a.id}`),
              },
              {
                label: 'Edit',
                icon: Pencil,
                hidden: !can('appointments.update') || !open,
                onSelect: () => {
                  setEditing(a);
                  setFormKey((k) => k + 1);
                  setBooking(true);
                },
              },
              {
                label: 'Complete',
                icon: CalendarCheck,
                separatorBefore: true,
                hidden: !can('appointments.update') || !open,
                onSelect: () => setStatusChange({ appointment: a, status: 'completed' }),
              },
              {
                label: 'Cancel',
                icon: CalendarX,
                hidden: !can('appointments.update') || !open,
                onSelect: () => setStatusChange({ appointment: a, status: 'cancelled' }),
              },
              {
                label: 'Delete',
                icon: Trash2,
                destructive: true,
                separatorBefore: true,
                hidden: !can('appointments.delete'),
                onSelect: () => setRemoving(a),
              },
            ]}
          />
        );
      },
    },
  ];

  const doctorOptions = (doctors.data ?? []).map((d) => ({ value: d.id, label: d.name }));

  return (
    <>
      <PageHeader
        title={isDoctor ? 'My appointments' : 'Appointments'}
        description={
          isDoctor
            ? 'Your bookings. Start a consultation from any appointment.'
            : 'Bookings for every doctor in this branch.'
        }
        actions={
          <>
            <ToggleGroup
              type="single"
              variant="outline"
              value={view}
              onValueChange={(value) =>
                value && list.setFilter('view', value === 'calendar' ? 'calendar' : undefined)
              }
            >
              <ToggleGroupItem value="list" className="h-9 px-3" aria-label="List view">
                <LayoutList />
                List
              </ToggleGroupItem>
              <ToggleGroupItem value="calendar" className="h-9 px-3" aria-label="Calendar view">
                <CalendarDays />
                Calendar
              </ToggleGroupItem>
            </ToggleGroup>
            {can('appointments.create') ? (
              <Button onClick={openBooking}>
                <CalendarPlus />
                Book appointment
              </Button>
            ) : null}
          </>
        }
      />
      {view === 'calendar' ? (
        <AppointmentCalendar
          list={list}
          doctors={(doctors.data ?? []).map((d) => ({ id: d.id, name: d.name }))}
          lockDoctor={isDoctor}
        />
      ) : (
        <DataTable
          columns={columns}
          data={query.data?.data}
          meta={query.data?.meta}
          list={list}
          isLoading={query.isLoading}
          isFetching={query.isFetching}
          error={query.error}
          onRetry={() => void query.refetch()}
          searchPlaceholder="Patient, phone or number"
          exportFileName="appointments"
          onRowClick={(a) => void navigate(`/appointments/${a.id}`)}
          emptyTitle="No appointments"
          emptyDescription="Book the first appointment for this branch."
          toolbar={
            <>
              <DateRangeFilter list={list} />
              {isDoctor ? null : (
                <FilterSelect
                  list={list}
                  name="doctorId"
                  allLabel="All doctors"
                  className="w-44"
                  options={doctorOptions}
                />
              )}
              <FilterSelect
                list={list}
                name="status"
                allLabel="All statuses"
                className="w-36"
                options={enumOptions(['booked', 'completed', 'cancelled'] as const, STATUS_LABELS)}
              />
              <FilterSelect
                list={list}
                name="mode"
                allLabel="Online & physical"
                className="w-44"
                options={enumOptions(['online', 'physical'] as const, MODE_LABELS)}
              />
              <FilterSelect
                list={list}
                name="visitType"
                allLabel="All types"
                className="w-32"
                options={enumOptions(['new', 'followup'] as const, VISIT_LABELS)}
              />
              <FilterSelect
                list={list}
                name="bhrtStatus"
                allLabel="Any BHRT"
                className="w-36"
                options={enumOptions(['on', 'off', 'recommended', 'none'] as const, BHRT_LABELS)}
              />
            </>
          }
        />
      )}
      <AppointmentFormSheet
        key={`${formKey}-${prefillPatient.data?.id ?? ''}`}
        appointment={editing}
        defaults={{
          patientId: prefillPatientId,
          patientName: prefillPatient.data
            ? `${prefillPatient.data.name} · ${prefillPatient.data.phone}`
            : undefined,
          doctorId: list.filters.doctorId,
        }}
        open={booking}
        onOpenChange={closeBooking}
      />
      <StatusDialog change={statusChange} onClose={() => setStatusChange(null)} />
      <ClinicalSheet target={clinical} onClose={() => setClinical(null)} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete appointment #${removing?.appointmentNo ?? ''}?`}
        description="The appointment and its payments are removed from reports. This cannot be undone here."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? remove
                .mutateAsync(removing.id)
                .then(() => toast.success('Appointment deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
