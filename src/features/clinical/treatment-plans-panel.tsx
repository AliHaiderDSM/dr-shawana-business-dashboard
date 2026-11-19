import { FlaskConical, NotebookPen, Pill, Stethoscope } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Panel } from '@/components/shared/panel';
import { RichTextView, richTextIsEmpty } from '@/components/shared/rich-text';
import { StatusBadge } from '@/components/shared/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';
import { useTreatmentPlans, type TreatmentPlan } from '@redux/features/clinical';

const wasEdited = (plan: TreatmentPlan) =>
  new Date(plan.updatedAt).getTime() - new Date(plan.createdAt).getTime() > 5000;

function Heading({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <h4 className="flex items-center gap-2 border-b pb-1 text-sm font-semibold tracking-wide text-primary uppercase">
      <Icon className="size-4" />
      {title}
    </h4>
  );
}

function PlanEntry({ plan }: { plan: TreatmentPlan }) {
  return (
    <article className="space-y-4 rounded-lg border p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold">{formatDate(plan.date)}</div>
          {plan.doctor ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Stethoscope className="size-3.5" />
              {plan.doctor}
            </div>
          ) : null}
        </div>
        {wasEdited(plan) ? <StatusBadge tone="info">Updated {formatDate(plan.updatedAt)}</StatusBadge> : null}
      </header>

      {!richTextIsEmpty(plan.plan) ? (
        <section className="space-y-2">
          <Heading icon={NotebookPen} title="Plan of treatment" />
          <RichTextView value={plan.plan} />
        </section>
      ) : null}

      {plan.medicines.length ? (
        <section className="space-y-2">
          <Heading icon={Pill} title="Medicines" />
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {plan.medicines.map((m, index) => (
              <li key={`${m.name}-${index}`}>
                <span className="font-medium">{m.name}</span>
                {m.dose ? <span> — {m.dose}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {plan.bloodWork.length ? (
        <section className="space-y-2">
          <Heading icon={FlaskConical} title="Blood work" />
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {plan.bloodWork.map((b, index) => (
              <li key={`${b.name}-${index}`} className="font-medium">
                {b.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

export function TreatmentPlansPanel({ patientId }: { patientId: string }) {
  const plans = useTreatmentPlans(patientId);
  return (
    <Panel
      title="Plans of treatment"
      description="Plans, medicines and blood tests the doctors wrote for this patient in the doctor app, newest first."
    >
      {plans.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : plans.error ? (
        <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />
      ) : plans.data?.length ? (
        <div className="space-y-4">
          {plans.data.map((plan) => (
            <PlanEntry key={plan.id} plan={plan} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={NotebookPen}
          title="No plans yet"
          description="Plans of treatment written in the doctor app show here."
        />
      )}
    </Panel>
  );
}
