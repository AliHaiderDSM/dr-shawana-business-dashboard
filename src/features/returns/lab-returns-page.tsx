import { Ban, Loader2, PackageCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toastError } from '@/lib/api/errors';
import { formatDate, formatDateTime, formatQuantity } from '@/lib/format';
import {
  useDecideLabReturnMutation,
  useGetLabReturnsQuery,
  type LabReturnItem,
} from '@redux/features/returns';
import { REASON_LABELS } from './constants';

type Outcome = 'restocked' | 'damaged';

const OUTCOMES: Record<Outcome, { label: string; done: string; description: string }> = {
  restocked: {
    label: 'Repaired · back to stock',
    done: 'Repaired',
    description:
      'The item is fixed. It goes back into the stock of the branch it was sold from and can be sold again.',
  },
  damaged: {
    label: 'Cannot fix · remove',
    done: 'Removed',
    description: 'The item cannot be repaired. It is removed from the inventory for good.',
  },
};

function DecideDialog({
  item,
  outcome,
  onClose,
}: {
  item: LabReturnItem;
  outcome: Outcome;
  onClose: () => void;
}) {
  const [decide, state] = useDecideLabReturnMutation();
  const [note, setNote] = useState('');
  const choice = OUTCOMES[outcome];
  return (
    <Dialog open onOpenChange={(open) => !open && !state.isLoading && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {choice.label}: {item.product} × {formatQuantity(item.qty)}
          </DialogTitle>
          <DialogDescription>{choice.description} This cannot be changed later.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="lab-note">Lab note</Label>
          <Textarea id="lab-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={state.isLoading}>
            Cancel
          </Button>
          <Button
            variant={outcome === 'damaged' ? 'destructive' : 'default'}
            disabled={state.isLoading}
            onClick={() =>
              decide({ itemId: item.id, outcome, note: note.trim() || null })
                .unwrap()
                .then(() => {
                  toast.success(`${item.product}: ${choice.done.toLowerCase()}`);
                  onClose();
                })
                .catch(toastError)
            }
          >
            {state.isLoading ? <Loader2 className="animate-spin" /> : null}
            {choice.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LabReturnsPage() {
  const [status, setStatus] = useState<'waiting' | 'done'>('waiting');
  const query = useGetLabReturnsQuery(status);
  const [deciding, setDeciding] = useState<{ item: LabReturnItem; outcome: Outcome } | null>(null);
  const items = query.data ?? [];

  return (
    <>
      <PageHeader
        title="Returns at the lab"
        description="Damaged products that branches sent to the lab from their returns. Repair one to send it back into the stock it came from, or remove it from the inventory."
      />
      <Tabs value={status} onValueChange={(v) => setStatus(v as 'waiting' | 'done')} className="mb-4">
        <TabsList>
          <TabsTrigger value="waiting">Waiting</TabsTrigger>
          <TabsTrigger value="done">Done</TabsTrigger>
        </TabsList>
      </Tabs>
      {query.isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={status === 'waiting' ? 'Nothing at the lab' : 'Nothing decided yet'}
          description={
            status === 'waiting'
              ? 'When a branch sends a damaged return item to the lab, it shows here.'
              : 'Items the lab repaired or removed show here.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Product</th>
                <th className="px-4 py-2 text-right font-medium">Qty</th>
                <th className="px-4 py-2 text-left font-medium">Return</th>
                <th className="px-4 py-2 text-left font-medium">Branch · customer</th>
                <th className="px-4 py-2 text-left font-medium">Sent</th>
                <th className="px-4 py-2 text-left font-medium">Note</th>
                <th className="px-4 py-2 text-right font-medium">{status === 'waiting' ? '' : 'Outcome'}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.product}</div>
                    {item.serials.length ? (
                      <div className="font-mono text-xs text-muted-foreground">{item.serials.join(', ')}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatQuantity(item.qty)}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/returns/${item.returnId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {item.returnNo}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {item.invoiceNo} · {formatDate(item.returnDate)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {REASON_LABELS[item.reason as keyof typeof REASON_LABELS] ?? item.reason}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{item.branch.name}</div>
                    <div className="text-xs text-muted-foreground">{item.customer ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div>{formatDateTime(item.sentAt)}</div>
                    <div className="text-xs text-muted-foreground">{item.sentBy ?? '—'}</div>
                  </td>
                  <td className="max-w-64 px-4 py-3 text-xs whitespace-pre-wrap text-muted-foreground">
                    {item.note ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {status === 'waiting' ? (
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" onClick={() => setDeciding({ item, outcome: 'restocked' })}>
                          <PackageCheck />
                          Repaired
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeciding({ item, outcome: 'damaged' })}
                        >
                          <Ban />
                          Cannot fix
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-0.5">
                        <StatusBadge tone={item.disposition === 'restocked' ? 'success' : 'danger'}>
                          {item.disposition === 'restocked' ? 'Repaired · back in stock' : 'Removed'}
                        </StatusBadge>
                        {item.decidedAt ? (
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(item.decidedAt)}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {deciding ? (
        <DecideDialog
          key={deciding.item.id + deciding.outcome}
          item={deciding.item}
          outcome={deciding.outcome}
          onClose={() => setDeciding(null)}
        />
      ) : null}
    </>
  );
}
