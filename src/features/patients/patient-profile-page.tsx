import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, CalendarPlus, FilePlus2, Pencil, Receipt } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { DetailList, Panel } from '@/components/shared/panel';
import { DetailSkeleton } from '@/components/shared/skeletons';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { timeRange, useAppointmentList, type Appointment } from '@/features/appointments/api';
import { BhrtPanel } from '@/features/clinical/bhrt-panel';
import { BloodWorkPanel } from '@/features/clinical/blood-work-panel';
import { MedicalRecordsPanel } from '@/features/clinical/medical-records-panel';
import { MrsChart } from '@/features/clinical/mrs-chart';
import { prescriptionsApi, type Prescription } from '@/features/prescriptions/api';
import { SALE_TYPE_LABELS, useSales, type SaleListItem } from '@/features/sales/api';
import { useListState } from '@/hooks/use-list-state';
import { useAuth } from '@/lib/auth/auth-context';
import { formatCount, formatDate, formatMoney } from '@/lib/format';
import { patientsApi, usePatientSummary } from './api';
import { BhrtBadge } from './bhrt-badge';
import { PatientFormSheet } from './patient-form-sheet';
import { PatientTimelineView } from './patient-timeline';

const appointmentColumns: ColumnDef<Appointment, unknown>[] = [
  {
    id: 'appointmentNo',
    header: 'No',
    accessorKey: 'appointmentNo',
    cell: ({ row }) => <span className="text-muted-foreground">#{row.original.appointmentNo}</span>,
  },
  {
    id: 'date',
    header: 'Date',
    accessorKey: 'date',
    meta: { sortKey: 'date' },
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{formatDate(row.original.date)}</div>
        <div className="text-xs text-muted-foreground">
          {timeRange(row.original.timeFrom, row.original.timeTo)}
        </div>
      </div>
    ),
  },
  { id: 'doctor', header: 'Doctor', accessorFn: (a) => a.doctor?.name ?? '' },
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
];

const prescriptionColumns: ColumnDef<Prescription, unknown>[] = [
  {
    id: 'prescriptionNo',
    header: 'No',
    accessorKey: 'prescriptionNo',
    cell: ({ row }) => <span className="text-muted-foreground">#{row.original.prescriptionNo}</span>,
  },
  { id: 'date', header: 'Date', accessorKey: 'date', cell: ({ row }) => formatDate(row.original.date) },
  { id: 'doctor', header: 'Doctor', accessorFn: (p) => p.doctor?.name ?? '' },
  {
    id: 'diagnosis',
    header: 'Diagnosis',
    accessorKey: 'diagnosis',
    cell: ({ row }) => <span className="line-clamp-1 max-w-80">{row.original.diagnosis}</span>,
  },
  { id: 'items', header: 'Items', accessorFn: (p) => p.items.length, meta: { align: 'right' } },
];

function AppointmentsTab({ patientId }: { patientId: string }) {
  const navigate = useNavigate();
  const list = useListState({ prefix: 'a_', defaultSort: '-date', pageSize: 10 });
  const query = useAppointmentList({ ...list.query, patientId });
  return (
    <DataTable
      columns={appointmentColumns}
      data={query.data?.data}
      meta={query.data?.meta}
      list={list}
      isLoading={query.isLoading}
      isFetching={query.isFetching}
      error={query.error}
      onRetry={() => void query.refetch()}
      searchPlaceholder="Search appointments"
      onRowClick={(a) => void navigate(`/appointments/${a.id}`)}
      emptyTitle="No appointments yet"
    />
  );
}

const saleColumns: ColumnDef<SaleListItem, unknown>[] = [
  {
    id: 'invoiceNo',
    header: 'Invoice',
    accessorKey: 'invoiceNo',
    cell: ({ row }) => <span className="font-medium">{row.original.invoiceNo}</span>,
  },
  { id: 'date', header: 'Date', accessorKey: 'date', cell: ({ row }) => formatDate(row.original.date) },
  { id: 'type', header: 'Type', accessorFn: (s) => SALE_TYPE_LABELS[s.saleType] },
  {
    id: 'total',
    header: 'Total',
    accessorKey: 'total',
    meta: { align: 'right' },
    cell: ({ row }) => formatMoney(row.original.total),
  },
  {
    id: 'status',
    header: 'Payment',
    accessorKey: 'paymentStatus',
    cell: ({ row }) => <StatusBadge status={row.original.paymentStatus} />,
  },
];

function SalesTab({ patientId }: { patientId: string }) {
  const navigate = useNavigate();
  const list = useListState({ prefix: 's_', defaultSort: '-invoiceSeq', pageSize: 10 });
  const query = useSales({ ...list.query, patientId });
  return (
    <DataTable
      columns={saleColumns}
      data={query.data?.data}
      meta={query.data?.meta}
      list={list}
      isLoading={query.isLoading}
      isFetching={query.isFetching}
      error={query.error}
      onRetry={() => void query.refetch()}
      searchPlaceholder="Search invoice"
      onRowClick={(s) => void navigate(`/sales/${s.id}`)}
      emptyTitle="No sales yet"
    />
  );
}

