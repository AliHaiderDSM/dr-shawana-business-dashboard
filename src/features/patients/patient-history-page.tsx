import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Combobox } from '@/components/shared/combobox';
import { DataTable } from '@/components/shared/data-table';
import { DateRangeFilter, FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { Panel } from '@/components/shared/panel';
import { StatusBadge } from '@/components/shared/status-badge';
import { MrsChart } from '@/features/clinical/mrs-chart';
import { useConsultationReport, type ConsultationReportRow } from '@redux/features/consultations';
import { doctorsApi } from '@redux/features/doctors';
import { useListState } from '@/hooks/use-list-state';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate } from '@/lib/format';
import { patientsApi, usePatientSearch } from '@redux/features/patients';
import { PatientTimelineView } from './patient-timeline';

type Row = ConsultationReportRow;

const STAGES: Record<string, string> = {
  perimenopause: 'Perimenopause',
  early_menopause: 'Early menopause',
  menopause: 'Menopause',
  late_menopause: 'Late menopause',
  postmenopause: 'Postmenopause',
  natural: 'Natural menopause',
  surgical: 'Surgical menopause',
  induced: 'Induced menopause',
  poi: 'POI',
};

const MRS_COLUMNS: [string, string][] = [
  ['hotFlushes', 'Hot flushes'],
  ['heartDiscomfort', 'Heart discomfort'],
  ['sleepProblems', 'Sleep problems'],
  ['jointMuscleDiscomfort', 'Joint and muscle discomfort'],
  ['depressiveMood', 'Depressive mood'],
  ['irritability', 'Irritability'],
  ['anxiety', 'Anxiety'],
  ['exhaustion', 'Physical and mental exhaustion'],
  ['sexualProblems', 'Sexual problems'],
  ['bladderProblems', 'Bladder problems'],
  ['vaginalDryness', 'Vaginal dryness'],
];

const dash = (value: unknown) =>
  value === null || value === undefined || value === '' ? '—' : String(value);
const list = (values: string[]) => (values.length ? values.join('; ') : '—');

const mrsItem = (key: string, label: string): ColumnDef<Row, unknown> => ({
  id: key,
  header: label,
  accessorFn: (r) => r.report.mrs?.[key] ?? '',
  cell: ({ row }) => <span className="tabular-nums">{dash(row.original.report.mrs?.[key])}</span>,
});

const score = (
  key: 'somatic' | 'psychological' | 'urogenital' | 'total',
  label: string,
): ColumnDef<Row, unknown> => ({
  id: `mrs-${key}`,
  header: label,
  accessorFn: (r) => r.report.mrsScores?.[key] ?? '',
  cell: ({ row }) => (
    <span className="font-semibold tabular-nums">{dash(row.original.report.mrsScores?.[key])}</span>
  ),
});

const treatment = (
  key: 'progesterone' | 'estradiolTreatment' | 'vaginal' | 'testosterone',
  label: string,
): ColumnDef<Row, unknown> => ({
  id: key,
  header: label,
  accessorFn: (r) => list(r.report[key]),
  cell: ({ row }) => (
    <span className="block min-w-48 text-xs whitespace-normal">{list(row.original.report[key])}</span>
  ),
});

