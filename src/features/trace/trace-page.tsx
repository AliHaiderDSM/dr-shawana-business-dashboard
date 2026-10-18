import { ArrowUpRight, History, Link2, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { DetailList, Panel } from '@/components/shared/panel';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ROLE_LABELS } from '@/features/staff/constants';
import { ApiError } from '@/lib/api/client';
import { useTrace } from '@redux/features/trace';
import type { Role, Schemas } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';

type Trace = Schemas['Trace'];
type Kind = Trace['kind'];

const KIND_LABELS: Record<Kind, string> = {
  sale: 'Sale invoice',
  return: 'Return',
  stock_request: 'Stock request',
  transfer: 'Stock transfer',
  discount_request: 'Discount request',
  write_off: 'Write-off',
  store_receipt: 'Store receipt (GRN)',
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Changed',
  delete: 'Deleted',
  approve: 'Approved',
  reject: 'Rejected',
  cancel: 'Withdrawn',
  receive: 'Received by the branch',
  sent: 'Sent',
  received: 'Received by the branch',
  dispatch: 'Dispatched',
  write_off: 'Written off',
  request_write_off: 'Reported for write-off',
  approve_write_off: 'Write-off approved',
  reject_write_off: 'Write-off rejected',
  confirm_receipt: 'Confirmed at the store',
};

const CREATED_LABELS: Record<string, string> = {
  stock_request: 'Request made',
  stock_out: 'Stock packed for sending',
  stock_in: 'Stock in entry made',
  discount_request: 'Discount asked',
  write_off: 'Reported for write-off',
  sale_return: 'Return made',
};

const actionLabel = (action: string, entity?: string) => {
  if (action === 'create' && entity && CREATED_LABELS[entity]) return CREATED_LABELS[entity];
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (action.startsWith('item:propose:')) return `Item checked as ${action.slice(13)}, sent for approval`;
  if (action.startsWith('item:approve:')) return `Item approved as ${action.slice(13)}`;
  if (action === 'item:reject') return 'Item sent back to be checked again';
  if (action.startsWith('item:')) return `Item ${action.slice(5)}`;
  return action.replace(/_/g, ' ');
};

const SAME_STEP_MS = 5 * 60_000;

function uniqueSteps(timeline: Trace['timeline']) {
  const steps: (Trace['timeline'][number] & { label: string })[] = [];
  for (const step of timeline) {
    const label = actionLabel(step.action, step.entity);
    const at = new Date(step.at).getTime();
    const repeat = steps.some(
      (s) =>
        s.label === label &&
        (s.by?.id ?? null) === (step.by?.id ?? null) &&
        Math.abs(new Date(s.at).getTime() - at) < SAME_STEP_MS,
    );
    if (!repeat) steps.push({ ...step, label });
  }
  return steps;
}

function openPath(trace: Trace) {
  switch (trace.kind) {
    case 'sale':
      return `/sales/${trace.id}`;
    case 'return':
      return `/returns/${trace.id}`;
    case 'stock_request':
      return '/stock-requests';
    case 'transfer':
      return '/incoming-stock';
    case 'discount_request':
      return '/discount-requests';
    case 'write_off':
      return '/write-offs';
    case 'store_receipt':
      return '/store-receipts';
  }
}

export function TraceNumber({ number, className }: { number: string; className?: string }) {
  return (
    <Link
      to={`/trace/${encodeURIComponent(number)}`}
      onClick={(e) => e.stopPropagation()}
      className={className ?? 'font-mono font-medium whitespace-nowrap text-primary hover:underline'}
      title="See the full trail"
    >
      {number}
    </Link>
  );
}

export function TracePage() {
  const { number = '' } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState(number);
  const trace = useTrace(number);
  const t = trace.currentData;

  return (
    <>
      <PageHeader
        title={t ? `${KIND_LABELS[t.kind]} ${t.number}` : 'Find by number'}
        description="Type any number: invoice, return, stock request, transfer, discount request or write-off. You see its details, what it is linked to and every step with who did it."
        actions={
          t ? (
            <Button variant="outline" onClick={() => void navigate(openPath(t))}>
              Open
              <ArrowUpRight />
            </Button>
          ) : null
        }
      />
      <form
        className="relative mb-6 max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (search.trim()) void navigate(`/trace/${encodeURIComponent(search.trim().toUpperCase())}`);
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="e.g. LHR-SR-000001"
          className="h-10 pl-9 font-mono"
          aria-label="Number"
        />
      </form>
      {trace.isLoading || (trace.isFetching && !trace.currentData) ? (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-60 rounded-xl" />
        </div>
      ) : trace.error ? (
        trace.error instanceof ApiError && trace.error.status === 404 ? (
          <EmptyState
            icon={Search}
            title={`Nothing has the number ${number}`}
            description="Check the number. Branches see only their own records."
          />
        ) : (
          <ErrorState error={trace.error} onRetry={() => void trace.refetch()} />
        )
      ) : !t ? null : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            <Panel
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{t.number}</span>
                  {t.status ? (
                    <StatusBadge status={t.status}>{t.status.replace(/_/g, ' ')}</StatusBadge>
                  ) : null}
                </span>
              }
              description={`${KIND_LABELS[t.kind]} · ${t.branch.name} (${t.branch.code})`}
            >
              <DetailList
                items={[
                  {
                    label: 'Made by',
                    value: t.createdBy
                      ? `${t.createdBy.name} (${ROLE_LABELS[t.createdBy.role as Role] ?? t.createdBy.role})`
                      : '—',
                  },
                  { label: 'Made on', value: formatDateTime(t.createdAt) },
                  ...t.fields.filter((f) => f.value).map((f) => ({ label: f.label, value: f.value })),
                ]}
              />
            </Panel>
            <Panel title="Items" bodyClassName="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Product</th>
                    <th className="px-4 py-2 text-right font-medium">Qty</th>
                    <th className="px-4 py-2 text-left font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {t.items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 font-medium">{item.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{item.qty ?? '—'}</td>
                      <td className="px-4 py-2 text-muted-foreground">{item.detail ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>
          <div className="space-y-6">
            <Panel
              title={
                <span className="flex items-center gap-2">
                  <Link2 className="size-4" />
                  Linked
                </span>
              }
            >
              {t.links.length ? (
                <ul className="space-y-2">
                  {t.links.map((l) => (
                    <li
                      key={`${l.kind}-${l.number}`}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="text-muted-foreground">{KIND_LABELS[l.kind]}</span>
                      <span className="flex items-center gap-2">
                        <TraceNumber number={l.number} />
                        {l.status ? (
                          <StatusBadge status={l.status}>{l.status.replace(/_/g, ' ')}</StatusBadge>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing linked.</p>
              )}
            </Panel>
            <Panel
              title={
                <span className="flex items-center gap-2">
                  <History className="size-4" />
                  Steps
                </span>
              }
            >
              {t.timeline.length ? (
                <ol className="relative space-y-4 border-l pl-4">
                  {uniqueSteps(t.timeline).map((step, index) => (
                    <li key={index} className="relative">
                      <span className="absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full border-2 border-background bg-primary" />
                      <div className="text-sm font-medium">{step.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(step.at)}
                        {step.by
                          ? ` · ${step.by.name} (${ROLE_LABELS[step.by.role as Role] ?? step.by.role})`
                          : ''}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">No steps recorded.</p>
              )}
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
