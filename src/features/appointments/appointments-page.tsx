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
  Repeat,
  UserPlus,
  MessageSquareText,
  Pencil,
  Printer,
  Stethoscope,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { DateRangeFilter, enumOptions, FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { doctorsApi, useMyDoctorProfile } from '@redux/features/doctors';
import { BHRT_LABELS } from '@/features/patients/constants';
import { patientsApi } from '@redux/features/patients';
import { useListState } from '@/hooks/use-list-state';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatMoney } from '@/lib/format';
import {
  appointmentsApi,
  patientLink,
  useAppointmentList,
  useAppointmentSummary,
  type Appointment,
  type AppointmentSummaryQuery,
} from '@redux/features/appointments';
import {
  appointmentNumber,
  MODE_LABELS,
  STATUS_LABELS,
  timeLabel,
  timeRange,
  VISIT_LABELS,
} from './constants';
import { AppointmentCalendar } from './appointment-calendar';
import { AppointmentFormSheet } from './appointment-form-sheet';
import { ClinicalSheet, type ClinicalTarget } from './clinical-sheet';
import { StatusDialog, type StatusChange } from './status-dialog';

const CALENDAR_KEYS = new Set(['view', 'span', 'day']);
const SUMMARY_KEYS = new Set(['doctorId', 'status', 'mode', 'visitType', 'bhrtStatus', 'repeat', 'search']);

function PatientName({ name }: { name: string | undefined }) {
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);
  const measure = (el: HTMLElement) => setCut(el.scrollWidth > el.clientWidth);
  return (
    <Tooltip open={open && cut} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <div
          className="max-w-40 truncate font-medium"
          onMouseEnter={(e) => measure(e.currentTarget)}
          onFocus={(e) => measure(e.currentTarget)}
        >
          {name}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" align="start">
        {name}
      </TooltipContent>
    </Tooltip>
  );
}

