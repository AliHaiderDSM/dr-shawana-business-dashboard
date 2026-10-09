import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useParams } from 'react-router';
import logo from '@/assets/logo-hd.png';
import { EmptyState } from '@/components/shared/empty-state';
import { PrintLayout } from '@/components/shared/print-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { CATEGORY_LABELS } from '@/features/prescriptions/api';
import { ApiError } from '@/lib/api/client';
import type { Schemas } from '@/lib/api/types';
import { env } from '@/lib/env';
import { formatDate, titleCase } from '@/lib/format';

type History = Schemas['PublicPatientHistory'];

async function loadHistory(token: string) {
  const response = await fetch(
    `${env.VITE_API_BASE_URL}/public/patient-history/${encodeURIComponent(token)}`,
  );
  const body = (await response.json().catch(() => null)) as {
    data?: History;
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

export function PublicPrescriptionPage() {
  const { token = '', id = '' } = useParams();
  const history = useQuery({
    queryKey: ['public-history', token],
    queryFn: () => loadHistory(token),
    retry: false,
  });
  const rx = history.data?.prescriptions.find((p) => p.id === id);

  useEffect(() => {
    if (!rx) return;
    const timer = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(timer);
  }, [rx]);

  if (history.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!history.data || !rx) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-xl border bg-card">
          <EmptyState
            title="Prescription not available"
            description={
              history.error instanceof Error ? history.error.message : 'This prescription was not found.'
            }
          />
        </div>
      </div>
    );
  }

  const data = history.data;
  const groups = new Map<string, History['prescriptions'][number]['items']>();
  for (const item of rx.items) groups.set(item.category, [...(groups.get(item.category) ?? []), item]);

  return (
    <PrintLayout>
      <div className="space-y-5 text-sm">
        <header className="flex items-center justify-between gap-6 border-b-2 border-primary pb-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Dr Shawana DSM" className="h-14 w-auto" />
            <div>
              <div className="text-lg font-semibold">{data.clinic?.name ?? 'Dr Shawana Mufti DSM'}</div>
              {data.clinic?.address ? (
                <div className="text-xs text-muted-foreground">{data.clinic.address}</div>
              ) : null}
              {data.clinic?.phone ? (
                <div className="text-xs text-muted-foreground">{data.clinic.phone}</div>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            <div className="text-base font-semibold tracking-tight uppercase">Prescription</div>
            <div className="mt-1 text-xs text-muted-foreground">No {rx.prescriptionNo}</div>
          </div>
        </header>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div>
            <span className="text-muted-foreground">Patient: </span>
            <span className="font-medium">{data.patient.name}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Date: </span>
            <span className="font-medium">{formatDate(rx.date, 'dd-MM-yyyy')}</span>
          </div>
          <div>
            <span className="text-muted-foreground">City: </span>
            <span className="font-medium">{data.patient.city}</span>
          </div>
          {rx.doctor ? (
            <div>
              <span className="text-muted-foreground">Doctor: </span>
              <span className="font-medium">{rx.doctor}</span>
            </div>
          ) : null}
        </div>
        <div>
          <span className="text-muted-foreground">Diagnosis: </span>
          <span className="font-medium">{rx.diagnosis}</span>
        </div>
        {[...groups].map(([category, items]) => (
          <div key={category} className="break-inside-avoid">
            <div className="mb-1.5 border-b pb-1 text-xs font-semibold tracking-wide uppercase">
              {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? titleCase(category)}
            </div>
            <ol className="list-decimal space-y-1.5 pl-5">
              {items.map((item, index) => (
                <li key={`${item.name}-${index}`}>
                  <span className="font-medium">{item.name}</span>
                  {item.dose ? <span> · {item.dose}</span> : null}
                  {item.instructions ? (
                    <div className="text-xs text-muted-foreground">{item.instructions}</div>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ))}
        {rx.planTreatment ? (
          <div className="break-inside-avoid">
            <div className="mb-1 text-xs font-semibold tracking-wide uppercase">Plan</div>
            <p className="whitespace-pre-wrap">{rx.planTreatment}</p>
          </div>
        ) : null}
        {rx.followupDate ? (
          <div>
            <span className="text-muted-foreground">Follow up: </span>
            <span className="font-medium">{formatDate(rx.followupDate)}</span>
          </div>
        ) : null}
      </div>
    </PrintLayout>
  );
}
