import type { ColumnDef } from '@tanstack/react-table';
import { FilePlus2, Pencil, Printer, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { DateRangeFilter, FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { doctorsApi } from '@/features/doctors/api';
import { useListState } from '@/hooks/use-list-state';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate } from '@/lib/format';
import { prescriptionsApi, type Prescription } from './api';

export function PrescriptionsPage() {
  const navigate = useNavigate();
  const { me, can } = useAuth();
  const list = useListState({ defaultSort: '-date' });
  const query = prescriptionsApi.useList(list.query);
  const doctors = doctorsApi.useOptions();
  const remove = prescriptionsApi.useRemove();
  const [removing, setRemoving] = useState<Prescription | null>(null);

  const columns: ColumnDef<Prescription, unknown>[] = [
    {
      id: 'prescriptionNo',
      header: 'No',
      accessorKey: 'prescriptionNo',
      meta: { sortKey: 'prescriptionNo' },
      cell: ({ row }) => (
        <span className="font-medium text-muted-foreground">#{row.original.prescriptionNo}</span>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      accessorKey: 'date',
      meta: { sortKey: 'date' },
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      id: 'patient',
      header: 'Patient',
      accessorFn: (p) => p.patient?.name ?? '',
      meta: { hideable: false },
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.patient?.name}</div>
          <div className="text-xs text-muted-foreground tabular-nums">{row.original.patient?.phone}</div>
        </div>
      ),
    },
    {
      id: 'doctor',
      header: 'Doctor',
      accessorFn: (p) => p.doctor?.name ?? '',
      cell: ({ row }) => row.original.doctor?.name ?? '—',
    },
    {
      id: 'diagnosis',
      header: 'Diagnosis',
      accessorKey: 'diagnosis',
      cell: ({ row }) => <span className="line-clamp-1 max-w-72">{row.original.diagnosis}</span>,
    },
    {
      id: 'items',
      header: 'Items',
      accessorFn: (p) => p.items.length,
      meta: { align: 'right' },
    },
    {
      id: 'followupDate',
      header: 'Follow up',
      accessorKey: 'followupDate',
      cell: ({ row }) => formatDate(row.original.followupDate),
    },
    {
      id: 'template',
      header: 'Template',
      accessorKey: 'templateVersion',
      cell: ({ row }) =>
        row.original.templateVersion === 'previous' ? (
          <StatusBadge tone="neutral">Previous</StatusBadge>
        ) : (
          <StatusBadge tone="primary">Current</StatusBadge>
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
              label: 'Print',
              icon: Printer,
              onSelect: () => void navigate(`/print/prescription/${row.original.id}`),
            },
            {
              label: 'Edit',
              icon: Pencil,
              hidden: !can('prescriptions.update') || row.original.templateVersion === 'previous',
              onSelect: () => void navigate(`/prescriptions/${row.original.id}/edit`),
            },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              separatorBefore: true,
              hidden: !can('prescriptions.delete'),
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
        title="Prescriptions"
        description="Every prescription in this branch. Write new ones from a consultation or here."
        actions={
          can('prescriptions.create') ? (
            <Button onClick={() => void navigate('/prescriptions/new')}>
              <FilePlus2 />
              New prescription
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
        searchPlaceholder="Patient, phone or diagnosis"
        exportFileName="prescriptions"
        onRowClick={(p) => void navigate(`/print/prescription/${p.id}`)}
        emptyTitle="No prescriptions yet"
        toolbar={
          <>
            <DateRangeFilter list={list} />
            {me?.role === 'doctor' ? null : (
              <FilterSelect
                list={list}
                name="doctorId"
                allLabel="All doctors"
                className="w-44"
                options={(doctors.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
              />
            )}
            <FilterSelect
              list={list}
              name="templateVersion"
              allLabel="All templates"
              options={[
                { value: 'current', label: 'Current' },
                { value: 'previous', label: 'Previous' },
              ]}
            />
          </>
        }
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete prescription #${removing?.prescriptionNo ?? ''}?`}
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? remove
                .mutateAsync(removing.id)
                .then(() => toast.success('Prescription deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
