import { useQuery } from '@tanstack/react-query';
import { Activity, CalendarDays, FileHeart, FlaskConical, FolderOpen, Loader2, Printer } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { STATUS_LABELS, timeRange } from '@/features/appointments/api';
import { BHRT_STATUS_LABELS, BLOOD_TEST_LABELS, RECORD_TYPE_LABELS } from '@/features/clinical/api';
import { CATEGORY_LABELS } from '@/features/prescriptions/api';
import { ApiError } from '@/lib/api/client';
import type { Schemas } from '@/lib/api/types';
import { env } from '@/lib/env';
import { formatDate, formatQuantity, titleCase } from '@/lib/format';
import logo from '@/assets/logo-hd.png';
import { Downloads, IntakeForms } from './public-intake';

type History = Schemas['PublicPatientHistory'];

async function publicGet<T>(path: string): Promise<T> {
  const response = await fetch(`${env.VITE_API_BASE_URL}${path}`);
  const body = (await response.json().catch(() => null)) as {
    data?: T;
    error?: { code?: string; message?: string };
  } | null;
  if (!response.ok || !body?.data)
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'NOT_FOUND',
      body?.error?.message ?? 'This link is invalid or has expired',
    );
  return body.data;
}

const label = (labels: Record<string, string>, value: string) => labels[value] ?? titleCase(value);

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Activity;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card shadow-xs print:break-inside-avoid print:shadow-none">
      <header className="flex items-center gap-2 border-b px-5 py-3">
        <Icon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function FileButton({ token, file }: { token: string; file: { id: string; originalName: string } }) {
  const [opening, setOpening] = useState(false);
  const open = () => {
    setOpening(true);
    publicGet<{ url: string }>(`/public/patient-history/${token}/files/${file.id}`)
      .then(({ url }) => window.open(url, '_blank', 'noopener'))
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : 'Could not open the file'),
      )
      .finally(() => setOpening(false));
  };
  return (
    <Button variant="outline" size="sm" onClick={open} disabled={opening} className="max-w-full">
      {opening ? <Loader2 className="animate-spin" /> : <FolderOpen />}
      <span className="truncate">{file.originalName}</span>
    </Button>
  );
}

