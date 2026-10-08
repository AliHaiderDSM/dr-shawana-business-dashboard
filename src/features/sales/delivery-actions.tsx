import { CheckCircle2, Loader2, Printer, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useHref } from 'react-router';
import { toast } from 'sonner';
import { BarcodeScanInput } from '@/components/shared/barcode-scan-input';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { StatusBadge, type Tone } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useReceivingAccounts } from '@/features/appointments/payment-fields';
import { productsApi } from '@/features/catalog/api';
import { findItemBySerial, normalizeSerial } from '@/features/inventory/api';
import { toastError } from '@/lib/api/errors';
import { formatDate, formatMoney, formatQuantity, isoDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  DELIVERY_LABELS,
  salesApi,
  useCancelOrder,
  useDispatchOrder,
  useDeliverySlips,
  useSetDelivery,
  type DeliveryStatus,
} from './api';
import { slipPrintPath, slipQuery } from './delivery-report';

const DELIVERY_TONES: Record<DeliveryStatus, Tone> = {
  pending: 'warning',
  dispatched: 'info',
  delivered: 'success',
  returned: 'danger',
  cancelled: 'neutral',
};

export function DeliveryBadge({ status }: { status: DeliveryStatus | null | undefined }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return <StatusBadge tone={DELIVERY_TONES[status]}>{DELIVERY_LABELS[status]}</StatusBadge>;
}

export interface OrderRef {
  id: string;
  invoiceNo: string;
  date: string;
  received?: string;
}

const shortAddress = (address: string | null) => {
  if (!address) return '—';
  const words = address.trim().split(/\s+/);
  return words.length > 10 ? `${words.slice(0, 10).join(' ')}...` : address;
};

