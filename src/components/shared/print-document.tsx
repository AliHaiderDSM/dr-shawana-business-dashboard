import { Activity, ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/utils';
import { ErrorState } from './error-state';
import { PrintLayout } from './print-layout';

interface LetterheadProps {
  title: ReactNode;
  subtitle?: ReactNode;
  organization?: { name: string; lines?: (string | null | undefined)[]; logoUrl?: string | null };
}

export function Letterhead({ title, subtitle, organization }: LetterheadProps) {
  const { me } = useAuth();
  const name = organization?.name ?? 'DSM Clinic';
  const lines = organization?.lines ?? [me?.branch ? `${me.branch.name}, ${me.branch.city}` : null];
  return (
    <header className="flex items-start justify-between gap-6 border-b-2 border-primary pb-4">
      <div className="flex items-center gap-3">
        {organization?.logoUrl ? (
          <img src={organization.logoUrl} alt="" className="h-12 w-auto" />
        ) : (
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="size-5" strokeWidth={2.5} />
          </div>
        )}
        <div>
          <div className="text-lg font-semibold">{name}</div>
          {lines.filter(Boolean).map((line) => (
            <div key={line} className="text-xs text-muted-foreground">
              {line}
            </div>
          ))}
        </div>
      </div>
      <div className="text-right">
        <div className="text-base font-semibold tracking-tight uppercase">{title}</div>
        {subtitle ? <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
    </header>
  );
}

export function PrintField({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline gap-2 text-sm', className)}>
      <span className="shrink-0 text-muted-foreground">{label}:</span>
      <span className="min-w-0 flex-1 border-b border-dashed pb-0.5 font-medium">{value || '—'}</span>
    </div>
  );
}

export function PrintTable({
  head,
  rows,
  foot,
}: {
  head: ReactNode[];
  rows: ReactNode[][];
  foot?: ReactNode[];
}) {
  const cell = 'border px-2 py-1.5 text-center';
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-muted">
          {head.map((h, i) => (
            <th key={i} className={cn(cell, 'font-semibold')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((value, c) => (
              <td key={c} className={cell}>
                {value}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {foot ? (
        <tfoot>
          <tr className="bg-muted/60 font-semibold">
            {foot.map((value, i) => (
              <td key={i} className={cell}>
                {value}
              </td>
            ))}
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}

interface PrintPageProps {
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  paper?: 'a4' | 'a5' | 'receipt';
  children: () => ReactNode;
}

export function PrintPage({ isLoading, error, onRetry, paper, children }: PrintPageProps) {
  const navigate = useNavigate();
  const back = (
    <Button variant="outline" onClick={() => void navigate(-1)}>
      <ArrowLeft />
      Back
    </Button>
  );
  return (
    <PrintLayout paper={paper} toolbar={back}>
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : (
        children()
      )}
    </PrintLayout>
  );
}

export function SignatureLine({ label, imageUrl }: { label: string; imageUrl?: string | null }) {
  return (
    <div className="ml-auto w-56 text-center text-sm">
      {imageUrl ? <img src={imageUrl} alt="" className="mx-auto h-14 w-auto" /> : <div className="h-14" />}
      <div className="border-t pt-1 text-muted-foreground">{label}</div>
    </div>
  );
}
