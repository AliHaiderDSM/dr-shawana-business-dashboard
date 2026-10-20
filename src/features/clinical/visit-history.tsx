import { StatusBadge, type Tone } from '@/components/shared/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMrsHistory } from '@redux/features/consultations';
import { SECTIONS } from '@/features/consultations/clinical-fields';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const SEVERITY_LABELS = ['None', 'Mild', 'Moderate', 'Severe'];
const SEVERITY_CLASSES = [
  'bg-muted text-muted-foreground',
  'bg-info-soft text-info-soft-foreground',
  'bg-warning-soft text-warning-soft-foreground',
  'bg-destructive-soft text-destructive-soft-foreground',
];

const MRS_TONES: Record<string, Tone> = {
  severe: 'danger',
  moderate: 'warning',
  mild: 'info',
};

function symptomLabels() {
  const labels = new Map<string, string>();
  for (const field of SECTIONS.additional_symptoms.fields) {
    if (field.kind !== 'checks') continue;
    for (const group of field.groups) for (const [value, label] of group.options) labels.set(value, label);
  }
  return labels;
}

const LABELS = symptomLabels();

export function MrsSymptomsHistory({
  patientId,
  currentId,
  showMrs = true,
}: {
  patientId: string;
  currentId?: string;
  showMrs?: boolean;
}) {
  const history = useMrsHistory(patientId);
  if (history.isLoading) return <Skeleton className="h-32 w-full" />;
  const visits = [...(history.data ?? [])]
    .reverse()
    .filter((v) => showMrs || v.symptoms.length > 0 || v.otherSymptoms || v.consultationId === currentId);
  if (visits.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        {showMrs ? 'No MRS or symptoms saved yet.' : 'No symptoms saved yet.'}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Visit</th>
            {showMrs ? <th className="px-3 py-2 text-left font-medium">MRS</th> : null}
            <th className="px-3 py-2 text-left font-medium">Additional symptoms</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {visits.map((visit) => (
            <tr
              key={visit.consultationId}
              className={cn('align-top', visit.consultationId === currentId && 'bg-primary-soft/30')}
            >
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="font-medium">{formatDate(visit.date)}</div>
                {visit.consultationId === currentId ? (
                  <div className="text-xs text-primary">This visit</div>
                ) : null}
              </td>
              {showMrs ? (
                <td className="px-3 py-2 whitespace-nowrap">
                  {visit.scores ? (
                    <div className="space-y-1">
                      <div className="font-semibold tabular-nums">
                        {visit.scores.total} / 44
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ({Math.round(visit.scores.percentage)}%)
                        </span>
                      </div>
                      <StatusBadge tone={MRS_TONES[visit.scores.severity] ?? 'success'}>
                        {visit.scores.severity}
                      </StatusBadge>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Not filled</span>
                  )}
                </td>
              ) : null}
              <td className="px-3 py-2">
                {visit.symptoms.length ? (
                  <div className="flex flex-wrap gap-1">
                    {visit.symptoms.map((s) => (
                      <span
                        key={s.key}
                        className={cn(
                          'rounded-md px-1.5 py-0.5 text-xs whitespace-nowrap',
                          SEVERITY_CLASSES[s.severity ?? 0] ?? SEVERITY_CLASSES[0],
                        )}
                        title={s.severity !== null ? SEVERITY_LABELS[s.severity] : undefined}
                      >
                        {LABELS.get(s.key) ?? s.key}
                        {s.severity !== null ? ` · ${s.severity}` : ''}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">None ticked</span>
                )}
                {visit.otherSymptoms ? (
                  <div className="mt-1 text-xs text-muted-foreground">Other: {visit.otherSymptoms}</div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
