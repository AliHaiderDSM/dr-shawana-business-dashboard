import {
  ArrowLeft,
  Ban,
  CalendarX,
  Check,
  ChevronDown,
  ClipboardCheck,
  Loader2,
  PackageCheck,
  Pencil,
  ShieldAlert,
  Trash2,
  Truck,
  Undo2,
  Wallet,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { PrintButton } from '@/components/shared/print-button';
import { StatCard } from '@/components/shared/stat-card';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useReceivingAccounts } from '@redux/features/appointments';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatDateTime, formatMoney, formatQuantity, isoDate } from '@/lib/format';
import {
  useRemoveReturnMutation,
  useDecideReturnItemMutation,
  useResolveReturnItemMutation,
  useReturn,
  useSetReturnRefundMutation,
  type RefundInput,
  type ReturnDisposition,
  type ReturnItem,
  type SaleReturn,
} from '@redux/features/returns';
import { DISPOSITION_LABELS, REASON_LABELS } from './constants';
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
    value: 'expired',
    label: 'Expired',
    description: 'Past its expiry date. Written off, never back in stock.',
    icon: CalendarX,
  },
  {
    value: 'supplier',
    label: 'Send to supplier',
    description: 'Kept out of stock and sent back to the supplier.',
    icon: Truck,
  },
  {
    value: 'quarantined',
    label: 'Quarantine',
    description: 'Hold it aside for a closer check. Decide the final outcome later.',
    icon: ShieldAlert,
  },
];