function PrescriptionsTab({ patientId }: { patientId: string }) {
  const navigate = useNavigate();
  const list = useListState({ prefix: 'p_', defaultSort: '-date', pageSize: 10 });
  const query = prescriptionsApi.useList({ ...list.query, patientId });
  return (
    <DataTable
      columns={prescriptionColumns}
      data={query.data?.data}
      meta={query.data?.meta}
      list={list}
      isLoading={query.isLoading}
      isFetching={query.isFetching}
      error={query.error}
      onRetry={() => void query.refetch()}
      searchPlaceholder="Search prescriptions"
      onRowClick={(p) => void navigate(`/print/prescription/${p.id}`)}
      emptyTitle="No prescriptions yet"
    />
  );
}

export function PatientProfilePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const patient = patientsApi.useDetail(id);
  const summary = usePatientSummary(id);
  const [editOpen, setEditOpen] = useState(false);
  const clinical = can('consultations.view');
  const canEditClinical = can('consultations.create') || can('consultations.update');

  if (patient.isLoading) return <DetailSkeleton />;
  if (patient.error || !patient.data)
    return <ErrorState error={patient.error} onRetry={() => void patient.refetch()} />;
  const p = patient.data;
  const s = summary.data;
  const tab = params.get('tab') ?? 'appointments';

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
        <Link to="/patients">
          <ArrowLeft />
          Customers
        </Link>
      </Button>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {p.name}
            <BhrtBadge status={p.bhrtStatus} />
          </span>
        }
        description={[p.phone, p.city, p.age ? `${p.age} years` : null].filter(Boolean).join(' · ')}
        actions={
          <>
            {can('patients.update') ? (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil />
                Edit
              </Button>
            ) : null}
            {can('prescriptions.create') ? (
              <Button variant="outline" onClick={() => void navigate('/prescriptions/new')}>
                <FilePlus2 />
                Prescription
              </Button>
            ) : null}
            {can('appointments.create') ? (
              <Button onClick={() => void navigate(`/appointments?new=1&patientId=${p.id}`)}>
                <CalendarPlus />
                Book appointment
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Appointments"
          value={s ? formatCount(s.appointments.total) : '…'}
          hint={
            s ? `${s.appointments.completed} completed · ${s.appointments.cancelled} cancelled` : undefined
          }
        />
        <StatCard
          label="Last visit"
          value={s?.appointments.lastVisit ? formatDate(s.appointments.lastVisit) : '—'}
        />
        <StatCard
          label="Next appointment"
          value={s?.appointments.nextAppointment ? formatDate(s.appointments.nextAppointment.date) : '—'}
          hint={s?.appointments.nextAppointment?.doctor?.name}
        />
        <StatCard label="Paid for appointments" value={s ? formatMoney(s.payments.totalReceived) : '…'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <Panel title="Details" className="self-start">
          <DetailList
            items={[
              { label: 'Phone', value: p.phone },
              { label: 'City', value: p.city },
              { label: 'Country', value: p.country },
              { label: 'Age', value: p.age },
              { label: 'Date of birth', value: p.dateOfBirth ? formatDate(p.dateOfBirth) : null },
              { label: 'Patient since', value: formatDate(p.createdAt) },
            ]}
          />
          {p.address ? <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">{p.address}</p> : null}
        </Panel>

        <Tabs
          value={tab}
          onValueChange={(value) =>
            setParams(
              (current) => {
                const next = new URLSearchParams(current);
                next.set('tab', value);
                return next;
              },
              { replace: true },
            )
          }
          className="min-w-0"
        >
          <TabsList className="flex h-auto w-full flex-wrap justify-start">
            <TabsTrigger value="appointments">Appointments</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            {clinical ? <TabsTrigger value="history">History</TabsTrigger> : null}
            {can('prescriptions.view') ? (
              <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
            ) : null}
            {clinical ? <TabsTrigger value="records">Medical records</TabsTrigger> : null}
            {clinical ? <TabsTrigger value="bhrt">BHRT</TabsTrigger> : null}
          </TabsList>
          <TabsContent value="appointments" className="mt-4">
            <AppointmentsTab patientId={p.id} />
          </TabsContent>
          <TabsContent value="sales" className="mt-4">
            {can('sales.view') ? (
              <SalesTab patientId={p.id} />
            ) : (
              <div className="rounded-xl border bg-card">
                <EmptyState icon={Receipt} title="Sales" description="Your role cannot see sales." />
              </div>
            )}
          </TabsContent>
          {clinical ? (
            <TabsContent value="history" className="mt-4">
              <PatientTimelineView patientId={p.id} />
            </TabsContent>
          ) : null}
          {can('prescriptions.view') ? (
            <TabsContent value="prescriptions" className="mt-4">
              <PrescriptionsTab patientId={p.id} />
            </TabsContent>
          ) : null}
          {clinical ? (
            <TabsContent value="records" className="mt-4 space-y-6">
              <MedicalRecordsPanel patientId={p.id} canEdit={canEditClinical} />
              <BloodWorkPanel patientId={p.id} canEdit={canEditClinical} />
            </TabsContent>
          ) : null}
          {clinical ? (
            <TabsContent value="bhrt" className="mt-4 space-y-6">
              <BhrtPanel patientId={p.id} canEdit={canEditClinical} />
              <Panel title="MRS history">
                <MrsChart patientId={p.id} />
              </Panel>
            </TabsContent>
          ) : null}
        </Tabs>
      </div>

      <PatientFormSheet patient={p} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
