import { AlertTriangle, ChevronDown, FileText, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { openSignedUrl } from '@/components/shared/attachment-list';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { toastError } from '@/lib/api/errors';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { patientRecordFileUrl } from '@/features/patients/api';
import {
  reportSummaryFileUrl,
  useRemoveReportSummary,
  useReportSummaries,
  type LabReportSummary,
} from './api';

const DISCLAIMER = 'AI-generated summary; clinician verification required.';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h4>
      {children}
    </section>
  );
}

function SummaryBody({ item }: { item: LabReportSummary }) {
  const s = item.summary;
  const documents = s.documents ?? [];
  return (
    <div className="space-y-5 px-4 pb-4">
      {documents.length > 1 ? (
        <Section title={`Documents in this summary (${documents.length})`}>
          <ol className="space-y-2 text-sm">
            {documents.map((d, index) => (
              <li key={index} className="rounded-lg border bg-muted/30 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-primary-soft px-1.5 py-0.5 text-xs font-semibold text-primary-soft-foreground">
                    Doc {index + 1}
                  </span>
                  <span className="font-medium">{d.name}</span>
                  {d.date ? (
                    <span className="text-xs text-muted-foreground">{formatDate(d.date)}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-muted-foreground">{d.detail}</p>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}
      {s.patient.length ? (
        <Section title="Patient & report details">
          <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {s.patient.map((p, index) => (
              <div key={index} className="flex gap-2">
                <dt className="min-w-28 text-muted-foreground">{p.label}</dt>
                <dd className="font-medium">{p.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}
      <Section title="Key abnormal findings">
        {s.abnormal.length ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Test</th>
                  <th className="px-3 py-2 text-right font-medium">Result</th>
                  <th className="px-3 py-2 text-left font-medium">Lab range</th>
                  <th className="px-3 py-2 text-left font-medium">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {s.abnormal.map((a, index) => (
                  <tr key={index}>
                    <td className="px-3 py-2 font-medium">{a.test}</td>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap tabular-nums">
                      {a.value} {a.unit}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{a.range || '—'}</td>
                    <td className="px-3 py-2">
                      <StatusBadge tone={a.flag === 'high' ? 'danger' : 'warning'}>
                        {a.flag === 'high' ? 'High' : a.flag === 'low' ? 'Low' : 'Abnormal'}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {s.normal.length
              ? "No result is outside the lab's reference ranges."
              : 'No patient results were found on this document.'}
          </p>
        )}
      </Section>
      {s.normal.length ? (
        <Section title="Normal findings">
          <ul className="space-y-1 text-sm">
            {s.normal.map((n, index) => (
              <li key={index}>
                <span className="font-medium">{n.category}:</span>{' '}
                <span className="text-muted-foreground">{n.tests}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {s.overview ? (
        <Section title="Clinical summary">
          <p className="text-sm leading-relaxed">{s.overview}</p>
        </Section>
      ) : null}
      {s.reviewPoints.length ? (
        <Section title="Doctor's review points">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {s.reviewPoints.map((p, index) => (
              <li key={index}>{p}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {s.unreadable.length ? (
        <Section title="Needs checking">
          <ul className="space-y-1 text-sm text-warning-soft-foreground">
            {s.unreadable.map((p, index) => (
              <li key={index} className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground italic">{DISCLAIMER}</p>
    </div>
  );
}

function SummaryFiles({ patientId, item }: { patientId: string; item: LabReportSummary }) {
  if (item.files.length === 0) {
    return item.fileName ? <span className="text-muted-foreground">{item.fileName}</span> : null;
  }
  return (
    <>
      {item.files.map((file, index) => {
        const recordFileId = file.recordFileId;
        const open = recordFileId
          ? () => patientRecordFileUrl(patientId, recordFileId)
          : file.stored
            ? () => reportSummaryFileUrl(patientId, item.id, file.index)
            : null;
        return (
          <span key={file.index} className="min-w-0">
            {open ? (
              <button
                type="button"
                className="text-left text-primary hover:underline"
                title={`Open ${file.name}`}
                onClick={() => void openSignedUrl(open)}
              >
                {file.name}
              </button>
            ) : (
              <span className="text-muted-foreground">{file.name}</span>
            )}
            {index < item.files.length - 1 ? <span className="text-muted-foreground">,</span> : null}
          </span>
        );
      })}
    </>
  );
}

export function ReportSummaries({ patientId, canEdit }: { patientId: string; canEdit: boolean }) {
  const summaries = useReportSummaries(patientId);
  const remove = useRemoveReportSummary(patientId);
  const [openId, setOpenId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<LabReportSummary | null>(null);
  const items = summaries.data ?? [];
  const expanded = openId ?? items[0]?.id ?? null;

  if (summaries.isLoading) {
    return (
      <div className="flex items-center gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading report summaries…
      </div>
    );
  }
  if (items.length === 0) return null;

  return (
    <div className="border-t">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Sparkles className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">Lab report summaries</h3>
        <span className="text-xs text-muted-foreground">from the reports read with AI</span>
      </div>
      <ul className="divide-y">
        {items.map((item) => {
          const open = item.id === expanded;
          const abnormal = item.summary.abnormal.length;
          const toggle = () => setOpenId(open ? 'none' : item.id);
          return (
            <li key={item.id}>
              <div className="flex items-center gap-2 px-4 py-2.5">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <button
                    type="button"
                    onClick={toggle}
                    className="flex shrink-0 items-center gap-2"
                    aria-expanded={open}
                    aria-label={open ? 'Hide summary' : 'Show summary'}
                  >
                    <ChevronDown
                      className={cn(
                        'size-4 shrink-0 text-muted-foreground transition-transform',
                        !open && '-rotate-90',
                      )}
                    />
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
                      <button type="button" onClick={toggle} className="text-left font-medium">
                        {(item.summary.documents?.length ?? 0) > 1
                          ? `${item.summary.documents!.length} reports`
                          : item.testDate
                            ? `Report of ${formatDate(item.testDate)}`
                            : 'Report (no date)'}
                      </button>
                      {item.files.length || item.fileName ? (
                        <span className="text-muted-foreground">·</span>
                      ) : null}
                      <SummaryFiles patientId={patientId} item={item} />
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Read {formatDateTime(item.createdAt)}
                      {item.createdBy ? ` by ${item.createdBy}` : ''} · {item.valuesFound} values added
                    </span>
                  </span>
                </div>
                {abnormal ? (
                  <StatusBadge tone="warning">{abnormal} abnormal</StatusBadge>
                ) : (
                  <StatusBadge tone="success">All normal</StatusBadge>
                )}
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    aria-label="Delete this summary"
                    onClick={() => setRemoving(item)}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
              {open ? <SummaryBody item={item} /> : null}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(value) => !value && setRemoving(null)}
        title="Delete this report summary?"
        description="Only the AI summary is removed. The blood work values stay."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!removing) return;
          try {
            await remove.mutateAsync(removing.id);
            toast.success('Summary deleted');
          } catch (error) {
            toastError(error);
          }
        }}
      />
    </div>
  );
}
