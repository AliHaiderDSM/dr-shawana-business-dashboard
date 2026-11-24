import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { DateRangeFilter, enumOptions, FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { doctorsApi } from '@redux/features/doctors';
import { useBranchOptions } from '@redux/features/branches';
import { useListState } from '@/hooks/use-list-state';
import { formatDate, formatMoney } from '@/lib/format';
import { useAllBranchesAppointments, type AllBranchesAppointment } from '@redux/features/appointments';
import { appointmentNumber, MODE_LABELS, STATUS_LABELS, timeLabel, VISIT_LABELS } from './constants';

const columns: ColumnDef<AllBranchesAppointment, unknown>[] = [
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
];

export function AllAppointmentsPage() {
  const list = useListState({ defaultSort: '-date' });
  const query = useAllBranchesAppointments(list.query);
  const branches = useBranchOptions(true);
  const doctors = doctorsApi.useOptions();

  return (
    <>
      <PageHeader
        title="All appointments"
        description="Appointments across every branch. Filter by branch, date and more."
      />
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
              className="w-44"
              options={(doctors.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
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
