import { ArrowLeft, Ban, Loader2, PackageCheck, Pencil, Trash2, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { DetailList, Panel } from '@/components/shared/panel';
import { DetailSkeleton } from '@/components/shared/skeletons';
import { StatusBadge, type Tone } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useReceivingAccounts } from '@/features/appointments/payment-fields';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatDateTime, formatMoney, formatQuantity, isoDate } from '@/lib/format';
import {
  DISPOSITION_LABELS,
  REASON_LABELS,
  useRemoveReturn,
  useResolveItem,
  useReturn,
  useSetRefund,
  type ReturnDisposition,
  type ReturnItem,
  type SaleReturn,
} from './api';
import { ReturnStatusBadge } from './returns-page';

type Outcome = Exclude<ReturnDisposition, 'pending'>;

const OUTCOMES: { value: Outcome; label: string; description: string; icon: typeof PackageCheck }[] = [
  {
    value: 'restocked',
    label: 'Back in stock',
    description: 'The item is fine. It goes back into sellable stock.',
    icon: PackageCheck,
  },
  {
    value: 'damaged',
    label: 'Damaged',
    description: 'Written off. It never returns to stock.',
    icon: Ban,
  },
  {
    value: 'supplier',
    label: 'Send to supplier',
    description: 'Kept out of stock and sent back to the supplier.',
    icon: Truck,
  },
];

const OUTCOME_TONES: Record<ReturnDisposition, Tone> = {
  pending: 'warning',
  restocked: 'success',
  damaged: 'danger',
  supplier: 'info',
};

