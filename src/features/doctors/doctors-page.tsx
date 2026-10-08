import type { ColumnDef } from '@tanstack/react-table';
import { CalendarDays, Pencil, Stethoscope, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CredentialsDialog, type SignInCredentials } from '@/components/shared/credentials-dialog';
import { DataTable } from '@/components/shared/data-table';
import { FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { StatusBadge } from '@/components/shared/status-badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useListState } from '@/hooks/use-list-state';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, initials } from '@/lib/format';
import { doctorsApi, type Doctor } from './api';
import { DoctorFormSheet } from './doctor-form-sheet';

export function DoctorsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const list = useListState({ defaultSort: 'displayName' });
  const query = doctorsApi.useList(list.query);
  const remove = doctorsApi.useRemove();
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [removing, setRemoving] = useState<Doctor | null>(null);
  const [credentials, setCredentials] = useState<SignInCredentials | null>(null);

  const openSheet = (doctor: Doctor | null) => {
    setEditing(doctor);
    setFormKey((k) => k + 1);
    setOpen(true);
  };

  const columns: ColumnDef<Doctor, unknown>[] = [
    {
      id: 'sr',
      header: 'Sr#',
      accessorFn: (_d, index) => (list.page - 1) * list.pageSize + index + 1,
      meta: { hideable: false },
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {(list.page - 1) * list.pageSize + row.index + 1}
        </span>
      ),
    },
    {
      id: 'displayName',
      header: 'Doctor',
      accessorKey: 'displayName',
      meta: { sortKey: 'displayName', hideable: false },
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary-soft text-xs text-primary-soft-foreground">
              {initials(row.original.displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="font-medium">{row.original.displayName}</div>
          </div>
        </div>
      ),
    },
    {
      id: 'phone',
      header: 'Phone',
      accessorKey: 'phone',
      cell: ({ row }) => row.original.phone ?? '—',
    },
    {
      id: 'email',
      header: 'Email',
      accessorFn: (d) => d.staff?.email ?? d.email ?? '',
      cell: ({ row }) => row.original.staff?.email ?? row.original.email ?? '—',
    },
    {
      id: 'username',
      header: 'Username',
      accessorFn: (d) => d.staff?.username ?? '',
      cell: ({ row }) =>
        row.original.staff?.username ? (
          <span className="font-mono text-sm">{row.original.staff.username}</span>
        ) : (
          '—'
        ),
    },
    {
      id: 'createdAt',
      header: 'Added on',
      accessorKey: 'createdAt',
      meta: { sortKey: 'createdAt' },
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right', hideable: false },
      cell: ({ row }) => (
        <RowActions
          actions={[
            {
              label: 'Appointments',
              icon: CalendarDays,
              hidden: !can('appointments.view'),
              onSelect: () => void navigate(`/appointments?doctorId=${row.original.id}`),
            },
            {
              label: 'Edit',
              icon: Pencil,
              hidden: !can('doctors.update'),
              onSelect: () => openSheet(row.original),
            },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              separatorBefore: true,
              hidden: !can('doctors.delete'),
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
        title="Doctors"
        description="Doctor profiles, fees and commission, each linked to a doctor sign-in."
        actions={
          can('doctors.create') ? (
            <Button onClick={() => openSheet(null)}>
              <UserPlus />
              New doctor
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
        searchPlaceholder="Search doctors"
        exportFileName="doctors"
        onRowClick={can('doctors.update') ? openSheet : undefined}
        emptyTitle="No doctors yet"
        emptyAction={
          can('doctors.create') ? (
            <Button size="sm" onClick={() => openSheet(null)}>
              <Stethoscope />
              Add doctor
            </Button>
          ) : null
        }
        toolbar={
          <FilterSelect
            list={list}
            name="status"
            allLabel="All statuses"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        }
      />
      <DoctorFormSheet
        key={formKey}
        doctor={editing}
        open={open}
        onOpenChange={setOpen}
        onCreated={(_, created) =>
          created ? setCredentials({ title: 'Doctor login created', ...created }) : undefined
        }
      />
      <CredentialsDialog value={credentials} onClose={() => setCredentials(null)} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete ${removing?.displayName ?? 'doctor'}?`}
        description="This is refused while the doctor has appointments. Their sign-in stays; deactivate it under Employees."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? remove
                .mutateAsync(removing.id)
                .then(() => toast.success('Doctor deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
