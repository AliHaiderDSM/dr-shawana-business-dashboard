import { ExternalLink, FileHeart, FlaskConical, NotebookPen, Pill, Stethoscope } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
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
import { useTreatmentPlans, type TreatmentPlan } from '@redux/features/clinical';
import { prescriptionsApi, type Prescription } from '@redux/features/prescriptions';

const wasEdited = (plan: TreatmentPlan) =>
  new Date(plan.updatedAt).getTime() - new Date(plan.createdAt).getTime() > 5000;

function Entry({
  date,
  doctor,
  badge,
  children,
}: {
  date: string;
  doctor: string | null | undefined;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="space-y-3 rounded-lg border p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold">{formatDate(date)}</div>
          {doctor ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Stethoscope className="size-3.5" />
              {doctor}
            </div>
          ) : null}
        </div>
        {badge}
      </header>
      {children}
    </article>
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
  render: (item: T) => ReactNode;
}) {
  if (!items.length) return <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />;
  return <div className="space-y-4">{items.map(render)}</div>;
}

const updatedBadge = (plan: TreatmentPlan) =>
  wasEdited(plan) ? <StatusBadge tone="info">Updated {formatDate(plan.updatedAt)}</StatusBadge> : null;

function PrescriptionEntry({ prescription }: { prescription: Prescription }) {
  return (
    <Entry
      date={prescription.date}
      doctor={prescription.doctor?.name}
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
      {!richTextIsEmpty(prescription.planTreatment) ? <RichTextView value={prescription.planTreatment} /> : null}
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
      render={(p) => <PrescriptionEntry key={p.id} prescription={p} />}
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
        <Tabs defaultValue="plan">
          <TabsList className="flex h-auto w-full flex-wrap justify-start">
            <TabsTrigger value="plan">
              <NotebookPen />
              Plan of treatment ({written.length})
            </TabsTrigger>
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
          </TabsList>
          <TabsContent value="plan" className="mt-4">
            <Timeline
              items={written}
              icon={NotebookPen}
              emptyTitle="No plans of treatment yet"
              emptyDescription="Plans of treatment written in the doctor app show here."
              render={(plan) => (
                <Entry key={plan.id} date={plan.date} doctor={plan.doctor} badge={updatedBadge(plan)}>
                  <RichTextView value={plan.plan} />
                </Entry>
              )}
            />
          </TabsContent>
          <TabsContent value="medicines" className="mt-4">
            <Timeline
              items={medicines}
              icon={Pill}
              emptyTitle="No medicines yet"
              emptyDescription="Medicines added in the doctor app show here."
              render={(plan) => (
                <Entry key={plan.id} date={plan.date} doctor={plan.doctor} badge={updatedBadge(plan)}>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {plan.medicines.map((m, index) => (
                      <li key={`${m.name}-${index}`}>
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
              render={(plan) => (
                <Entry key={plan.id} date={plan.date} doctor={plan.doctor} badge={updatedBadge(plan)}>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {plan.bloodWork.map((b, index) => (
                      <li key={`${b.name}-${index}`} className="font-medium">
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
        </Tabs>
      )}
    </Panel>
  );
}
