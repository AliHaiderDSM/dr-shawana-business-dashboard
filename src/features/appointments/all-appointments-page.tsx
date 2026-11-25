import type { ColumnDef } from '@tanstack/react-table';
import { CalendarCheck, CalendarClock, CircleCheck } from 'lucide-react';
import { useNavigate } from 'react-router';
import { DataTable } from '@/components/shared/data-table';
import { DateRangeFilter, enumOptions, FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { serialColumn } from '@/components/shared/serial-column';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { useAllBranchesDoctorOptions } from '@redux/features/doctors';
import { useBranchOptions } from '@redux/features/branches';
import { useListState, type ListState } from '@/hooks/use-list-state';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatMoney } from '@/lib/format';
import {
  useAllBranchesAppointments,
  useAllBranchesAppointmentsSummary,
  type AllBranchesAppointment,
} from '@redux/features/appointments';
import { appointmentNumber, MODE_LABELS, STATUS_LABELS, timeLabel, VISIT_LABELS } from './constants';

const columns = (list: ListState, total: number | undefined): ColumnDef<AllBranchesAppointment, unknown>[] => [
  serialColumn<AllBranchesAppointment>({
    page: list.page,
    pageSize: list.pageSize,
    total,
    newestFirst: true,
  }),
  {
    id: 'appointmentNo',
    header: 'Appointment #',
    accessorFn: (a) => `APP#${appointmentNumber(a)}`,
    meta: { sortKey: 'appointmentNo', hideable: false },
    cell: ({ row }) => <span className="font-medium whitespace-nowrap">APP#{appointmentNumber(row.original)}</span>,
  },
  {
    id: 'date',
    header: 'Date',
    accessorKey: 'date',
    meta: { sortKey: 'date' },
    cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.date)}</span>,
  },
  {
    id: 'time',
    header: 'Time',
    accessorFn: (a) => a.timeFrom,
    cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{timeLabel(row.original.timeFrom)}</span>,
  },
  {
    id: 'patient',
    header: 'Patient',
    accessorFn: (a) => a.patient?.name ?? '',
    meta: { hideable: false },
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="truncate font-medium">{row.original.patient?.name ?? '—'}</div>
        <div className="text-xs text-muted-foreground">{row.original.patient?.phone ?? ''}</div>
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
    id: 'branch',
    header: 'Branch',
    accessorFn: (a) => a.branch?.name ?? '',
    cell: ({ row }) => (
      <div className="whitespace-nowrap">
        <div className="text-xs text-muted-foreground">{row.original.branch?.code ?? '—'}</div>
        <div>{row.original.branch?.name ?? '—'}</div>
      </div>
    ),
  },
  {
    id: 'visit',
    header: 'Visit',
    accessorFn: (a) => `${MODE_LABELS[a.mode]} / ${VISIT_LABELS[a.visitType]}`,
    cell: ({ row }) => (
      <div className="text-sm">
        {MODE_LABELS[row.original.mode]} · {VISIT_LABELS[row.original.visitType]}
      </div>
    ),
  },
  {
    id: 'fee',
    header: 'Fee',
    accessorKey: 'fee',
    meta: { align: 'right' },
    cell: ({ row }) => <span className="tabular-nums">{formatMoney(row.original.fee)}</span>,
  },
  {
    id: 'status',
    header: 'Status',
    accessorKey: 'status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: 'entryBy',
    header: 'Entry By',
    accessorFn: (a) => a.createdByName ?? '',
    cell: ({ row }) => (
      <div className="whitespace-nowrap text-sm">
        <div className="text-muted-foreground">{formatDate(row.original.createdAt)}</div>
        <div>{row.original.createdByName ?? '—'}</div>
      </div>
    ),
  },
];

export function AllAppointmentsPage() {
  const navigate = useNavigate();
  const { setBranchId } = useAuth();
  const list = useListState({ defaultSort: '-date' });
  const query = useAllBranchesAppointments(list.query);
  const summary = useAllBranchesAppointmentsSummary(list.query);
  const branches = useBranchOptions(true);
  const doctors = useAllBranchesDoctorOptions();

  const openAppointment = (a: AllBranchesAppointment) => {
    if (a.branch) setBranchId(a.branch.id);
    navigate(`/appointments/${a.id}`);
  };

  return (
    <>
      <PageHeader
        title="All appointments"
        description="Appointments across every branch. Filter by branch, date and more."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="All appointments"
          icon={CalendarCheck}
          value={summary.data?.total ?? '—'}
          hint="Across every branch, with the filters applied"
        />
        <StatCard label="Booked" icon={CalendarClock} value={summary.data?.booked ?? '—'} hint="Not yet completed" />
        <StatCard
          label="Completed"
          icon={CircleCheck}
          value={summary.data?.completed ?? '—'}
          hint="Consultation done"
        />
      </div>
      <DataTable
        columns={columns(list, query.data?.meta?.total)}
        data={query.data?.data}
        meta={query.data?.meta}
        list={list}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        onRowClick={openAppointment}
        searchPlaceholder="Patient, phone or number"
        exportFileName="all-appointments"
        emptyTitle="No appointments match"
        toolbar={
          <>
            <FilterSelect
              list={list}
              name="branchId"
              allLabel="All branches"
              className="w-44"
              options={(branches.data ?? []).map((b) => ({ value: b.id, label: `${b.code} · ${b.name}` }))}
            />
            <DateRangeFilter list={list} />
            <FilterSelect
              list={list}
              name="doctorId"
              allLabel="All doctors"
              className="w-48"
              options={(doctors.data ?? []).map((d) => ({
                value: d.id,
                label: d.branchCode ? `${d.name} (${d.branchCode})` : d.name,
              }))}
            />
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
          </>
        }
      />
    </>
  );
}