export function AppointmentsPage() {
  const navigate = useNavigate();
  const { me, can, isSuperAdmin } = useAuth();
  const isDoctor = me?.role === 'doctor';
  const [params, setParams] = useSearchParams();
  const list = useListState({ defaultSort: '-appointmentNo' });
  const defaultView = isDoctor ? 'calendar' : 'list';
  const view =
    list.filters.view === 'calendar' || list.filters.view === 'list' ? list.filters.view : defaultView;
  const listQuery = useMemo(
    () => Object.fromEntries(Object.entries(list.query).filter(([key]) => !CALENDAR_KEYS.has(key))),
    [list.query],
  );
  const showRepeats = list.filters.repeat === 'true';
  const query = useAppointmentList({ ...listQuery, repeat: showRepeats ? 'true' : 'false' });
  const summaryFrom = list.filters.from;
  const summaryTo = list.filters.to ?? list.filters.from;
  const summary = useAppointmentSummary({
    ...(summaryFrom ? { from: summaryFrom } : {}),
    ...(summaryTo ? { to: summaryTo } : {}),
    ...(Object.fromEntries(
      Object.entries(listQuery).filter(([key, value]) => SUMMARY_KEYS.has(key) && value),
    ) as AppointmentSummaryQuery),
  });
  const summaryPeriod =
    summaryFrom && summaryTo
      ? summaryFrom === summaryTo
        ? formatDate(summaryFrom)
        : `${formatDate(summaryFrom)} – ${formatDate(summaryTo)}`
      : 'All dates';
  const [repeatOf, setRepeatOf] = useState<Appointment | null>(null);
  const doctors = doctorsApi.useOptions();
  const myDoctor = useMyDoctorProfile(isDoctor);
  const [remove] = appointmentsApi.useRemove();
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
    setRepeatOf(null);
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
      accessorFn: (a) => `APP#${appointmentNumber(a)}`,
      meta: { sortKey: 'appointmentNo' },
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <div className="font-medium">APP#{appointmentNumber(row.original)}</div>
          {row.original.repeatNo ? (
            <div className="text-xs text-muted-foreground">Repeat of APP#{row.original.appointmentNo}</div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      accessorKey: 'date',
      meta: { sortKey: 'date', hideable: false },
      cell: ({ row }) => (
        <span className="font-medium whitespace-nowrap">{formatDate(row.original.date)}</span>
      ),
    },
    {
      id: 'time',
      header: 'Time',
      accessorFn: (a) => timeRange(a.timeFrom, a.timeTo),
      cell: ({ row }) => (
        <div className="leading-tight whitespace-nowrap tabular-nums">
          <div className="font-medium">{timeLabel(row.original.timeFrom)}</div>
          <div className="text-xs text-muted-foreground">to {timeLabel(row.original.timeTo)}</div>
        </div>
      ),
    },
    {
      id: 'patient',
      header: 'Patient',
      accessorFn: (a) => `${a.patient?.name ?? ''} ${a.patient?.phone ?? ''}`,
      meta: { hideable: false },
      cell: ({ row }) => (
        <div className="min-w-0">
          <PatientName name={row.original.patient?.name} />
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
        <div className="flex flex-col items-start gap-1 text-sm">
          <span>{MODE_LABELS[row.original.mode]}</span>
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-[11px] leading-none font-medium',
              row.original.visitType === 'followup'
                ? 'border-info/30 bg-info-soft text-info-soft-foreground'
                : 'border-success/30 bg-success-soft text-success-soft-foreground',
            )}
          >
            {VISIT_LABELS[row.original.visitType]}
          </span>
        </div>
      ),
    },
    {
      id: 'receivedAmount',
      header: 'Received',
      accessorKey: 'receivedAmount',
      meta: { align: 'right' },
      cell: ({ row }) => <span className="tabular-nums">{formatMoney(row.original.receivedAmount)}</span>,
    },
    {
      id: 'remainingAmount',
      header: 'Remaining',
      accessorKey: 'remainingAmount',
      meta: { align: 'right' },
      cell: ({ row }) =>
        Number(row.original.remainingAmount) > 0 ? (
          <span className="font-medium text-destructive tabular-nums">
            {formatMoney(row.original.remainingAmount)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
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
                  void navigate(
                    `/prescriptions/new?patientId=${a.patientId}&doctorId=${a.doctorId}&date=${a.date}`,
                  ),
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
                  setRepeatOf(null);
                  setFormKey((k) => k + 1);
                  setBooking(true);
                },
              },
              {
                label: 'Repeat visit',
                icon: Repeat,
                hidden: !can('appointments.create') || a.status !== 'completed',
                onSelect: () => {
                  setEditing(null);
                  setRepeatOf(a);
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
                value && list.setFilter('view', value === defaultView ? undefined : value)
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
      {view === 'calendar' ? null : (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Appointments"
            icon={CalendarCheck}
            value={summary.data?.appointments ?? '—'}
            hint={`${summaryPeriod} · repeats not counted`}
          />
          <StatCard
            label="Repeat visits"
            icon={Repeat}
            value={summary.data?.repeats ?? '—'}
            hint="Like APP#4.1, no fee"
          />
          <StatCard
            label="New patients"
            icon={UserPlus}
            value={summary.data?.newPatients ?? '—'}
            hint="First visit in this period"
          />
        </div>
      )}
      {view === 'calendar' ? (
        <AppointmentCalendar
          list={list}
          doctors={(doctors.data ?? [])
            .filter((d) => !isDoctor || d.id === myDoctor.data?.id)
            .map((d) => ({ id: d.id, name: d.name }))}
          lockDoctor={isDoctor}
          defaultSpan={isDoctor ? 'week' : 'day'}
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
          emptyTitle={showRepeats ? 'No repeat visits' : 'No appointments'}
          emptyDescription={
            showRepeats
              ? 'Repeat visits like APP#4.1 are booked from a completed appointment.'
              : 'Book the first appointment for this branch.'
          }
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
                name="repeat"
                allLabel="Appointments"
                className="w-40"
                options={[{ value: 'true', label: 'Repeat visits' }]}
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
        defaults={
          repeatOf
            ? {
                patientId: repeatOf.patientId,
                patientName: `${repeatOf.patient?.name ?? ''} · ${repeatOf.patient?.phone ?? ''}`,
                repeatOf: {
                  id: repeatOf.id,
                  label: `APP#${appointmentNumber(repeatOf)} · ${formatDate(repeatOf.date)} · ${repeatOf.doctor?.name ?? ''}`,
                },
              }
            : {
                patientId: prefillPatientId,
                patientName: prefillPatient.data
                  ? `${prefillPatient.data.name} · ${prefillPatient.data.phone}`
                  : undefined,
                doctorId: list.filters.doctorId,
              }
        }
        open={booking}
        onOpenChange={closeBooking}
      />
      <StatusDialog change={statusChange} onClose={() => setStatusChange(null)} />
      <ClinicalSheet target={clinical} onClose={() => setClinical(null)} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete appointment #${removing ? appointmentNumber(removing) : ''}?`}
        description="The appointment and its payments are removed from reports. This cannot be undone here."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? remove(removing.id)
                .unwrap()
                .then(() => toast.success('Appointment deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
