import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileHeart,
  History,
  Loader2,
  Printer,
  RotateCcw,
  Stethoscope,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Panel } from '@/components/shared/panel';
import { DetailSkeleton } from '@/components/shared/skeletons';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import {
  appointmentsApi,
  MODE_LABELS,
  timeRange,
  VISIT_LABELS,
  type AppointmentDetail,
} from '@/features/appointments/api';
import { StatusDialog, type StatusChange } from '@/features/appointments/status-dialog';
import { BloodWorkPanel } from '@/features/clinical/blood-work-panel';
import { MedicalRecordsPanel } from '@/features/clinical/medical-records-panel';
import { MrsChart } from '@/features/clinical/mrs-chart';
import { patientsApi, usePatientSummary } from '@/features/patients/api';
import { BhrtBadge } from '@/features/patients/bhrt-badge';
import { ConsultationPrescriptions } from '@/features/prescriptions/consultation-prescriptions';
import { PreviousSymptomsContext } from './symptoms-field';
import { VisitHistory } from './visit-history';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, isoDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  consultationKeys,
  useAppointmentConsultation,
  useConsultationHistory,
  useConsultationStatus,
  useStartConsultation,
  type Consultation,
  type SectionKey,
} from './api';
import { SECTIONS, type FormValues } from './clinical-fields';
import { SectionForm } from './section-form';

type PanelKey = SectionKey | 'records' | 'clinical' | 'prescriptions';

interface NavItem {
  key: PanelKey;
  label: string;
  done?: boolean;
}

function navItems(consultation: Consultation, canPrescribe: boolean): NavItem[] {
  const has = (key: SectionKey) => consultation.availableSections.includes(key);
  const saved = (key: SectionKey) => Boolean(consultation.sections[key]);
  const items: (NavItem | false)[] = [
    { key: 'basic_info', label: 'Basic information', done: saved('basic_info') },
    has('follow_up') && { key: 'follow_up', label: 'Follow up form', done: saved('follow_up') },
    { key: 'medical_history', label: 'Medical history', done: saved('medical_history') },
    { key: 'mrs_scale', label: 'MRS scale', done: saved('mrs_scale') },
    { key: 'additional_symptoms', label: 'Additional symptoms', done: saved('additional_symptoms') },
    { key: 'records', label: 'Medical records', done: saved('imaging_results') },
    { key: 'clinical', label: 'Clinical remarks', done: saved('clinical_assessment') },
    has('referral') && { key: 'referral', label: 'Referred to specialist', done: saved('referral') },
    canPrescribe && { key: 'prescriptions', label: 'Prescription' },
    { key: 'plans', label: 'Educational resources', done: saved('plans') },
  ];
  return items.filter((item): item is NavItem => Boolean(item));
}

