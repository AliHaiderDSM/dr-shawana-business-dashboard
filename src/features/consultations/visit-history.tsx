import { FileHeart } from 'lucide-react';
import { Link } from 'react-router';
import { Panel } from '@/components/shared/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';
import type { ConsultationHistory } from './api';

function PrescriptionLinks({
  title,
  items,
  patientName,
}: {
  title: string;
  items: ConsultationHistory['prescriptions'];
  patientName: string;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((p, index) => (
            <li key={p.id} className="flex items-start gap-2 text-sm">
              <span className="w-5 shrink-0 text-muted-foreground tabular-nums">{index + 1}.</span>
              <Link
                to={`/print/prescription/${p.id}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
              >
                <FileHeart className="size-3.5" />
                {patientName} prescription slip ({formatDate(p.date, 'dd-MM-yyyy')})
              </Link>
              {p.doctor ? <span className="text-xs text-muted-foreground">· {p.doctor}</span> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function VisitHistory({
  history,
  loading,
  patientName,
}: {
  history: ConsultationHistory | undefined;
  loading: boolean;
  patientName: string;
}) {
  if (loading) return <Skeleton className="h-40 w-full" />;
  if (!history || (history.visits.length === 0 && history.prescriptions.length === 0)) return null;
  const previous = history.prescriptions.filter((p) => p.previous);
  const current = history.prescriptions.filter((p) => !p.previous);
  return (
    <Panel
      title="Patient history"
      description={`${history.visits.length} earlier ${history.visits.length === 1 ? 'appointment' : 'appointments'} and ${history.prescriptions.length} ${history.prescriptions.length === 1 ? 'prescription' : 'prescriptions'}`}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          {history.visits.length === 0 ? (
            <p className="text-sm text-muted-foreground">This is the first appointment.</p>
          ) : (
            history.visits.map((visit) => (
              <article key={visit.id} className="space-y-1 border-b pb-4 last:border-b-0 last:pb-0">
                <h4 className="text-sm font-semibold">
                  APP#{visit.appointmentNo} : Date: {formatDate(visit.date, 'dd-MM-yyyy')}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {visit.visitType === 'followup' ? 'Follow up' : 'New'}
                    {visit.doctor ? ` · ${visit.doctor}` : ''}
                  </span>
                </h4>
                {visit.issues ? <p className="text-sm whitespace-pre-wrap">{visit.issues}</p> : null}
                {visit.remark ? (
                  <p className="text-sm whitespace-pre-wrap">
                    <span className="font-medium">Plan: </span>
                    {visit.remark}
                  </p>
                ) : null}
                {!visit.issues && !visit.remark ? (
                  <p className="text-sm text-muted-foreground">No remark recorded.</p>
                ) : null}
              </article>
            ))
          )}
        </div>
        <div className="space-y-5 lg:border-l lg:pl-6">
          <PrescriptionLinks title="Previous prescription" items={previous} patientName={patientName} />
          <PrescriptionLinks title="New prescription" items={current} patientName={patientName} />
        </div>
      </div>
    </Panel>
  );
}
