import { CheckCircle2, Loader2, PackageCheck, Printer, Truck } from 'lucide-react';
import { BarcodeScanInput } from '@/components/shared/barcode-scan-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { normalizeSerial } from './constants';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Link } from 'react-router';
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
import { TraceNumber } from '@/features/trace/trace-page';
import {
  useIncomingStock,
  useReceiveIncomingStockMutation,
  type IncomingStock,
  type ReceiveIssue,
} from '@redux/features/stock-requests';

type PieceState = 'waiting' | 'arrived' | 'missing' | 'damaged';

const PIECE_LABELS: Record<PieceState, string> = {
  waiting: 'Not scanned',
  arrived: 'Arrived',
  missing: 'Missing',
  damaged: 'Damaged',
};

function ReceiveDialog({ transfer, onClose }: { transfer: IncomingStock; onClose: () => void }) {
  const [receive, receiveState] = useReceiveIncomingStockMutation();
  const [date, setDate] = useState(isoDate());
  const serials = transfer.items.flatMap((item) => item.serials.map((serial) => ({ serial, item })));
  const [pieces, setPieces] = useState<Record<string, PieceState>>(() =>
    Object.fromEntries(serials.map(({ serial }) => [serial, 'waiting' as PieceState])),
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const busy = receiveState.isLoading;
  const count = (state: PieceState) => Object.values(pieces).filter((p) => p === state).length;
  const waiting = count('waiting');
  const set = (serial: string, state: PieceState) =>
    setPieces((current) => ({ ...current, [serial]: state }));

  const submit = () => {
    const issues: ReceiveIssue[] = Object.entries(pieces)
      .filter(([, state]) => state === 'missing' || state === 'damaged')
      .map(([serial, state]) => ({
        serial,
        reason: state as 'missing' | 'damaged',
        note: notes[serial]?.trim() || null,
      }));
    receive({ transferNo: transfer.transferNo, date, issues })
      .unwrap()
      .then(() => {
        toast.success(
          issues.length
            ? `${transfer.transferNo} received. ${issues.length} piece${issues.length === 1 ? '' : 's'} went under observation for the Super Admin.`
            : `${transfer.transferNo} received. The stock is in your branch now.`,
        );
        onClose();
      })
      .catch(toastError);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Count and receive {transfer.transferNo}</DialogTitle>
          <DialogDescription>
            Scan every piece that arrived. Mark the ones that did not come as Missing and the broken ones as
            Damaged: they go under observation for the Super Admin, everything else goes into your stock.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <div className="space-y-2">
              <Label htmlFor="receive-date">Receiving date</Label>
              <Input
                id="receive-date"
                type="date"
                value={date}
                min={transfer.date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            {serials.length ? (
              <div className="space-y-2">
                <Label>Scan what arrived</Label>
                <BarcodeScanInput
                  autoFocus
                  placeholder="Scan a label"
                  onScan={async (code) => {
                    const serial = normalizeSerial(code);
                    if (!(serial in pieces)) {
                      toast.error(`${serial} is not on ${transfer.transferNo}`);
                      return;
                    }
                    set(serial, 'arrived');
                  }}
                />
              </div>
            ) : null}
          </div>
          {serials.length ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge tone="success">Arrived {count('arrived')}</StatusBadge>
              <StatusBadge tone="danger">Missing {count('missing')}</StatusBadge>
              <StatusBadge tone="warning">Damaged {count('damaged')}</StatusBadge>
              <StatusBadge tone="neutral">Not scanned {waiting}</StatusBadge>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                disabled={busy || waiting === 0}
                onClick={() =>
                  setPieces((current) =>
                    Object.fromEntries(
                      Object.entries(current).map(([serial, state]) => [
                        serial,
                        state === 'waiting' ? 'arrived' : state,
                      ]),
                    ),
                  )
                }
              >
                Mark the rest as arrived
              </Button>
            </div>
          ) : null}
          {transfer.items.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-lg border">
              <div className="flex items-center justify-between gap-2 bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">{item.productName}</span>
                <span className="text-muted-foreground tabular-nums">
                  {item.serials.length
                    ? `${item.serials.filter((sn) => pieces[sn] === 'arrived').length} of ${formatQuantity(item.qty)} ${item.unit} arrived`
                    : `${formatQuantity(item.qty)} ${item.unit} · no labels`}
                </span>
              </div>
              {item.serials.length ? (
                <ul className="divide-y">
                  {item.serials.map((serial) => {
                    const state = pieces[serial] ?? 'waiting';
                    return (
                      <li key={serial} className="flex flex-wrap items-center gap-2 px-3 py-2">
                        <span
                          className={cn(
                            'w-32 font-mono text-sm',
                            state === 'arrived' && 'text-success',
                            (state === 'missing' || state === 'damaged') && 'text-destructive',
                          )}
                        >
                          {serial}
                        </span>
                        <Select value={state} onValueChange={(v) => set(serial, v as PieceState)}>
                          <SelectTrigger className="h-8 w-36" aria-label={`${serial} state`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(PIECE_LABELS) as PieceState[]).map((p) => (
                              <SelectItem key={p} value={p}>
                                {PIECE_LABELS[p]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {state === 'missing' || state === 'damaged' ? (
                          <Input
                            className="h-8 min-w-40 flex-1"
                            placeholder="What happened?"
                            maxLength={500}
                            value={notes[serial] ?? ''}
                            onChange={(e) =>
                              setNotes((current) => ({ ...current, [serial]: e.target.value }))
                            }
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          ))}
          {waiting ? (
            <p className="text-sm text-warning-soft-foreground">
              {waiting} piece{waiting === 1 ? ' is' : 's are'} not scanned yet. Scan them, or mark each one as
              Arrived, Missing or Damaged.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button disabled={busy || !date || waiting > 0} onClick={submit}>
            {busy ? <Loader2 className="animate-spin" /> : <PackageCheck />}
            Receive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferCard({ transfer, canReceive }: { transfer: IncomingStock; canReceive: boolean }) {
  const [counting, setCounting] = useState(false);
  const { isSuperAdmin, me } = useAuth();
  const overview = isSuperAdmin || me?.role === 'warehouse_keeper';
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <TraceNumber
              number={transfer.transferNo}
              className="font-mono text-sm font-semibold text-primary hover:underline"
            />
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
            {overview ? ` · to ${transfer.toBranch.name}` : ''}
            {transfer.received && transfer.receivedAt
              ? ` · received ${formatDateTime(transfer.receivedAt)} by ${transfer.receivedBy?.name ?? '—'}`
              : ''}
          </div>
        </div>
        {!transfer.received && canReceive ? (
          <Button onClick={() => setCounting(true)}>
            <PackageCheck />
            Count & receive
          </Button>
        ) : null}
        {transfer.received ? (
          <Button asChild variant="outline" size="sm">
            <Link to={`/print/transfer-receipt?transfer=${encodeURIComponent(transfer.transferNo)}`}>
              <Printer />
              Print receipt
            </Link>
          </Button>
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
      {counting ? <ReceiveDialog transfer={transfer} onClose={() => setCounting(false)} /> : null}
    </section>
  );
}

export function IncomingStockPage() {
  const { me, isSuperAdmin } = useAuth();
  const [status, setStatus] = useState<'waiting' | 'received' | 'all'>('waiting');
  const transfers = useIncomingStock(status === 'all' ? undefined : status);
  const canReceive = !isSuperAdmin && me?.role === 'branch_admin';
  const outgoing = isSuperAdmin || me?.role === 'warehouse_keeper';

  return (
    <>
      <PageHeader
        title={outgoing ? 'Outgoing stock' : 'Incoming stock'}
        description={
          outgoing
            ? 'Every transfer sent from the Super Admin stock: when it went, to which branch, and whether the branch has received it.'
            : canReceive
              ? 'Stock the Super Admin sent. Count it piece by piece, then receive it: what arrived goes into your stock, missing or damaged pieces go under observation for the Super Admin. Received transfers keep a printable receipt.'
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
          description={
            outgoing
              ? 'Transfers you send to the branches show here.'
              : 'Transfers from the Super Admin stock show here.'
          }
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