function InspectDialog({
  record,
  item,
  outcome,
  onClose,
}: {
  record: SaleReturn;
  item: ReturnItem;
  outcome: Outcome;
  onClose: () => void;
}) {
  const resolve = useResolveItem(record.id);
  const [note, setNote] = useState('');
  const choice = OUTCOMES.find((o) => o.value === outcome);
  return (
    <Dialog open onOpenChange={(open) => !open && !resolve.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {choice?.label}: {item.product?.name} × {formatQuantity(item.qty)}
          </DialogTitle>
          <DialogDescription>{choice?.description} This cannot be changed later.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="inspect-note">Inspection note</Label>
          <Textarea id="inspect-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={resolve.isPending}>
            Cancel
          </Button>
          <Button
            variant={outcome === 'damaged' ? 'destructive' : 'default'}
            disabled={resolve.isPending}
            onClick={() =>
              resolve
                .mutateAsync({ itemId: item.id, disposition: outcome, note: note.trim() || null })
                .then(() => {
                  toast.success(
                    `${item.product?.name ?? 'Item'}: ${DISPOSITION_LABELS[outcome].toLowerCase()}`,
                  );
                  onClose();
                })
                .catch(toastError)
            }
          >
            {resolve.isPending ? <Loader2 className="animate-spin" /> : null}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefundDialog({ record, onClose }: { record: SaleReturn; onClose: () => void }) {
  const setRefund = useSetRefund(record.id);
  const accounts = useReceivingAccounts();
  const [amount, setAmount] = useState(Number(record.refundAmount) > 0 ? record.refundAmount : '');
  const [method, setMethod] = useState<'cash' | 'online'>(record.refundMethod ?? 'cash');
  const [accountId, setAccountId] = useState(record.refundAccountSheet?.id ?? '');
  const [date, setDate] = useState(record.refundDate ?? isoDate());
  const valid = /^\d{1,10}(\.\d{1,2})?$/.test(amount) && Number(amount) > 0 && accountId;

  const save = (refund: Parameters<typeof setRefund.mutateAsync>[0]) =>
    setRefund
      .mutateAsync(refund)
      .then(() => {
        toast.success(refund ? 'Refund saved' : 'Refund removed');
        onClose();
      })
      .catch(toastError);

  return (
    <Dialog open onOpenChange={(open) => !open && !setRefund.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Refund for {record.returnNo}</DialogTitle>
          <DialogDescription>The refund is paid from an account and lowers its balance.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="refund-amount">Amount</Label>
            <Input
              id="refund-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => /^\d*(\.\d{0,2})?$/.test(e.target.value) && setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Method</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={method}
              onValueChange={(value) => value && setMethod(value as 'cash' | 'online')}
            >
              <ToggleGroupItem value="cash" className="h-9 px-3">
                Cash
              </ToggleGroupItem>
              <ToggleGroupItem value="online" className="h-9 px-3">
                Online
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-2">
            <Label>Paid from</Label>
            <Select value={accountId || undefined} onValueChange={setAccountId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose account" />
              </SelectTrigger>
              <SelectContent>
                {(accounts.data ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.accountName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund-date">Date</Label>
            <Input id="refund-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          {Number(record.refundAmount) > 0 ? (
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={setRefund.isPending}
              onClick={() => void save(null)}
            >
              Remove refund
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={setRefund.isPending}>
              Cancel
            </Button>
            <Button
              disabled={!valid || setRefund.isPending}
              onClick={() => void save({ amount, method, accountSheetId: accountId, date })}
            >
              {setRefund.isPending ? <Loader2 className="animate-spin" /> : null}
              Save refund
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReturnDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const query = useReturn(id);
  const remove = useRemoveReturn();
  const [inspecting, setInspecting] = useState<{ item: ReturnItem; outcome: Outcome } | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (query.isLoading) return <DetailSkeleton />;
  if (query.error || !query.data)
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const r = query.data;
  const canInspect = can('returns.update');
  const canRefund = can('returns.update') || can('returns.create');
  const untouched = r.items.every((i) => i.disposition === 'pending');

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
        <Link to="/returns">
          <ArrowLeft />
          Returns
        </Link>
      </Button>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {r.returnNo}
            <ReturnStatusBadge record={r} />
          </span>
        }
        description={`${REASON_LABELS[r.reason]} · received ${formatDate(r.date)} · sale ${r.sale?.invoiceNo ?? ''}`}
        actions={
          can('returns.delete') && untouched ? (
            <Button variant="outline" onClick={() => setRemoving(true)}>
              <Trash2 />
              Delete
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel
          title="Inspection"
          description="Decide each item once. Only “Back in stock” changes the stock."
          bodyClassName="p-0"
        >
          <ul className="divide-y">
            {r.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.product?.name}</span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      × {formatQuantity(item.qty)}
                    </span>
                    <StatusBadge tone={OUTCOME_TONES[item.disposition]}>
                      {DISPOSITION_LABELS[item.disposition]}
                    </StatusBadge>
                  </div>
                  {item.product?.barcode ? (
                    <div className="font-mono text-xs text-muted-foreground">{item.product.barcode}</div>
                  ) : null}
                  {item.resolvedAt ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(item.resolvedAt)}
                      {item.resolutionNote ? ` · ${item.resolutionNote}` : ''}
                    </div>
                  ) : null}
                </div>
                {item.disposition === 'pending' && canInspect ? (
                  <div className="flex flex-wrap gap-2">
                    {OUTCOMES.map((outcome) => (
                      <Button
                        key={outcome.value}
                        size="sm"
                        variant={outcome.value === 'restocked' ? 'default' : 'outline'}
                        onClick={() => setInspecting({ item, outcome: outcome.value })}
                      >
                        <outcome.icon />
                        {outcome.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-6">
          <Panel title="Details">
            <DetailList
              items={[
                {
                  label: 'Patient',
                  value: r.sale?.patient ? (
                    <Link to={`/patients/${r.sale.patient.id}`} className="text-primary hover:underline">
                      {r.sale.patient.name}
                    </Link>
                  ) : null,
                },
                { label: 'Phone', value: r.sale?.patient?.phone },
                { label: 'Sale', value: `${r.sale?.invoiceNo ?? ''} · ${formatDate(r.sale?.date)}` },
                { label: 'Total qty', value: formatQuantity(r.totalQty) },
              ]}
            />
            {r.note ? <p className="mt-4 border-t pt-4 text-sm whitespace-pre-wrap">{r.note}</p> : null}
          </Panel>
          <Panel
            title="Refund"
            actions={
              canRefund ? (
                <Button size="sm" variant="outline" onClick={() => setRefundOpen(true)}>
                  <Pencil />
                  {Number(r.refundAmount) > 0 ? 'Change' : 'Add refund'}
                </Button>
              ) : null
            }
          >
            {Number(r.refundAmount) > 0 ? (
              <DetailList
                items={[
                  { label: 'Amount', value: formatMoney(r.refundAmount) },
                  { label: 'Method', value: r.refundMethod === 'online' ? 'Online' : 'Cash' },
                  { label: 'Paid from', value: r.refundAccountSheet?.accountName },
                  { label: 'Date', value: formatDate(r.refundDate) },
                ]}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No money was refunded.</p>
            )}
          </Panel>
        </div>
      </div>

      {inspecting ? (
        <InspectDialog
          record={r}
          item={inspecting.item}
          outcome={inspecting.outcome}
          onClose={() => setInspecting(null)}
        />
      ) : null}
      {refundOpen ? <RefundDialog record={r} onClose={() => setRefundOpen(false)} /> : null}
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={`Delete ${r.returnNo}?`}
        description="Nothing was inspected yet, so stock is unchanged. Any refund on it is removed too."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          remove
            .mutateAsync(r.id)
            .then(() => {
              toast.success('Return deleted');
              void navigate('/returns');
            })
            .catch(toastError)
        }
      />
    </>
  );
}
