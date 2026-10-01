import { FileHeart, Pencil, Plus, Printer } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/shared/empty-state';
import { Panel } from '@/components/shared/panel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Consultation } from '@/features/consultations/api';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate } from '@/lib/format';
import { CATEGORY_LABELS, prescriptionsApi } from './api';

export function ConsultationPrescriptions({ consultation }: { consultation: Consultation }) {
  const { can } = useAuth();
  const list = prescriptionsApi.useList({
    consultationId: consultation.id,
    pageSize: 50,
    sort: '-createdAt',
  });
  const newLink = `/prescriptions/new?consultationId=${consultation.id}`;

  return (
    <Panel
      title="Prescriptions"
      description="Each save creates a prescription for this visit, as in posSoft."
      bodyClassName="p-0"
      actions={
        can('prescriptions.create') ? (
          <Button asChild size="sm">
            <Link to={newLink}>
              <Plus />
              New prescription
            </Link>
          </Button>
        ) : null
      }
    >
      {list.isLoading ? (
        <div className="p-5">
          <Skeleton className="h-16 w-full" />
        </div>
      ) : !list.data?.data.length ? (
        <EmptyState
          icon={FileHeart}
          title="No prescription yet"
          description="Write labs, imaging, supplements and treatments for this visit."
          action={
            can('prescriptions.create') ? (
              <Button asChild size="sm">
                <Link to={newLink}>
                  <Plus />
                  Write prescription
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <ul className="divide-y">
          {list.data.data.map((rx) => {
            const categories = [...new Set(rx.items.map((i) => CATEGORY_LABELS[i.category]))];
            return (
              <li key={rx.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">
                    #{rx.prescriptionNo} · {formatDate(rx.date)}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{rx.diagnosis}</p>
                  <p className="text-xs text-muted-foreground">
                    {rx.items.length} items{categories.length ? ` · ${categories.join(', ')}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  {can('prescriptions.update') ? (
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/prescriptions/${rx.id}/edit`}>
                        <Pencil />
                        Edit
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/print/prescription/${rx.id}`}>
                      <Printer />
                      Print
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
