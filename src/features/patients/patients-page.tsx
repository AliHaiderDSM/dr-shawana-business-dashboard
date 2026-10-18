import type { ColumnDef } from '@tanstack/react-table';
import { CalendarPlus, Eye, Pencil, Smartphone, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { useListState } from '@/hooks/use-list-state';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate } from '@/lib/format';
import { ROLE_LABELS } from '@/features/staff/constants';
import { patientsApi, type Patient } from '@redux/features/patients';
import { PatientFormSheet } from './patient-form-sheet';

export function PatientsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const list = useListState({ defaultSort: '-createdAt' });
  const query = patientsApi.useList(list.query);
  const [remove] = patientsApi.useRemove();
  const [editing, setEditing] = useState<Patient | null>(null);
  const [open, setOpen] = useState(params.get('new') === '1');
  const [removing, setRemoving] = useState<Patient | null>(null);

  const openSheet = (patient: Patient | null) => {
    setEditing(patient);
    setOpen(true);
  };

  const closeSheet = (next: boolean) => {
    setOpen(next);
    if (!next && params.has('new')) {
      params.delete('new');
      setParams(params, { replace: true });
    }
  };

  const columns: ColumnDef<Patient, unknown>[] = [
    {
      id: 'name',
      header: 'Patient',
      accessorKey: 'name',
      meta: { sortKey: 'name', hideable: false },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-medium">{row.original.name}</div>
          <div className="text-xs text-muted-foreground tabular-nums">{row.original.phone}</div>
        </div>
      ),
    },
    {
      id: 'phone',
      header: 'Phone',
      accessorKey: 'phone',
      cell: ({ row }) => <span className="tabular-nums">{row.original.phone}</span>,
    },
    {
      id: 'city',
      header: 'City',
      accessorKey: 'city',
      meta: { sortKey: 'city' },
    },
    {
      id: 'age',
      header: 'Age',
      accessorKey: 'age',
      meta: { align: 'right' },
      cell: ({ row }) => row.original.age ?? '—',
    },
    {
      id: 'enteredBy',
      header: 'Entered by',
      accessorFn: (p) => p.enteredBy?.name ?? '',
      cell: ({ row }) =>
        row.original.enteredBy ? (
          <div className="min-w-0">
            <div className="font-medium">{row.original.enteredBy.name}</div>
            <div className="text-xs text-muted-foreground">
              {ROLE_LABELS[row.original.enteredBy.role as keyof typeof ROLE_LABELS] ??
                row.original.enteredBy.role}
              {row.original.enteredBy.branchName ? ` · ${row.original.enteredBy.branchName}` : ''}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'createdAt',
      header: 'Added',
      accessorKey: 'createdAt',
      meta: { sortKey: 'createdAt' },
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: 'appUpdatedAt',
      header: 'Edited in app',
      accessorFn: (p) => (p.appUpdatedAt ? formatDate(p.appUpdatedAt) : ''),
      cell: ({ row }) =>
        row.original.appUpdatedAt ? (
          <StatusBadge tone="info" dot={false}>
            <Smartphone className="size-3" />
            {formatDate(row.original.appUpdatedAt)}
          </StatusBadge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right', hideable: false },
      cell: ({ row }) => (
        <RowActions
          actions={[
            {
              label: 'Open profile',
              icon: Eye,
              onSelect: () => void navigate(`/patients/${row.original.id}`),
            },
            {
              label: 'Book appointment',
              icon: CalendarPlus,
              hidden: !can('appointments.create'),
              onSelect: () => void navigate(`/appointments?new=1&patientId=${row.original.id}`),
            },
            {
              label: 'Edit',
              icon: Pencil,
              hidden: !can('patients.update'),
              onSelect: () => openSheet(row.original),
            },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              separatorBefore: true,
              hidden: !can('patients.delete'),
              onSelect: () => setRemoving(row.original),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        description="Patients are shared by every branch. Search by phone first to avoid duplicates."
        actions={
          can('patients.create') ? (
            <Button onClick={() => openSheet(null)}>
              <UserPlus />
              New patient
            </Button>
          ) : null
        }
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
        searchPlaceholder="Phone or name"
        exportFileName="patients"
        onRowClick={(p) => void navigate(`/patients/${p.id}`)}
        emptyTitle="No patients yet"
        emptyDescription="Patients are added here or while booking an appointment."
        emptyAction={
          can('patients.create') ? (
            <Button size="sm" onClick={() => openSheet(null)}>
              <UserPlus />
              Add patient
            </Button>
          ) : null
        }
      />
      <PatientFormSheet
        patient={editing}
        open={open}
        onOpenChange={closeSheet}
        onSaved={(patient) => (editing ? undefined : void navigate(`/patients/${patient.id}`))}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete ${removing?.name ?? 'patient'}?`}
        description="The patient is hidden from searches. This is refused while they have appointments or sales."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? remove(removing.id)
                .unwrap()
                .then(() => toast.success('Patient deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