function DispatchDialog({ order, onClose }: { order: OrderRef; onClose: () => void }) {
  const sale = salesApi.useDetail(order.id);
  const products = productsApi.useOptions();
  const dispatch = useDispatchOrder();
  const slips = useDeliverySlips(slipQuery(order));
  const slip = slips.data?.slips.find((s) => s.saleId === order.id);
  const [date, setDate] = useState(isoDate());
  const [pieces, setPieces] = useState<{ serial: string; productId: string }[]>([]);
  const tracked = new Set((products.data ?? []).filter((p) => p.trackSerials).map((p) => p.id));
  const lines = new Map<string, { productId: string; name: string; qty: number }>();
  for (const item of sale.data?.items ?? []) {
    const line = lines.get(item.productId) ?? {
      productId: item.productId,
      name: item.product?.name ?? 'Product',
      qty: 0,
    };
    line.qty += Number(item.qty);
    lines.set(item.productId, line);
  }
  const rows = [...lines.values()];
  const scannedFor = (productId: string) => pieces.filter((p) => p.productId === productId);
  const needsScan = rows.some((r) => tracked.has(r.productId));
  const complete = rows.every((r) => !tracked.has(r.productId) || scannedFor(r.productId).length === r.qty);
  const printable = rows.flatMap((r) => {
    const qty = tracked.has(r.productId) ? scannedFor(r.productId).length : r.qty;
    return qty > 0 ? [{ productId: r.productId, qty }] : [];
  });
  const printHref = useHref(slipPrintPath(order, printable));

  const scan = async (code: string) => {
    try {
      const piece = await findItemBySerial(normalizeSerial(code));
      const line = lines.get(piece.productId);
      if (!line) {
        toast.error(`${piece.serial} is ${piece.productName}, which is not on this order`);
        return;
      }
      if (piece.status !== 'in_stock') {
        toast.error(`${piece.serial} is ${piece.status.replace(/_/g, ' ')}`);
        return;
      }
      if (pieces.some((p) => p.serial === piece.serial)) {
        toast.error(`${piece.serial} is already scanned`);
        return;
      }
      if (scannedFor(piece.productId).length >= line.qty) {
        toast.error(`All ${line.qty} ${line.name} are already scanned`);
        return;
      }
      setPieces((current) => [...current, { serial: piece.serial, productId: piece.productId }]);
    } catch (error) {
      toastError(error);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !dispatch.isPending && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Dispatch {order.invoiceNo}</DialogTitle>
          <DialogDescription>
            Ordered on {formatDate(order.date)}. The stock leaves the inventory on the dispatch date.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="dispatch-date">Dispatch date</Label>
              <Input
                id="dispatch-date"
                type="date"
                min={order.date}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            {needsScan ? (
              <BarcodeScanInput onScan={scan} autoFocus placeholder="Scan each DSM label" />
            ) : null}
          </div>
          {slip ? (
            <section className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 px-4 py-3">
              <dl className="grid min-w-0 flex-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,2fr)]">
                {(
                  [
                    ['Customer', slip.to.name],
                    ['Phone', slip.to.phone],
                    ['City', slip.to.city],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="truncate font-medium">{value || '—'}</dd>
                  </div>
                ))}
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Address</dt>
                  <dd className="font-medium" title={slip.to.address ?? undefined}>
                    {shortAddress(slip.to.address)}
                  </dd>
                </div>
              </dl>
              <Button
                size="icon"
                variant="outline"
                aria-label="Print dispatch slip"
                title="Print dispatch slip"
                disabled={printable.length === 0}
                onClick={() => window.open(printHref, '_blank')}
              >
                <Printer />
              </Button>
            </section>
          ) : null}
          {sale.isLoading || products.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Product</th>
                    <th className="w-16 px-3 py-2 text-right font-medium">Qty</th>
                    <th className="w-24 px-3 py-2 text-right font-medium">Scanned</th>
                    <th className="px-3 py-2 text-left font-medium">DSM labels</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => {
                    const isTracked = tracked.has(row.productId);
                    const scanned = scannedFor(row.productId);
                    const done = !isTracked || scanned.length === row.qty;
                    return (
                      <tr key={row.productId} className="align-middle">
                        <td className="max-w-56 truncate px-4 py-2 font-medium" title={row.name}>
                          {row.name}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatQuantity(row.qty)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                          {isTracked ? `${scanned.length} / ${row.qty}` : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {!isTracked ? (
                            <span className="text-xs text-muted-foreground">
                              Not labelled · batch that expires first
                            </span>
                          ) : scanned.length ? (
                            <div className="flex flex-wrap gap-1">
                              {scanned.map((p) => (
                                <span
                                  key={p.serial}
                                  className="inline-flex items-center gap-0.5 rounded-md border bg-muted/50 py-0.5 pr-0.5 pl-1.5 font-mono text-[11px]"
                                >
                                  {p.serial}
                                  <button
                                    type="button"
                                    className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                    aria-label={`Remove ${p.serial}`}
                                    onClick={() =>
                                      setPieces((current) => current.filter((x) => x.serial !== p.serial))
                                    }
                                  >
                                    <X className="size-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Scan its labels</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <CheckCircle2
                            className={cn('size-5', done ? 'text-success' : 'text-muted-foreground/40')}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={dispatch.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!complete || !date || dispatch.isPending || sale.isLoading}
            onClick={() =>
              dispatch
                .mutateAsync({ id: order.id, date, serials: pieces.map((p) => p.serial) })
                .then(() => {
                  toast.success(`${order.invoiceNo} dispatched`);
                  onClose();
                })
                .catch(toastError)
            }
          >
            {dispatch.isPending ? <Loader2 className="animate-spin" /> : null}
            Dispatch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelOrderDialog({ order, onClose }: { order: OrderRef; onClose: () => void }) {
  const cancel = useCancelOrder();
  const received = Number(order.received ?? 0);
  const accounts = useReceivingAccounts(received > 0);
  const [refund, setRefund] = useState(received > 0);
  const [amount, setAmount] = useState(received > 0 ? String(received) : '');
  const [method, setMethod] = useState<'cash' | 'online'>('online');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(isoDate());
  const validRefund = /^\d{1,10}(\.\d{1,2})?$/.test(amount) && Number(amount) > 0 && Boolean(accountId);

  return (
    <Dialog open onOpenChange={(open) => !open && !cancel.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel {order.invoiceNo}?</DialogTitle>
          <DialogDescription>
            The order was not dispatched, so nothing leaves the stock. Its booked stock is freed for other
            sales.
          </DialogDescription>
        </DialogHeader>
        {received > 0 ? (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={refund} onCheckedChange={(v) => setRefund(v === true)} />
              Refund the customer ({formatMoney(received)} was received)
            </label>
            {refund ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cancel-amount">Amount</Label>
                  <Input
                    id="cancel-amount"
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
                    onValueChange={(v) => v && setMethod(v as 'cash' | 'online')}
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
                  <Label htmlFor="cancel-date">Date</Label>
                  <Input
                    id="cancel-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={cancel.isPending}>
            Keep order
          </Button>
          <Button
            variant="destructive"
            disabled={cancel.isPending || (refund && received > 0 && !validRefund)}
            onClick={() =>
              cancel
                .mutateAsync({
                  id: order.id,
                  refund: refund && received > 0 ? { amount, method, accountSheetId: accountId, date } : null,
                })
                .then(() => {
                  toast.success(`${order.invoiceNo} cancelled`);
                  onClose();
                })
                .catch(toastError)
            }
          >
            {cancel.isPending ? <Loader2 className="animate-spin" /> : null}
            Cancel order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Pending =
  { kind: 'dispatch' | 'cancel'; order: OrderRef } | { kind: 'delivered' | 'returned'; order: OrderRef };

export function useOrderActions() {
  const setDelivery = useSetDelivery();
  const [pending, setPending] = useState<Pending | null>(null);
  const close = () => setPending(null);
  const confirm = pending && (pending.kind === 'delivered' || pending.kind === 'returned') ? pending : null;

  const dialogs: ReactNode = (
    <>
      {pending?.kind === 'dispatch' ? <DispatchDialog order={pending.order} onClose={close} /> : null}
      {pending?.kind === 'cancel' ? <CancelOrderDialog order={pending.order} onClose={close} /> : null}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && close()}
        title={
          confirm?.kind === 'returned'
            ? `Mark ${confirm.order.invoiceNo} as returned?`
            : `Mark ${confirm?.order.invoiceNo ?? ''} as delivered?`
        }
        description={
          confirm?.kind === 'returned'
            ? 'Everything on the order goes to the returns section for inspection. Stock changes only after inspection.'
            : 'The parcel reached the customer.'
        }
        confirmLabel={confirm?.kind === 'returned' ? 'Mark returned' : 'Mark delivered'}
        destructive={confirm?.kind === 'returned'}
        onConfirm={() =>
          confirm
            ? setDelivery
                .mutateAsync({ id: confirm.order.id, status: confirm.kind })
                .then(() =>
                  toast.success(`${confirm.order.invoiceNo}: ${DELIVERY_LABELS[confirm.kind].toLowerCase()}`),
                )
                .catch(toastError)
            : undefined
        }
      />
    </>
  );

  return {
    dispatch: (order: OrderRef) => setPending({ kind: 'dispatch', order }),
    cancel: (order: OrderRef) => setPending({ kind: 'cancel', order }),
    delivered: (order: OrderRef) => setPending({ kind: 'delivered', order }),
    returned: (order: OrderRef) => setPending({ kind: 'returned', order }),
    dialogs,
  };
}
