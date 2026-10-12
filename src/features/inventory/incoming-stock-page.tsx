import { CheckCircle2, Loader2, PackageCheck, Truck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatDateTime, formatQuantity, isoDate } from '@/lib/format';
import { useIncomingStock, useReceiveStock, type IncomingStock } from './requests-api';

function TransferCard({ transfer, canReceive }: { transfer: IncomingStock; canReceive: boolean }) {
  const receive = useReceiveStock();
  const [date, setDate] = useState(isoDate());
  const { isSuperAdmin } = useAuth();
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">{transfer.transferNo}</span>
            {transfer.received ? (
              <StatusBadge tone="success">Received</StatusBadge>
            ) : (
              <StatusBadge tone="warning">Waiting for the branch admin</StatusBadge>
            )}
            {transfer.request ? (
              <span className="rounded-md bg-primary-soft px-1.5 py-0.5 font-mono text-xs text-primary-soft-foreground">
                {transfer.request.requestNo}
              </span>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground">
            Sent {formatDate(transfer.date)} by {transfer.sentBy?.name ?? 'Super Admin'}
            {isSuperAdmin ? ` · to ${transfer.toBranch.name}` : ''}
            {transfer.received && transfer.receivedAt
              ? ` · received ${formatDateTime(transfer.receivedAt)} by ${transfer.receivedBy?.name ?? '—'}`
              : ''}
          </div>
        </div>
        {!transfer.received && canReceive ? (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              aria-label="Receiving date"
              className="h-9 w-40"
              value={date}
              min={transfer.date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Button
              disabled={receive.isPending || !date}
              onClick={() =>
                receive
                  .mutateAsync({ transferNo: transfer.transferNo, date })
                  .then(() =>
                    toast.success(`${transfer.transferNo} received. The stock is in your branch now.`),
                  )
                  .catch(toastError)
              }
            >
              {receive.isPending ? <Loader2 className="animate-spin" /> : <PackageCheck />}
              Check & receive
            </Button>
          </div>
        ) : null}
      </header>
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Product</th>
            <th className="px-4 py-2 text-right font-medium">Qty</th>
            <th className="px-4 py-2 text-right font-medium">Labelled pieces</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {transfer.items.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-2 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  {item.received ? <CheckCircle2 className="size-4 text-success" /> : null}
                  {item.productName}
                </span>
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatQuantity(item.qty)} {item.unit}
              </td>
              <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">
                {item.labels || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {transfer.note ? (
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">{transfer.note}</p>
      ) : null}
    </section>
  );
}

export function IncomingStockPage() {
  const { me, isSuperAdmin } = useAuth();
  const [status, setStatus] = useState<'waiting' | 'received' | 'all'>('waiting');
  const transfers = useIncomingStock(status === 'all' ? undefined : status);
  const canReceive = !isSuperAdmin && (me?.role === 'branch_admin' || me?.role === 'dispatcher');

  return (
    <>
      <PageHeader
        title="Incoming stock"
        description={
          isSuperAdmin
            ? 'Every transfer from the Super Admin stock and whether the branch has received it.'
            : canReceive
              ? 'Stock the Super Admin sent. Count it, then receive it: only then it shows in Stock In and in your stock.'
              : 'Stock the Super Admin sent. Your branch admin checks and receives it.'
        }
      />
      <Tabs className="mb-4" value={status} onValueChange={(v) => setStatus(v as typeof status)}>
        <TabsList>
          <TabsTrigger value="waiting">Waiting</TabsTrigger>
          <TabsTrigger value="received">Received</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>
      {transfers.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : transfers.error ? (
        <ErrorState error={transfers.error} onRetry={() => void transfers.refetch()} />
      ) : (transfers.data ?? []).length === 0 ? (
        <EmptyState
          icon={Truck}
          title={status === 'waiting' ? 'Nothing is on the way' : 'No transfers yet'}
          description="Transfers from the Super Admin stock show here."
        />
      ) : (
        <div className="space-y-4">
          {(transfers.data ?? []).map((t) => (
            <TransferCard key={`${t.transferNo}-${t.toBranch.id}`} transfer={t} canReceive={canReceive} />
          ))}
        </div>
      )}
    </>
  );
}