function PatientHeader({
  consultation,
  appointment,
  lastVisit,
}: {
  consultation: Consultation;
  appointment: AppointmentDetail | undefined;
  lastVisit: string | null | undefined;
}) {
  const { can } = useAuth();
  const status = useConsultationStatus(consultation);
  const patient = consultation.patient;
  const completed = consultation.status === 'completed';
  return (
    <div className="sticky top-topbar z-20 -mx-4 mb-6 border-b bg-background/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              <Link to={`/patients/${consultation.patientId}`} className="hover:underline">
                {patient?.name}
              </Link>
            </h1>
            <BhrtBadge status={patient?.bhrtStatus ?? 'none'} />
            <StatusBadge status={consultation.status} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{patient?.age ? `${patient.age} years` : 'Age not set'}</span>
            <span className="tabular-nums">{patient?.phone}</span>
            <span>{patient?.city}</span>
            <span>Last visit {lastVisit ? formatDate(lastVisit) : '—'}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Appointment #{consultation.appointment?.appointmentNo} ·{' '}
            {formatDate(consultation.appointment?.date)}
            {appointment ? ` · ${timeRange(appointment.timeFrom, appointment.timeTo)}` : ''} ·{' '}
            {consultation.appointment
              ? VISIT_LABELS[consultation.appointment.visitType as 'new' | 'followup']
              : ''}{' '}
            ·{' '}
            {consultation.appointment
              ? MODE_LABELS[consultation.appointment.mode as 'online' | 'physical']
              : ''}{' '}
            · {consultation.doctor?.name}
          </div>
        </div>
        {can('consultations.update') ? (
          <Button
            variant={completed ? 'outline' : 'default'}
            disabled={status.isPending}
            onClick={() =>
              status
                .mutateAsync(completed ? 'open' : 'completed')
                .then(() => toast.success(completed ? 'Consultation reopened' : 'Consultation completed'))
                .catch(toastError)
            }
          >
            {status.isPending ? (
              <Loader2 className="animate-spin" />
            ) : completed ? (
              <RotateCcw />
            ) : (
              <ClipboardCheck />
            )}
            {completed ? 'Reopen consultation' : 'Mark consultation complete'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ClinicalRemarks({
  consultation,
  appointment,
  readOnly,
  onDirtyChange,
  onSaved,
}: {
  consultation: Consultation;
  appointment: AppointmentDetail | undefined;
  readOnly: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
}) {
  const { can } = useAuth();
  const [change, setChange] = useState<StatusChange | null>(null);
  return (
    <div className="space-y-6">
      {appointment ? (
        <Panel
          title="Appointment status and remark"
          actions={
            can('appointments.update') ? (
              <>
                {appointment.status === 'booked' ? (
                  <Button size="sm" onClick={() => setChange({ appointment, status: 'completed' })}>
                    <CalendarCheck />
                    Complete with remark
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setChange({ appointment, status: appointment.status })}
                  >
                    Edit remark
                  </Button>
                )}
              </>
            ) : null
          }
        >
          <div className="flex items-center gap-3 text-sm">
            <StatusBadge status={appointment.status} />
            <span className="text-muted-foreground">
              {appointment.attachments.length} remark screenshot
              {appointment.attachments.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="mt-3 text-sm whitespace-pre-wrap">
            {appointment.remark ?? <span className="text-muted-foreground">No remark yet.</span>}
          </p>
        </Panel>
      ) : null}
      <SectionForm
        consultation={consultation}
        section={SECTIONS.clinical_assessment}
        state={consultation.sections.clinical_assessment}
        readOnly={readOnly}
        onDirtyChange={onDirtyChange}
        onSaved={onSaved}
      />
      <StatusDialog change={change} onClose={() => setChange(null)} />
    </div>
  );
}

function Workspace({
  consultation,
  appointment,
}: {
  consultation: Consultation;
  appointment?: AppointmentDetail;
}) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const summary = usePatientSummary(consultation.patientId);
  const history = useConsultationHistory(consultation.id);
  const patient = patientsApi.useDetail(consultation.patientId);
  const canPrescribe = can('prescriptions.view');
  const items = navItems(consultation, canPrescribe);
  const requested = params.get('section') as PanelKey | null;
  const active = items.find((i) => i.key === requested)?.key ?? 'basic_info';
  const readOnly = !can('consultations.update');
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<PanelKey | null>(null);
  const onDirtyChange = useCallback((value: boolean) => setDirty(value), []);
  const queryClient = useQueryClient();

  const go = (key: PanelKey) => {
    setDirty(false);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('section', key);
        return next;
      },
      { replace: true },
    );
  };

  const advance = (from: PanelKey) => {
    const fresh =
      queryClient.getQueryData<Consultation | null>(
        consultationKeys.byAppointment(consultation.appointmentId),
      ) ?? consultation;
    const list = navItems(fresh, canPrescribe);
    const next = list[list.findIndex((i) => i.key === from) + 1];
    if (next) go(next.key);
  };

  const select = (key: PanelKey) => {
    if (key === active) return;
    if (dirty) setPending(key);
    else go(key);
  };

  const defaults: Partial<Record<SectionKey, FormValues>> = {
    basic_info: patient.data
      ? {
          name: patient.data.name,
          age: patient.data.age,
          city: patient.data.city,
          country: patient.data.country,
        }
      : {},
    mrs_scale: { date: isoDate() },
    referral: {
      name: patient.data?.name,
      date: isoDate(),
      referringDoctorName: consultation.doctor?.name,
      dateOfBirth: patient.data?.dateOfBirth,
    },
  };

  const sectionPanel = (key: SectionKey) => (
    <SectionForm
      key={`${key}-${patient.isSuccess}`}
      consultation={consultation}
      section={SECTIONS[key]}
      state={consultation.sections[key]}
      defaults={defaults[key]}
      readOnly={readOnly}
      onDirtyChange={onDirtyChange}
      onSaved={() => advance(key === 'imaging_results' ? 'records' : key)}
      aside={
        key === 'mrs_scale' ? (
          <Panel title="MRS history" description="Scores are calculated by the server on every save.">
            <MrsScores consultation={consultation} />
            <MrsChart patientId={consultation.patientId} />
          </Panel>
        ) : undefined
      }
      footer={
        key === 'referral'
          ? (saved) =>
              saved ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void navigate(`/print/referral/${consultation.id}`)}
                >
                  <Printer />
                  Print letter
                </Button>
              ) : null
          : undefined
      }
    />
  );

  const content = (() => {
    switch (active) {
      case 'records':
        return (
          <div className="space-y-6">
            <MedicalRecordsPanel
              patientId={consultation.patientId}
              appointmentId={consultation.appointmentId}
              canEdit={can('consultations.create') || can('consultations.update')}
            />
            <BloodWorkPanel
              patientId={consultation.patientId}
              consultationId={consultation.id}
              canEdit={can('consultations.create') || can('consultations.update')}
            />
            <div className="rounded-xl border bg-card p-6 shadow-xs">{sectionPanel('imaging_results')}</div>
          </div>
        );
      case 'clinical':
        return (
          <ClinicalRemarks
            consultation={consultation}
            appointment={appointment}
            readOnly={readOnly}
            onDirtyChange={onDirtyChange}
            onSaved={() => advance('clinical')}
          />
        );
      case 'prescriptions':
        return <ConsultationPrescriptions consultation={consultation} />;
      case 'basic_info':
        return (
          <div className="space-y-6">
            <div className="rounded-xl border bg-card p-6 shadow-xs">{sectionPanel('basic_info')}</div>
            <VisitHistory
              history={history.data}
              loading={history.isLoading}
              patientName={patient.data?.name ?? consultation.patient?.name ?? 'Patient'}
            />
          </div>
        );
      default:
        return <div className="rounded-xl border bg-card p-6 shadow-xs">{sectionPanel(active)}</div>;
    }
  })();

  return (
    <>
      <PatientHeader
        consultation={consultation}
        appointment={appointment}
        lastVisit={summary.data?.appointments.lastVisit}
      />
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav
          aria-label="Consultation sections"
          className="lg:sticky lg:top-[calc(var(--topbar-height)+8.5rem)] lg:self-start"
        >
          <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {items.map((item) => (
              <li key={item.key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => select(item.key)}
                  aria-current={item.key === active ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors',
                    item.key === active
                      ? 'bg-primary-soft font-medium text-primary-soft-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {item.done === undefined ? (
                    item.key === 'prescriptions' ? (
                      <FileHeart className="size-4" />
                    ) : (
                      <History className="size-4" />
                    )
                  ) : item.done ? (
                    <CheckCircle2 className="size-4 text-success" />
                  ) : (
                    <Circle className="size-4" />
                  )}
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <PreviousSymptomsContext.Provider value={history.data?.previousSymptoms ?? null}>
            {content}
          </PreviousSymptomsContext.Provider>
        </div>
      </div>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Leave without saving?"
        description="This section has changes that are not saved yet."
        confirmLabel="Discard changes"
        destructive
        onConfirm={() => {
          if (pending) go(pending);
          setPending(null);
        }}
      />
    </>
  );
}

function MrsScores({ consultation }: { consultation: Consultation }) {
  const scores = consultation.sections.mrs_scale?.scores;
  if (!scores) return null;
  const items = [
    { label: 'Somatic', value: `${scores.somatic} / 16` },
    { label: 'Psychological', value: `${scores.psychological} / 16` },
    { label: 'Urogenital', value: `${scores.urogenital} / 12` },
    { label: 'Total', value: `${scores.total} / 44 (${Math.round(scores.percentage)}%)` },
  ];
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border px-3 py-2">
          <div className="text-xs text-muted-foreground">{item.label}</div>
          <div className="text-sm font-semibold tabular-nums">{item.value}</div>
        </div>
      ))}
      <StatusBadge
        tone={
          scores.severity === 'severe'
            ? 'danger'
            : scores.severity === 'moderate'
              ? 'warning'
              : scores.severity === 'mild'
                ? 'info'
                : 'success'
        }
      >
        {scores.severity}
      </StatusBadge>
    </div>
  );
}