const columns: ColumnDef<Row, unknown>[] = [
  {
    id: 'patient',
    header: 'Name / Phone',
    accessorFn: (c) => c.patient?.name ?? '',
    meta: { hideable: false },
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.patient?.name}</div>
        <div className="text-xs text-muted-foreground tabular-nums">{row.original.patient?.phone}</div>
      </div>
    ),
  },
  {
    id: 'age',
    header: 'Age',
    accessorFn: (r) => r.report.age ?? '',
    cell: ({ row }) => dash(row.original.report.age),
  },
  { id: 'city', header: 'City', accessorFn: (r) => r.report.city ?? '' },
  { id: 'country', header: 'Country', accessorFn: (r) => r.report.country ?? '' },
  {
    id: 'date',
    header: 'Date',
    accessorFn: (c) => c.appointment?.date ?? '',
    meta: { sortKey: 'date' },
    cell: ({ row }) => (
      <span className="whitespace-nowrap">{formatDate(row.original.appointment?.date)}</span>
    ),
  },
  { id: 'doctor', header: 'Doctor', accessorFn: (c) => c.doctor?.name ?? '' },
  {
    id: 'bmi',
    header: 'BMI',
    accessorFn: (r) => r.report.bmi ?? '',
    cell: ({ row }) => <span className="tabular-nums">{dash(row.original.report.bmi)}</span>,
  },
  {
    id: 'menopause',
    header: 'Menopause status',
    accessorFn: (r) =>
      list([...r.report.menopauseStage, ...r.report.menopauseType].map((v) => STAGES[v] ?? v)),
    cell: ({ row }) => (
      <span className="block min-w-40 whitespace-normal">
        {list(
          [...row.original.report.menopauseStage, ...row.original.report.menopauseType].map(
            (v) => STAGES[v] ?? v,
          ),
        )}
      </span>
    ),
  },
  {
    id: 'ageAtMenopause',
    header: 'Age at menopause',
    accessorFn: (r) => r.report.ageAtMenopause ?? '',
    cell: ({ row }) => dash(row.original.report.ageAtMenopause),
  },
  ...MRS_COLUMNS.slice(0, 4).map(([key, label]) => mrsItem(key, label)),
  score('somatic', 'Somatic MRS'),
  ...MRS_COLUMNS.slice(4, 8).map(([key, label]) => mrsItem(key, label)),
  score('psychological', 'Psychological MRS'),
  ...MRS_COLUMNS.slice(8).map(([key, label]) => mrsItem(key, label)),
  score('urogenital', 'Urogenital MRS'),
  score('total', 'Total MRS'),
  {
    id: 'fsh',
    header: 'FSH',
    accessorFn: (r) => r.report.fsh ?? '',
    cell: ({ row }) => dash(row.original.report.fsh),
  },
  {
    id: 'estradiol',
    header: 'Estradiol',
    accessorFn: (r) => r.report.estradiol ?? '',
    cell: ({ row }) => dash(row.original.report.estradiol),
  },
  {
    id: 'totalTestosterone',
    header: 'Total testosterone',
    accessorFn: (r) => r.report.totalTestosterone ?? '',
    cell: ({ row }) => dash(row.original.report.totalTestosterone),
  },
  treatment('progesterone', 'Progesterone treatment'),
  treatment('estradiolTreatment', 'Estradiol treatment'),
  treatment('vaginal', 'Vaginal treatment'),
  treatment('testosterone', 'Testosterone treatment'),
  {
    id: 'stillOnTreatment',
    header: 'Still on treatment',
    accessorFn: (r) =>
      r.report.stillOnTreatment === 'yes' ? 'Yes' : r.report.stillOnTreatment === 'no' ? 'No' : '',
    cell: ({ row }) =>
      row.original.report.stillOnTreatment === 'yes'
        ? 'Yes'
        : row.original.report.stillOnTreatment === 'no'
          ? 'No'
          : '—',
  },
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
  const { me } = useAuth();
  const [params, setParams] = useSearchParams();
  const patientId = params.get('patientId') ?? '';
  const patient = patientsApi.useDetail(patientId || undefined);
  const [search, setSearch] = useState('');
  const patients = usePatientSearch(search);
  const list = useListState({ defaultSort: '-date' });
  const listQuery = Object.fromEntries(Object.entries(list.query).filter(([key]) => key !== 'patientId'));
  const consultations = useConsultationReport(listQuery, !patientId);
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
        description="Every visit with BMI, menopause status, MRS, blood results and BHRT treatment, as in posSoft. Pick a patient for the full timeline."
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
          data={consultations.data?.data as Row[] | undefined}
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
