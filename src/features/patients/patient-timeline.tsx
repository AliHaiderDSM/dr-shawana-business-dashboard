import {
  Activity,
  FileHeart,
  FlaskConical,
  FolderOpen,
  Printer,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { AttachmentList } from '@/components/shared/attachment-list';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BHRT_STATUS_LABELS,
  BLOOD_TEST_LABELS,
  RECORD_TYPE_LABELS,
  usePatientTimeline,
  type PatientTimeline,
} from '@/features/clinical/api';
import { SECTIONS } from '@/features/consultations/clinical-fields';
import { CATEGORY_LABELS } from '@/features/prescriptions/api';
import { formatDate, formatQuantity, titleCase } from '@/lib/format';
import { patientRecordFileUrl } from './api';

interface TimelineEvent {
  id: string;
  date: string;
  icon: LucideIcon;
  title: ReactNode;
  meta?: string | null;
  body?: ReactNode;
  action?: ReactNode;
}

function optionLabel(sectionKey: keyof typeof SECTIONS, fieldKey: string, value: string) {
  const field = SECTIONS[sectionKey].fields.find((f) => f.key === fieldKey);
  if (field && field.kind === 'checks')
    for (const group of field.groups) {
      const match = group.options.find(([v]) => v === value);
      if (match) return match[1];
    }
  return titleCase(value);
}

function Chips({ values }: { values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span key={value} className="rounded-md bg-muted px-2 py-0.5 text-xs">
          {value}
        </span>
      ))}
    </div>
  );
}

function buildEvents(timeline: PatientTimeline): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const c of timeline.consultations) {
    const basic = c.sections.basic_info?.data as Record<string, unknown> | undefined;
    const assessment = c.sections.clinical_assessment?.data as
      Record<string, string[] | string | null> | undefined;
    const scores = c.sections.mrs_scale?.scores;
    const facts = [
      basic?.weightKg ? `${String(basic.weightKg)} kg` : null,
      basic?.bmi
        ? `BMI ${String(basic.bmi)}${basic.bmiCategory ? ` (${titleCase(String(basic.bmiCategory))})` : ''}`
        : null,
      scores ? `MRS ${scores.total}/44 · ${scores.severity}` : null,
    ].filter(Boolean);
    const stage = Array.isArray(assessment?.menopauseStage)
      ? assessment.menopauseStage.map((v) => optionLabel('clinical_assessment', 'menopauseStage', v))
      : [];
    const plan = Array.isArray(assessment?.treatmentPlan)
      ? assessment.treatmentPlan.map((v) => optionLabel('clinical_assessment', 'treatmentPlan', v))
      : [];
    events.push({
      id: `c-${c.id}`,
      date: c.appointment?.date ?? c.createdAt,
      icon: Stethoscope,
      title: (
        <span className="flex items-center gap-2">
          Consultation #{c.appointment?.appointmentNo}
          <StatusBadge status={c.status} />
        </span>
      ),
      meta: c.doctor?.name,
      body:
        facts.length || stage.length || plan.length ? (
          <div className="space-y-2">
            {facts.length ? <p className="text-sm">{facts.join(' · ')}</p> : null}
            <Chips values={[...stage, ...plan]} />
          </div>
        ) : null,
      action: (
        <Button asChild variant="ghost" size="sm">
          <Link to={`/appointments/${c.appointmentId}/consultation`}>Open</Link>
        </Button>
      ),
    });
  }

  for (const p of timeline.prescriptions) {
    const categories = [...new Set(p.items.map((i) => CATEGORY_LABELS[i.category]))];
    events.push({
      id: `p-${p.id}`,
      date: p.date,
      icon: FileHeart,
      title: `Prescription #${p.prescriptionNo}`,
      meta: p.doctor?.name,
      body: (
        <div className="space-y-2">
          <p className="text-sm">{p.diagnosis}</p>
          <Chips
            values={categories.map(
              (c) => `${c} (${p.items.filter((i) => CATEGORY_LABELS[i.category] === c).length})`,
            )}
          />
        </div>
      ),
      action: (
        <Button asChild variant="ghost" size="sm">
          <Link to={`/print/prescription/${p.id}`}>
            <Printer />
            Print
          </Link>
        </Button>
      ),
    });
  }

  const bloodByDate = new Map<string, PatientTimeline['bloodWork']>();
  for (const result of timeline.bloodWork) {
    bloodByDate.set(result.testDate, [...(bloodByDate.get(result.testDate) ?? []), result]);
  }
  for (const [date, results] of bloodByDate) {
    events.push({
      id: `b-${date}`,
      date,
      icon: FlaskConical,
      title: 'Blood work',
      body: (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {results.map((r) => (
            <span key={r.id}>
              <span className="text-muted-foreground">{BLOOD_TEST_LABELS[r.test]}</span>{' '}
              <span className="font-medium tabular-nums">
                {formatQuantity(r.value)} {r.unit}
              </span>
            </span>
          ))}
        </div>
      ),
    });
  }

  for (const entry of timeline.bhrt) {
    events.push({
      id: `h-${entry.id}`,
      date: entry.date,
      icon: Activity,
      title: `BHRT ${BHRT_STATUS_LABELS[entry.status].toLowerCase()}`,
      body: entry.note ? (
        <p className="text-sm whitespace-pre-wrap text-muted-foreground">{entry.note}</p>
      ) : null,
    });
  }

  for (const record of timeline.medicalRecords) {
    events.push({
      id: `r-${record.id}`,
      date: record.date,
      icon: FolderOpen,
      title: RECORD_TYPE_LABELS[record.type],
      body: (
        <div className="space-y-2">
          {record.note ? <p className="text-sm text-muted-foreground">{record.note}</p> : null}
          <AttachmentList
            files={record.files}
            getUrl={(file) => patientRecordFileUrl(timeline.patient.id, file.id)}
          />
        </div>
      ),
    });
  }

  return events.sort((a, b) => b.date.localeCompare(a.date));
}

export function PatientTimelineView({ patientId }: { patientId: string }) {
  const timeline = usePatientTimeline(patientId);

  if (timeline.isLoading)
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  if (timeline.error) return <ErrorState error={timeline.error} onRetry={() => void timeline.refetch()} />;
  if (!timeline.data) return null;

  const events = buildEvents(timeline.data);
  if (events.length === 0)
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          title="No history yet"
          description="Consultations, prescriptions and results appear here."
        />
      </div>
    );

  return (
    <div className="space-y-3">
      {timeline.data.scope === 'all_branches' ? (
        <p className="text-xs text-muted-foreground">Showing history from all branches.</p>
      ) : null}
      <ol className="relative space-y-4 border-l pl-6">
        {events.map((event) => (
          <li key={event.id} className="relative">
            <span className="absolute top-3 -left-[2.05rem] flex size-6 items-center justify-center rounded-full border bg-card text-muted-foreground">
              <event.icon className="size-3.5" />
            </span>
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{event.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(event.date)}
                    {event.meta ? ` · ${event.meta}` : ''}
                  </div>
                </div>
                {event.action}
              </div>
              {event.body ? <div className="mt-3">{event.body}</div> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