export function ConsultationPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const appointment = appointmentsApi.useDetail(id);
  const consultation = useAppointmentConsultation(id);
  const start = useStartConsultation(id);

  if (consultation.isLoading) return <DetailSkeleton />;
  if (consultation.error)
    return <ErrorState error={consultation.error} onRetry={() => void consultation.refetch()} />;

  if (!consultation.data)
    return (
      <>
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
          <Link to={`/appointments/${id}`}>
            <ArrowLeft />
            Appointment
          </Link>
        </Button>
        <div className="rounded-xl border bg-card shadow-xs">
          <EmptyState
            icon={Stethoscope}
            title={
              appointment.data
                ? `Start the consultation for ${appointment.data.patient?.name ?? 'this patient'}`
                : 'Start the consultation'
            }
            description="The consultation holds the intake form, MRS scale, clinical remarks and prescriptions for this visit."
            action={
              can('consultations.create') ? (
                <Button
                  disabled={start.isPending}
                  onClick={() =>
                    start
                      .mutateAsync()
                      .then(() => toast.success('Consultation started'))
                      .catch(toastError)
                  }
                >
                  {start.isPending ? <Loader2 className="animate-spin" /> : <Stethoscope />}
                  Start consultation
                </Button>
              ) : null
            }
          />
        </div>
      </>
    );

  return <Workspace consultation={consultation.data} appointment={appointment.data} />;
}