const OUTCOME_TONES: Record<ReturnDisposition, Tone> = {
  pending: 'warning',
  quarantined: 'warning',
  restocked: 'success',
  damaged: 'danger',
  expired: 'danger',
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
  const [resolve, resolveState] = useResolveReturnItemMutation();
  const { isSuperAdmin, me } = useAuth();
  const [note, setNote] = useState('');
  const choice = OUTCOMES.find((o) => o.value === outcome);
  const sellerAdmin = me?.role === 'branch_admin' && me.branch?.id === record.branchId;
  const proposing = record.sale?.saleType === 'online' && !isSuperAdmin && !sellerAdmin;
  return (
    <Dialog open onOpenChange={(open) => !open && !resolveState.isLoading && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {choice?.label}: {item.product?.name} × {formatQuantity(item.qty)}
          </DialogTitle>
          <DialogDescription>
            {proposing
              ? `${choice?.description ?? ''} This is an online return: it goes to the admin of the branch that made the sale, and the stock changes only after approval.`
              : `${choice?.description ?? ''} This cannot be changed later.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="inspect-note">Inspection note</Label>
          <Textarea id="inspect-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={resolveState.isLoading}>
            Cancel
          </Button>
          <Button
            variant={outcome === 'damaged' ? 'destructive' : 'default'}
            disabled={resolveState.isLoading}
            onClick={() =>
              resolve({
                returnId: record.id,
                itemId: item.id,
                disposition: outcome,
                note: note.trim() || null,
              })
                .unwrap()
                .then(() => {
                  toast.success(
                    proposing
                      ? `${item.product?.name ?? 'Item'}: sent for approval as ${DISPOSITION_LABELS[outcome].toLowerCase()}`
                      : `${item.product?.name ?? 'Item'}: ${DISPOSITION_LABELS[outcome].toLowerCase()}`,
                  );
                  onClose();
                })
                .catch(toastError)
            }
          >
            {resolveState.isLoading ? <Loader2 className="animate-spin" /> : null}
            {proposing ? 'Send for approval' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefundDialog({ record, onClose }: { record: SaleReturn; onClose: () => void }) {
  const [setRefund, setRefundState] = useSetReturnRefundMutation();
  const accounts = useReceivingAccounts();
  const [amount, setAmount] = useState(Number(record.refundAmount) > 0 ? record.refundAmount : '');
  const [method, setMethod] = useState<'cash' | 'online'>(record.refundMethod ?? 'cash');
  const [accountId, setAccountId] = useState(record.refundAccountSheet?.id ?? '');
  const [date, setDate] = useState(record.refundDate ?? isoDate());
  const valid = /^\d{1,10}(\.\d{1,2})?$/.test(amount) && Number(amount) > 0 && accountId;

  const save = (refund: RefundInput | null) =>
    setRefund({ returnId: record.id, refund })
      .unwrap()
      .then(() => {
        toast.success(refund ? 'Refund saved' : 'Refund removed');
        onClose();
      })
      .catch(toastError);

  return (
    <Dialog open onOpenChange={(open) => !open && !setRefundState.isLoading && onClose()}>
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
              disabled={setRefundState.isLoading}
              onClick={() => void save(null)}
            >
              Remove refund
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={setRefundState.isLoading}>
              Cancel
            </Button>
            <Button
              disabled={!valid || setRefundState.isLoading}
              onClick={() => void save({ amount, method, accountSheetId: accountId, date })}
            >
              {setRefundState.isLoading ? <Loader2 className="animate-spin" /> : null}
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
  const { can, isSuperAdmin, me } = useAuth();
  const query = useReturn(id);
  const [decide, decideState] = useDecideReturnItemMutation();
  const [remove] = useRemoveReturnMutation();
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

  const decided = r.items.filter(
    (i) => i.disposition !== 'pending' && i.disposition !== 'quarantined',
  ).length;
  const backInStock = r.items
    .filter((i) => i.disposition === 'restocked')
    .reduce((sum, i) => sum + Number(i.qty), 0);
  const soldFrom = (productId: string) => (r.soldBatches ?? []).filter((b) => b.productId === productId);
  const restockedInto = (productId: string) =>
    (r.restockedBatches ?? []).filter((b) => b.productId === productId);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground print:hidden">
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
        description={`${REASON_LABELS[r.reason]} · received ${formatDate(r.date)}`}
        actions={
          <>
            <PrintButton />
            {can('returns.delete') && untouched ? (
              <Button variant="outline" onClick={() => setRemoving(true)}>
                <Trash2 />
                Delete
              </Button>
            ) : null}
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Items returned" value={formatQuantity(r.totalQty)} icon={Undo2} />
        <StatCard
          label="Inspected"
          value={`${decided} of ${r.items.length}`}
          icon={ClipboardCheck}
          tone={decided === r.items.length ? undefined : 'warning'}
        />
        <StatCard label="Back in stock" value={formatQuantity(backInStock)} icon={PackageCheck} />
        <StatCard
          label="Refunded"
          value={Number(r.refundAmount) > 0 ? formatMoney(r.refundAmount) : 'None'}
          icon={Wallet}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel
          title="Items and inspection"
          description="Decide each item once (quarantine can be decided later). Only “Back in stock” adds stock, into the batch it was sold from."
          bodyClassName="p-0"
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 [&>th]:h-10 [&>th]:text-xs [&>th]:font-medium [&>th]:text-muted-foreground">
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Sold from batch</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="text-right print:hidden" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.items.map((item) => {
                const open = item.disposition === 'pending' || item.disposition === 'quarantined';
                const others = OUTCOMES.filter(
                  (o) =>
                    o.value !== 'restocked' && (item.disposition === 'pending' || o.value !== 'quarantined'),
                );
                return (
                  <TableRow key={item.id} className="align-top hover:bg-transparent">
                    <TableCell className="py-3">
                      <div className="font-medium">{item.product?.name}</div>
                      {item.serial ? (
                        <Link
                          to={`/inventory/labels/${item.serial}`}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {item.serial}
                        </Link>
                      ) : item.product?.barcode ? (
                        <div className="font-mono text-xs text-muted-foreground">{item.product.barcode}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-3 text-right tabular-nums">{formatQuantity(item.qty)}</TableCell>
                    <TableCell className="py-3 text-sm">
                      {soldFrom(item.productId).length ? (
                        soldFrom(item.productId).map((b) => (
                          <div key={b.batchId ?? 'none'} className="whitespace-nowrap">
                            <span className="font-mono">{b.batchNo ?? 'No batch'}</span>
                            {b.expiryDate ? (
                              <span className="text-muted-foreground"> · exp {formatDate(b.expiryDate)}</span>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <StatusBadge tone={OUTCOME_TONES[item.disposition]}>
                        {DISPOSITION_LABELS[item.disposition]}
                      </StatusBadge>
                      {restockedInto(item.productId).map((b) => (
                        <div
                          key={b.batchId ?? 'none'}
                          className="mt-1 text-xs whitespace-nowrap text-success"
                        >
                          Into batch <span className="font-mono">{b.batchNo ?? '—'}</span> ·{' '}
                          {formatQuantity(b.qty)}
                        </div>
                      ))}
                      {item.resolvedAt ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(item.resolvedAt)}
                        </div>
                      ) : null}
                      {open && item.proposedDisposition ? (
                        <div className="mt-1.5 rounded-md border border-warning/40 bg-warning-soft px-2 py-1 text-xs text-warning-soft-foreground">
                          Checked as{' '}
                          <strong>{DISPOSITION_LABELS[item.proposedDisposition].toLowerCase()}</strong>
                          {item.proposedAt ? ` on ${formatDateTime(item.proposedAt)}` : ''} · waiting for the
                          Super Admin
                          {item.proposalNote ? (
                            <div className="mt-0.5 whitespace-pre-wrap">{item.proposalNote}</div>
                          ) : null}
                        </div>
                      ) : null}
                      {item.resolutionNote ? (
                        <div className="mt-0.5 max-w-56 text-xs whitespace-pre-wrap text-muted-foreground">
                          {item.resolutionNote}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-3 text-right print:hidden">
                      {open &&
                      item.proposedDisposition &&
                      (isSuperAdmin || (me?.role === 'branch_admin' && me.branch?.id === r.branchId)) ? (
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            disabled={decideState.isLoading}
                            onClick={() =>
                              decide({
                                returnId: id,
                                itemId: item.id,
                                approve: true,
                                asSuperAdmin: isSuperAdmin,
                              })
                                .unwrap()
                                .then(() => toast.success(`${item.product?.name ?? 'Item'} approved`))
                                .catch(toastError)
                            }
                          >
                            <Check />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={decideState.isLoading}
                            onClick={() =>
                              decide({
                                returnId: id,
                                itemId: item.id,
                                approve: false,
                                asSuperAdmin: isSuperAdmin,
                              })
                                .unwrap()
                                .then(() => toast.success('Sent back to be checked again'))
                                .catch(toastError)
                            }
                          >
                            <X />
                            Reject
                          </Button>
                        </div>
                      ) : open &&
                        item.proposedDisposition &&
                        !isSuperAdmin &&
                        r.sale?.saleType === 'online' ? (
                        <span className="text-xs text-muted-foreground">Waiting for approval</span>
                      ) : open && canInspect ? (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" onClick={() => setInspecting({ item, outcome: 'restocked' })}>
                            <PackageCheck />
                            Back in stock
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline">
                                Other
                                <ChevronDown />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              {others.map((o) => (
                                <DropdownMenuItem
                                  key={o.value}
                                  variant={
                                    o.value === 'damaged' || o.value === 'expired' ? 'destructive' : 'default'
                                  }
                                  onSelect={() => setInspecting({ item, outcome: o.value })}
                                >
                                  <o.icon />
                                  {o.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Panel>
        <div className="space-y-6">
          <Panel title="Customer and sale">
            <DetailList
              items={[
                {
                  label: 'Customer',
                  value: r.sale?.patient ? (
                    <Link to={`/patients/${r.sale.patient.id}`} className="text-primary hover:underline">
                      {r.sale.patient.name}
                    </Link>
                  ) : null,
                },
                { label: 'Phone', value: r.sale?.patient?.phone },
                {
                  label: 'Sale',
                  value: r.sale ? (
                    <Link to={`/sales/${r.sale.id}`} className="text-primary hover:underline">
                      {r.sale.invoiceNo}
                    </Link>
                  ) : null,
                },
                { label: 'Sale date', value: formatDate(r.sale?.date) },
                { label: 'Reason', value: REASON_LABELS[r.reason] },
                { label: 'Received', value: formatDate(r.date) },
              ]}
            />
            {r.note ? (
              <div className="mt-4 border-t pt-4">
                <div className="text-xs text-muted-foreground">Note</div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{r.note}</p>
              </div>
            ) : null}
          </Panel>
          <Panel
            title="Refund"
            description="Paid from an account. It lowers that account's balance."
            actions={
              canRefund ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="print:hidden"
                  onClick={() => setRefundOpen(true)}
                >
                  <Pencil />
                  {Number(r.refundAmount) > 0 ? 'Change' : 'Add refund'}
                </Button>
              ) : null
            }
          >
            {Number(r.refundAmount) > 0 ? (
              <DetailList
                items={[
                  {
                    label: 'Amount',
                    value: <span className="font-semibold">{formatMoney(r.refundAmount)}</span>,
                  },
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
          remove(r.id)
            .unwrap()
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
