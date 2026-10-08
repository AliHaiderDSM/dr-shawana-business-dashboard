import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Combobox } from '@/components/shared/combobox';
import { DataTable } from '@/components/shared/data-table';
import { DateRangeFilter, FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { Panel } from '@/components/shared/panel';
import { StatusBadge } from '@/components/shared/status-badge';
import { MrsChart } from '@/features/clinical/mrs-chart';
import { useConsultationList, type ConsultationSummary } from '@/features/consultations/api';
import { doctorsApi } from '@/features/doctors/api';
import { useListState } from '@/hooks/use-list-state';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate } from '@/lib/format';
import { patientsApi, usePatientSearch } from './api';
import { PatientTimelineView } from './patient-timeline';

const columns: ColumnDef<ConsultationSummary, unknown>[] = [
  {
    id: 'date',
    header: 'Date',
    accessorFn: (c) => c.appointment?.date ?? '',
    meta: { sortKey: 'date' },
    cell: ({ row }) => formatDate(row.original.appointment?.date),
  },
  {
    id: 'patient',
    header: 'Patient',
    accessorFn: (c) => c.patient?.name ?? '',
    meta: { hideable: false },
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.patient?.name}</div>
        <div className="text-xs text-muted-foreground tabular-nums">{row.original.patient?.phone}</div>
      </div>
    ),
  },
  { id: 'doctor', header: 'Doctor', accessorFn: (c) => c.doctor?.name ?? '' },
  {
    id: 'appointment',
    header: 'Appointment',
    accessorFn: (c) => c.appointment?.appointmentNo ?? '',
    cell: ({ row }) => `#${row.original.appointment?.appointmentNo ?? ''}`,
  },
  {
    id: 'status',
    header: 'Status',
    accessorKey: 'status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

export function PatientHistoryPage() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const [params, setParams] = useSearchParams();
  const patientId = params.get('patientId') ?? '';
  const patient = patientsApi.useDetail(patientId || undefined);
  const [search, setSearch] = useState('');
  const patients = usePatientSearch(search);
  const list = useListState({ defaultSort: '-date' });
  const listQuery = Object.fromEntries(Object.entries(list.query).filter(([key]) => key !== 'patientId'));
  const consultations = useConsultationList(listQuery, !patientId);
  const doctors = doctorsApi.useOptions();

  const choose = (value: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set('patientId', value);
        else next.delete('patientId');
        return next;
      },
      { replace: true },
    );

  return (
    <>
      <PageHeader
        title="Patient history"
        description="Every visit, prescription, result and BHRT change of a patient, newest first."
        actions={
          <Combobox
            className="w-72"
            value={patientId || null}
            onChange={(value) => choose(value)}
            selectedLabel={patient.data ? `${patient.data.name} · ${patient.data.phone}` : null}
            onSearchChange={setSearch}
            loading={patients.isFetching && !patients.data}
            clearable
            placeholder="Find a patient by phone or name"
            options={(patients.data ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.phone }))}
          />
        }
      />
      {patientId ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <PatientTimelineView patientId={patientId} />
          <Panel title="MRS trend" className="self-start">
            <MrsChart patientId={patientId} />
          </Panel>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={consultations.data?.data as ConsultationSummary[] | undefined}
          meta={consultations.data?.meta}
          list={list}
          isLoading={consultations.isLoading}
          isFetching={consultations.isFetching}
          error={consultations.error}
          onRetry={() => void consultations.refetch()}
          searchPlaceholder="Patient or phone"
          exportFileName="consultations"
          onRowClick={(c) => choose(c.patientId)}
          emptyTitle="No consultations yet"
          emptyDescription="Consultations started from appointments appear here."
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
                name="status"
                allLabel="All statuses"
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'completed', label: 'Completed' },
                ]}
              />
            </>
          }
        />
      )}
    </>
  );
}