function HistoryView({ token, data }: { token: string; data: History }) {
  const bloodByDate = new Map<string, History['bloodWork']>();
  for (const result of data.bloodWork)
    bloodByDate.set(result.testDate, [...(bloodByDate.get(result.testDate) ?? []), result]);

  return (
    <div className="space-y-5">
      <Section icon={CalendarDays} title="Appointments">
        {data.appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No appointments yet.</p>
        ) : (
          <ul className="divide-y">
            {data.appointments.map((a) => (
              <li
                key={a.appointmentNo}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
              >
                <div>
                  <div className="text-sm font-medium">
                    {formatDate(a.date)} · {timeRange(a.timeFrom, a.timeTo)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[a.doctor, titleCase(a.mode)].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <StatusBadge status={a.status}>{label(STATUS_LABELS, a.status)}</StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {data.prescriptions.map((p) => {
        const groups = new Map<string, History['prescriptions'][number]['items']>();
        for (const item of p.items) groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
        return (
          <Section key={p.id} icon={FileHeart} title={`Prescription · ${formatDate(p.date)}`}>
            <div className="space-y-4">
              <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {p.doctor ? (
                  <div>
                    <span className="text-muted-foreground">Doctor </span>
                    {p.doctor}
                  </div>
                ) : null}
                {p.followupDate ? (
                  <div>
                    <span className="text-muted-foreground">Follow up </span>
                    {formatDate(p.followupDate)}
                  </div>
                ) : null}
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">Diagnosis </span>
                  {p.diagnosis}
                </div>
              </div>
              {[...groups].map(([category, items]) => (
                <div key={category}>
                  <div className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {label(CATEGORY_LABELS, category)}
                  </div>
                  <ul className="space-y-1.5">
                    {items.map((item, i) => (
                      <li key={`${item.name}-${i}`} className="text-sm">
                        <span className="font-medium">{item.name}</span>
                        {item.dose ? <span> · {item.dose}</span> : null}
                        {item.instructions ? (
                          <div className="text-xs text-muted-foreground">{item.instructions}</div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {p.planTreatment ? (
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{p.planTreatment}</p>
              ) : null}
            </div>
          </Section>
        );
      })}

      {bloodByDate.size > 0 ? (
        <Section icon={FlaskConical} title="Blood work">
          <ul className="divide-y">
            {[...bloodByDate].map(([date, results]) => (
              <li key={date} className="py-2.5 first:pt-0 last:pb-0">
                <div className="mb-1 text-xs text-muted-foreground">{formatDate(date)}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {results.map((r) => (
                    <span key={r.test}>
                      <span className="text-muted-foreground">{label(BLOOD_TEST_LABELS, r.test)}</span>{' '}
                      <span className="font-medium tabular-nums">
                        {formatQuantity(r.value)} {r.unit}
                      </span>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {data.bhrt.length > 0 ? (
        <Section icon={Activity} title="BHRT">
          <ul className="divide-y">
            {data.bhrt.map((h, i) => (
              <li key={`${h.date}-${i}`} className="flex gap-4 py-2.5 text-sm first:pt-0 last:pb-0">
                <div className="w-24 shrink-0 text-muted-foreground">{formatDate(h.date)}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{label(BHRT_STATUS_LABELS, h.status)}</div>
                  {h.note ? <p className="whitespace-pre-wrap text-muted-foreground">{h.note}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {data.medicalRecords.length > 0 ? (
        <Section icon={FolderOpen} title="Medical records">
          <ul className="divide-y">
            {data.medicalRecords.map((r) => (
              <li key={r.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                <div className="text-sm">
                  <span className="font-medium">{label(RECORD_TYPE_LABELS, r.type)}</span>
                  <span className="text-muted-foreground"> · {formatDate(r.date)}</span>
                </div>
                {r.note ? <p className="text-sm text-muted-foreground">{r.note}</p> : null}
                {r.files.length ? (
                  <div className="flex flex-wrap gap-2 print:hidden">
                    {r.files.map((f) => (
                      <FileButton key={f.id} token={token} file={f} />
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

export function PublicHistoryPage() {
  const { token = '' } = useParams();
  const history = useQuery({
    queryKey: ['public-history', token],
    queryFn: () => publicGet<History>(`/public/patient-history/${encodeURIComponent(token)}`),
    retry: false,
  });
  const data = history.data;

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        {history.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !data ? (
          <div className="rounded-xl border bg-card">
            <EmptyState
              title="Link not available"
              description={
                history.error instanceof Error
                  ? history.error.message
                  : 'This link is invalid or has expired.'
              }
            />
          </div>
        ) : (
          <>
            <header className="mb-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img src={logo} alt="Dr Shawana DSM" className="h-12 w-auto" />
                  <div className="text-lg font-semibold">{data.clinic?.name ?? 'Dr Shawana Mufti DSM'}</div>
                </div>
                <Button variant="outline" onClick={() => window.print()} className="print:hidden">
                  <Printer />
                  Print
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground">
                  <span>
                    Name: <span className="font-semibold">{data.patient.name}</span>
                  </span>
                  {data.form ? <span className="font-semibold">APP#{data.form.appointmentNo}</span> : null}
                </div>
                <div className="rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground">
                  WhatsApp: <span className="font-semibold tabular-nums">{data.phone ?? '—'}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {[data.patient.city, `Link valid until ${formatDate(data.expiresAt)}`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <Downloads token={token} data={data} />
            </header>
            <div className="mb-8">
              <IntakeForms token={token} data={data} onChanged={() => void history.refetch()} />
            </div>
            {data.form ? (
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Your history</h2>
            ) : null}
            <HistoryView token={token} data={data} />
            {data.clinic && (data.clinic.phone || data.clinic.address) ? (
              <footer className="mt-8 text-center text-xs text-muted-foreground">
                {[data.clinic.name, data.clinic.phone, data.clinic.address].filter(Boolean).join(' · ')}
              </footer>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
