import { Printer } from 'lucide-react';
import { useParams } from 'react-router';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePublicPatientHistory } from '@redux/features/public';
import { formatDate } from '@/lib/format';
import logo from '@/assets/logo-hd.png';
import { Downloads, IntakeForms } from './public-intake';

export function PublicHistoryPage() {
  const { token = '' } = useParams();
  const history = usePublicPatientHistory(token);
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
            {data.form ? (
              <div className="mb-8">
                <IntakeForms token={token} data={data} onChanged={() => void history.refetch()} />
              </div>
            ) : (
              <p className="rounded-xl border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
                There is no form to fill on this link.
              </p>
            )}
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
