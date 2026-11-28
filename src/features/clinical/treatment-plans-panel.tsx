import {
  ChevronDown,
  ExternalLink,
  FileHeart,
  FlaskConical,
  NotebookPen,
  Pill,
  Stethoscope,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Panel } from '@/components/shared/panel';
import { RichTextView, richTextIsEmpty } from '@/components/shared/rich-text';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useTreatmentPlans, type TreatmentPlan } from '@redux/features/clinical';
import { prescriptionsApi, type Prescription } from '@redux/features/prescriptions';

const wasEdited = (plan: TreatmentPlan) =>
  new Date(plan.updatedAt).getTime() - new Date(plan.createdAt).getTime() > 5000;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function Entry({
  date,
  doctor,
  summary,
  badge,
  defaultOpen,
  latest,
  children,
}: {
  date: string;
  doctor: string | null | undefined;
  summary: string;
  badge?: ReactNode;
  defaultOpen: boolean;
  latest: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <li className="relative pl-7">
      <span
        className={cn(
          'absolute top-4 left-0 size-3 rounded-full border-2 border-card ring-2',
          latest ? 'bg-primary ring-primary/30' : 'bg-muted-foreground/40 ring-border',
        )}
      />
      <article className={cn('rounded-lg border bg-card', open && 'shadow-xs')}>
        <header className="flex flex-wrap items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <ChevronDown
              className={cn(
                'size-4 shrink-0 text-muted-foreground transition-transform',
                !open && '-rotate-90',
              )}
            />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{formatDate(date)}</span>
                {latest ? <StatusBadge tone="info">Latest</StatusBadge> : null}
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {doctor ? (
                  <span className="flex items-center gap-1.5">
                    <Stethoscope className="size-3.5" />
                    {doctor}
                  </span>
                ) : null}
                {!open ? <span>{summary}</span> : null}
              </span>
            </span>
          </button>
          {badge}
        </header>
        {open ? <div className="space-y-3 border-t px-4 py-3">{children}</div> : null}
      </article>
    </li>
  );
}

function Timeline<T>({
  items,
  icon,
  emptyTitle,
  emptyDescription,
  render,
}: {
  items: T[];
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  render: (item: T, index: number) => ReactNode;
}) {
  if (!items.length) return <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />;
  return (
    <ol className="relative space-y-3 before:absolute before:top-5 before:bottom-5 before:left-[5px] before:w-0.5 before:bg-border">
      {items.map(render)}
    </ol>
  );
}

const updatedBadge = (plan: TreatmentPlan) =>
  wasEdited(plan) ? <StatusBadge tone="info">Updated {formatDate(plan.updatedAt)}</StatusBadge> : null;

