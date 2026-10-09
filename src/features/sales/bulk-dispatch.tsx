import { CheckCircle2, Loader2, Printer, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { BarcodeScanInput } from '@/components/shared/barcode-scan-input';
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
import { findItemBySerial, normalizeSerial } from '@/features/inventory/api';
import { toastError } from '@/lib/api/errors';
import { formatDate, formatQuantity, isoDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useDispatchOrder, type DeliveryOrder } from './api';

interface Piece {
  serial: string;
  productId: string;
  orderId: string;
}

const linesOf = (order: DeliveryOrder) => {
  const lines = new Map<string, { productId: string; name: string; qty: number; tracked: boolean }>();
  for (const item of order.items) {
    const line = lines.get(item.productId) ?? {
      productId: item.productId,
      name: item.name,
      qty: 0,
      tracked: item.tracked,
    };
    line.qty += Number(item.qty);
    lines.set(item.productId, line);
  }
  return [...lines.values()];
};

export function BulkDispatchDialog({ orders, onClose }: { orders: DeliveryOrder[]; onClose: () => void }) {
  const navigate = useNavigate();
  const dispatch = useDispatchOrder();
  const [date, setDate] = useState(isoDate());
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);

  const scannedFor = (orderId: string, productId: string) =>
    pieces.filter((p) => p.orderId === orderId && p.productId === productId);
  const complete = (order: DeliveryOrder) =>
    linesOf(order).every((l) => !l.tracked || scannedFor(order.id, l.productId).length === l.qty);
  const ready = orders.filter((o) => complete(o) && !skipped.has(o.id));

  const scan = async (code: string) => {
    try {
      const piece = await findItemBySerial(normalizeSerial(code));
      if (pieces.some((p) => p.serial === piece.serial)) {
        toast.error(`${piece.serial} is already scanned`);
        return;
      }
      if (piece.status !== 'in_stock') {
        toast.error(`${piece.serial} is ${piece.status.replace(/_/g, ' ')}`);
        return;
      }
      const target = orders.find((o) =>
        linesOf(o).some(
          (l) => l.tracked && l.productId === piece.productId && scannedFor(o.id, l.productId).length < l.qty,
        ),
      );
      if (!target) {
        toast.error(`${piece.serial} (${piece.productName}) is not needed by any waiting order`);
        return;
      }
      setPieces((current) => [
        ...current,
        { serial: piece.serial, productId: piece.productId, orderId: target.id },
      ]);
      setSkipped((current) => {
        const next = new Set(current);
        next.delete(target.id);
        return next;
      });
    } catch (error) {
      toastError(error);
    }
  };

  const run = async () => {
    setWorking(true);
    const done: string[] = [];
    for (const order of ready) {
      try {
        await dispatch.mutateAsync({
          id: order.id,
          date,
          serials: pieces.filter((p) => p.orderId === order.id).map((p) => p.serial),
        });
        done.push(order.id);
      } catch (error) {
        toastError(error);
      }
    }
    setWorking(false);
    if (done.length === 0) return;
    toast.success(`${done.length} ${done.length === 1 ? 'order' : 'orders'} dispatched`);
    onClose();
    void navigate(`/print/delivery-slips?saleIds=${done.join(',')}`);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !working && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Scan &amp; print waiting orders</DialogTitle>
          <DialogDescription>
            Scan every DSM label of the parcels. Each label goes to the oldest waiting order that needs it.
            Ready orders are dispatched together and their slips print two per A4 page.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="bulk-dispatch-date">Dispatch date</Label>
              <Input
                id="bulk-dispatch-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <BarcodeScanInput onScan={scan} autoFocus placeholder="Scan each DSM label" />
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2 text-left font-medium">Order</th>
                  <th className="px-3 py-2 text-left font-medium">Customer</th>
                  <th className="px-3 py-2 text-left font-medium">Products and labels</th>
                  <th className="w-28 px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order) => {
                  const isComplete = complete(order);
                  const included = isComplete && !skipped.has(order.id);
                  return (
                    <tr key={order.id} className={cn('align-top', included && 'bg-success-soft/40')}>
                      <td className="px-3 py-2.5">
                        <Checkbox
                          aria-label={`Include ${order.invoiceNo}`}
                          checked={included}
                          disabled={!isComplete}
                          onCheckedChange={(value) =>
                            setSkipped((current) => {
                              const next = new Set(current);
                              if (value === true) next.delete(order.id);
                              else next.add(order.id);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="font-medium">{order.invoiceNo}</div>
                        <div className="text-xs text-muted-foreground">booked {formatDate(order.date)}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{order.customer?.name ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">{order.city}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <ul className="space-y-1">
                          {linesOf(order).map((line) => {
                            const scanned = scannedFor(order.id, line.productId);
                            return (
                              <li key={line.productId} className="flex flex-wrap items-center gap-1.5">
                                <span>
                                  {line.name}{' '}
                                  <span className="text-muted-foreground tabular-nums">
                                    × {formatQuantity(line.qty)}
                                  </span>
                                </span>
                                {line.tracked ? (
                                  <span className="text-xs text-muted-foreground tabular-nums">
                                    {scanned.length}/{line.qty}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">not labelled</span>
                                )}
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
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                      <td className="px-3 py-2.5">
                        {isComplete ? (
                          <span className="inline-flex items-center gap-1 text-success">
                            <CheckCircle2 className="size-4" />
                            Ready
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Scan labels</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={working}>
            Close
          </Button>
          <Button disabled={ready.length === 0 || !date || working} onClick={() => void run()}>
            {working ? <Loader2 className="animate-spin" /> : <Printer />}
            Dispatch {ready.length || ''} &amp; print slips
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