function PrescriptionEntry({ prescription, index }: { prescription: Prescription; index: number }) {
  return (
    <Entry
      date={prescription.date}
      doctor={prescription.doctor?.name}
      summary={`PRE#${prescription.prescriptionNo} · ${plural(prescription.items.length, 'item')}`}
      defaultOpen={index === 0}
      latest={index === 0}
      badge={
        <Button asChild variant="outline" size="sm">
          <Link to={`/print/prescription/${prescription.id}`}>
            <ExternalLink />
            PRE#{prescription.prescriptionNo}
          </Link>
        </Button>
      }
    >
      {prescription.diagnosis ? (
        <div className="text-sm">
          <span className="font-medium">Diagnosis: </span>
          {prescription.diagnosis}
        </div>
      ) : null}
      {!richTextIsEmpty(prescription.planTreatment) ? (
        <RichTextView value={prescription.planTreatment} />
      ) : null}
      {prescription.items.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {prescription.items.map((item) => (
            <li key={item.id}>
              <span className="font-medium">{item.name}</span>
              {item.dose ? <span> — {item.dose}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {prescription.followupDate ? (
        <div className="text-xs text-muted-foreground">Follow-up {formatDate(prescription.followupDate)}</div>
      ) : null}
    </Entry>
  );
}

function PrescriptionsTimeline({ patientId }: { patientId: string }) {
  const list = prescriptionsApi.useList({ patientId, page: 1, pageSize: 100, sort: '-date' });
  if (list.isLoading) return <Skeleton className="h-28 w-full" />;
  if (list.error) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  return (
    <Timeline
      items={list.data?.data ?? []}
      icon={FileHeart}
      emptyTitle="No prescriptions yet"
      emptyDescription="Prescriptions written for this patient show here."
      render={(p, index) => <PrescriptionEntry key={p.id} prescription={p} index={index} />}
    />
  );
}

export function TreatmentPlansPanel({
  patientId,
  withPrescriptions = false,
}: {
  patientId: string;
  withPrescriptions?: boolean;
}) {
  const plans = useTreatmentPlans(patientId);
  const all = plans.data ?? [];
  const written = all.filter((p) => !richTextIsEmpty(p.plan));
  const medicines = all.filter((p) => p.medicines.length);
  const bloodWork = all.filter((p) => p.bloodWork.length);

  return (
    <Panel
      title="Treatment history"
      description="What the doctors wrote for this patient in the doctor app, newest first."
    >
      {plans.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : plans.error ? (
        <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />
      ) : (
        <Tabs defaultValue="medicines">
          <TabsList className="flex h-auto w-full flex-wrap justify-start">
            <TabsTrigger value="medicines">
              <Pill />
              Medicines ({medicines.length})
            </TabsTrigger>
            <TabsTrigger value="blood">
              <FlaskConical />
              Blood work ({bloodWork.length})
            </TabsTrigger>
            {withPrescriptions ? (
              <TabsTrigger value="prescriptions">
                <FileHeart />
                Prescriptions
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="plan">
              <NotebookPen />
              Plan of treatment ({written.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="medicines" className="mt-4">
            <Timeline
              items={medicines}
              icon={Pill}
              emptyTitle="No medicines yet"
              emptyDescription="Medicines added in the doctor app show here."
              render={(plan, index) => (
                <Entry
                  key={plan.id}
                  date={plan.date}
                  doctor={plan.doctor}
                  summary={plural(plan.medicines.length, 'medicine')}
                  badge={updatedBadge(plan)}
                  defaultOpen={index === 0}
                  latest={index === 0}
                >
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {plan.medicines.map((m, i) => (
                      <li key={`${m.name}-${i}`}>
                        <span className="font-medium">{m.name}</span>
                        {m.dose ? <span> — {m.dose}</span> : null}
                      </li>
                    ))}
                  </ul>
                </Entry>
              )}
            />
          </TabsContent>
          <TabsContent value="blood" className="mt-4">
            <Timeline
              items={bloodWork}
              icon={FlaskConical}
              emptyTitle="No blood work yet"
              emptyDescription="Blood tests added in the doctor app show here."
              render={(plan, index) => (
                <Entry
                  key={plan.id}
                  date={plan.date}
                  doctor={plan.doctor}
                  summary={plural(plan.bloodWork.length, 'test')}
                  badge={updatedBadge(plan)}
                  defaultOpen={index === 0}
                  latest={index === 0}
                >
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {plan.bloodWork.map((b, i) => (
                      <li key={`${b.name}-${i}`} className="font-medium">
                        {b.name}
                      </li>
                    ))}
                  </ul>
                </Entry>
              )}
            />
          </TabsContent>
          {withPrescriptions ? (
            <TabsContent value="prescriptions" className="mt-4">
              <PrescriptionsTimeline patientId={patientId} />
            </TabsContent>
          ) : null}
          <TabsContent value="plan" className="mt-4">
            <Timeline
              items={written}
              icon={NotebookPen}
              emptyTitle="No plans of treatment yet"
              emptyDescription="Plans of treatment written in the doctor app show here."
              render={(plan, index) => (
                <Entry
                  key={plan.id}
                  date={plan.date}
                  doctor={plan.doctor}
                  summary="Plan of treatment"
                  badge={updatedBadge(plan)}
                  defaultOpen={index === 0}
                  latest={index === 0}
                >
                  <RichTextView value={plan.plan} />
                </Entry>
              )}
            />
          </TabsContent>
        </Tabs>
      )}
    </Panel>
  );
}
