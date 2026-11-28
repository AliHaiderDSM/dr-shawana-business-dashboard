import { CheckCircle2, Clock, Loader2, PackageCheck, Pencil, Printer, Tags } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { BarcodeScanInput } from '@/components/shared/barcode-scan-input';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { MoneyInput } from '@/components/shared/money-input';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TraceNumber } from '@/features/trace/trace-page';
import { toastError } from '@/lib/api/errors';
import type { Schemas } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatDateTime, formatQuantity, isoDate } from '@/lib/format';
import { useConfirmStoreReceiptMutation, useStoreReceipts } from '@redux/features/inventory';
import { cn } from '@/lib/utils';
import { normalizeSerial } from './constants';
import { GrnEditRequests, GrnEditSheet } from './grn-edit';

type Receipt = Schemas['StoreReceipt'];
type Line = Receipt['lines'][number];

interface Count {
  received: string;
  note: string;
}

type PieceState = 'waiting' | 'arrived' | 'missing' | 'damaged';

const PIECE_LABELS: Record<PieceState, string> = {
  waiting: 'Not scanned',
  arrived: 'Arrived',
  missing: 'Missing',
  damaged: 'Damaged',
};

function ConfirmDialog({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  const [confirm, confirmState] = useConfirmStoreReceiptMutation();
  const navigate = useNavigate();
  const [date, setDate] = useState(isoDate());
  const plain = receipt.lines.filter((l) => l.serials.length === 0);
  const labelled = receipt.lines.filter((l) => l.serials.length > 0);
  const [counts, setCounts] = useState<Record<string, Count>>(() =>
    Object.fromEntries(plain.map((l) => [l.id, { received: String(Number(l.qty)), note: '' }])),
  );
  const [pieces, setPieces] = useState<Record<string, PieceState>>(() =>
    Object.fromEntries(labelled.flatMap((l) => l.serials.map((serial) => [serial, 'waiting' as PieceState]))),
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const busy = confirmState.isLoading;
  const update = (id: string, change: Partial<Count>) =>
    setCounts((current) => ({ ...current, [id]: { ...current[id]!, ...change } }));
  const setPiece = (serial: string, state: PieceState) =>
    setPieces((current) => ({ ...current, [serial]: state }));
  const shortOf = (line: Line) => Number(line.qty) - (Number(counts[line.id]?.received) || 0);
  const count = (state: PieceState) => Object.values(pieces).filter((p) => p === state).length;
  const waiting = count('waiting');
  const invalid =
    waiting > 0 ||
    plain.some((l) => {
      const c = counts[l.id];
      const received = Number(c?.received);
      return !c || c.received === '' || received < 0 || received > Number(l.qty);
    });

  const submit = () =>
    confirm({
      grnNo: receipt.grnNo,
      body: {
        date,
        lines: plain
          .filter((l) => shortOf(l) > 0)
          .map((l) => ({
            id: l.id,
            receivedQty: counts[l.id]!.received,
            note: counts[l.id]!.note.trim() || null,
          })),
        issues: Object.entries(pieces)
          .filter(([, state]) => state === 'missing' || state === 'damaged')
          .map(([serial, state]) => ({
            serial,
            reason: state as 'missing' | 'damaged',
            note: notes[serial]?.trim() || null,
          })),
      },
    })
      .unwrap()
      .then(() => {
        toast.success(`${receipt.grnNo} confirmed. It is in the Super Admin stock now.`);
        onClose();
        void navigate(`/print/store-receipt?grn=${encodeURIComponent(receipt.grnNo)}`);
      })
      .catch(toastError);

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Count and confirm {receipt.grnNo}</DialogTitle>
          <DialogDescription>
            Scan every labelled piece that arrived and mark the rest Missing or Damaged: they go under
            observation for the Super Admin. For a product without labels, change the received quantity if it
            is short and say why.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <div className="space-y-2">
              <Label htmlFor="receipt-date">Date received</Label>
              <Input
                id="receipt-date"
                type="date"
                value={date}
                min={receipt.date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            {labelled.length ? (
              <div className="space-y-2">
                <Label>Scan what arrived</Label>
                <BarcodeScanInput
                  autoFocus
                  placeholder="Scan a label"
                  onScan={async (code) => {
                    const serial = normalizeSerial(code);
                    if (!(serial in pieces)) {
                      toast.error(`${serial} is not on ${receipt.grnNo}`);
                      return;
                    }
                    setPiece(serial, 'arrived');
                  }}
                />
              </div>
            ) : null}
          </div>
          {labelled.length ? (
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
          <ul className="divide-y rounded-lg border">
            {receipt.lines.map((line) => {
              const meta = (
                <div className="text-xs text-muted-foreground">
                  Entered {formatQuantity(line.qty)} {line.unit}
                  {line.batch ? ` · batch ${line.batch}` : ''}
                  {line.expiryDate ? ` · expires ${formatDate(line.expiryDate)}` : ''}
                </div>
              );
              if (line.serials.length) {
                const arrived = line.serials.filter((sn) => pieces[sn] === 'arrived').length;
                return (
                  <li key={line.id} className="space-y-2 px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">{line.productName}</div>
                        {meta}
                      </div>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {arrived} of {formatQuantity(line.qty)} {line.unit} arrived
                      </span>
                    </div>
                    <ul className="divide-y rounded-md border">
                      {line.serials.map((serial) => {
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
                            <Select value={state} onValueChange={(v) => setPiece(serial, v as PieceState)}>
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
                  </li>
                );
              }
              const c = counts[line.id]!;
              const short = shortOf(line);
              return (
                <li key={line.id} className="space-y-2 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-40 flex-1">
                      <div className="font-medium">{line.productName}</div>
                      {meta}
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`received-${line.id}`} className="text-xs text-muted-foreground">
                        Received
                      </Label>
                      <MoneyInput
                        id={`received-${line.id}`}
                        prefix=""
                        decimals={3}
                        className="h-9 w-24 text-right"
                        value={c.received}
                        onChange={(e) => update(line.id, { received: e.target.value })}
                      />
                    </div>
                    {short > 0 ? (
                      <StatusBadge tone="warning">{formatQuantity(String(short))} short</StatusBadge>
                    ) : (
                      <CheckCircle2 className="size-5 text-success" />
                    )}
                  </div>
                  {short > 0 ? (
                    <Input
                      placeholder="Why is it short? (broken, not sent…)"
                      maxLength={500}
                      value={c.note}
                      onChange={(e) => update(line.id, { note: e.target.value })}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
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
          <Button disabled={invalid || busy} onClick={submit}>
            {busy ? <Loader2 className="animate-spin" /> : <PackageCheck />}
            Confirm received
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StoreReceiptsPage() {
  const { me, isSuperAdmin } = useAuth();
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'all' | 'edits'>('pending');
  const receipts = useStoreReceipts(status === 'all' || status === 'edits' ? undefined : status);
  const [confirming, setConfirming] = useState<Receipt | null>(null);
  const [editing, setEditing] = useState<Receipt | null>(null);
  const keeper = me?.role === 'warehouse_keeper';
  const canEdit = isSuperAdmin;
  const lab = me?.role === 'lab_officer';

  return (
    <>
      <PageHeader
        title="Store receipts"
        description={
          keeper
            ? 'Stock In entries waiting for you. Count what arrived and confirm; only then it becomes stock.'
            : 'Every Stock In of the Super Admin stock by GRN number. A Lab Officer entry becomes stock when the Warehouse Keeper confirms it; a Super Admin entry is stock at once.'
        }
      />
      <Tabs className="mb-4" value={status} onValueChange={(v) => setStatus(v as typeof status)}>
        <TabsList>
          <TabsTrigger value="pending">Waiting</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
          {canEdit || keeper || lab ? <TabsTrigger value="edits">Edit requests</TabsTrigger> : null}
        </TabsList>
      </Tabs>
      {status === 'edits' ? (
        <GrnEditRequests canDecide={isSuperAdmin} />
      ) : receipts.isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : receipts.error ? (
        <ErrorState error={receipts.error} onRetry={() => void receipts.refetch()} />
      ) : (receipts.data ?? []).length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title={status === 'pending' ? 'Nothing is waiting' : 'No receipts'}
          description="Stock In entries of the Super Admin stock show here."
        />
      ) : (
        <div className="space-y-4">
          {(receipts.data ?? []).map((r) => (
            <section key={r.grnNo} className="overflow-hidden rounded-xl border bg-card shadow-xs">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <TraceNumber number={r.grnNo} />
                    <StatusBadge tone={r.status === 'confirmed' ? 'success' : 'warning'}>
                      {r.status === 'confirmed' ? 'Confirmed' : 'Waiting for the Warehouse Keeper'}
                    </StatusBadge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Stock In {formatDate(r.date)}
                    {r.supplier ? ` · ${r.supplier}` : ''} · entered by {r.enteredBy?.name ?? '—'}
                    {r.confirmedBy && r.confirmedAt
                      ? ` · confirmed ${formatDateTime(r.confirmedAt)} by ${r.confirmedBy.name}`
                      : ''}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline">
                    <Link to={`/print/store-receipt?grn=${encodeURIComponent(r.grnNo)}`}>
                      <Printer />
                      Print GRN
                    </Link>
                  </Button>
                  {r.lines.some((l) => l.serials.length > 0) ? (
                    <Button asChild variant="outline">
                      <Link
                        to={`/print/labels?source=stock_in&sourceIds=${r.lines
                          .filter((l) => l.serials.length > 0)
                          .map((l) => l.id)
                          .join(',')}`}
                      >
                        <Tags />
                        Print labels
                      </Link>
                    </Button>
                  ) : null}
                  {(canEdit || lab) && r.pendingEdit ? (
                    <StatusBadge tone="warning">
                      <Clock className="size-3.5" />
                      Edit waiting for the Super Admin
                    </StatusBadge>
                  ) : canEdit ? (
                    <Button variant="outline" onClick={() => setEditing(r)}>
                      <Pencil />
                      Edit GRN
                    </Button>
                  ) : null}
                  {keeper && r.status === 'pending' ? (
                    <Button onClick={() => setConfirming(r)}>
                      <PackageCheck />
                      Count & confirm
                    </Button>
                  ) : null}
                </div>
              </header>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="w-14 px-4 py-2 text-left font-medium">Sr.</th>
                    <th className="px-4 py-2 text-left font-medium">Product</th>
                    <th className="px-4 py-2 text-right font-medium">Entered</th>
                    <th className="px-4 py-2 text-right font-medium">Received</th>
                    <th className="px-4 py-2 text-left font-medium">Batch</th>
                    <th className="w-16 px-4 py-2 text-right font-medium">
                      <span className="sr-only">Print labels</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {r.lines.map((l, index) => {
                    const short = l.receivedQty !== null && Number(l.receivedQty) < Number(l.qty);
                    const labelled = l.serials.length > 0;
                    return (
                      <tr key={l.id}>
                        <td className="px-4 py-2 text-muted-foreground tabular-nums">
                          {r.lines.length - index}
                        </td>
                        <td className="px-4 py-2">
                          <div className="font-medium">{l.productName}</div>
                          {l.receiptNote ? (
                            <div className="text-xs text-warning-soft-foreground">{l.receiptNote}</div>
                          ) : null}
                          {l.issues.length ? (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {l.issues.map((issue) => (
                                <Link
                                  key={issue.serial}
                                  to="/under-observation"
                                  title={issue.holdNo}
                                  className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive-soft px-1.5 py-0.5 text-xs text-destructive-soft-foreground hover:underline"
                                >
                                  <span className="font-mono">{issue.serial}</span>
                                  <span>· {issue.reason === 'missing' ? 'Missing' : 'Damaged'}</span>
                                </Link>
                              ))}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatQuantity(l.qty)} {l.unit}
                        </td>
                        <td
                          className={`px-4 py-2 text-right tabular-nums ${short ? 'font-semibold text-destructive' : ''}`}
                        >
                          {l.receivedQty === null ? '—' : formatQuantity(l.receivedQty)}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {l.batch ?? '—'}
                          {l.expiryDate ? ` · ${formatDate(l.expiryDate)}` : ''}
                        </td>
                        <td className="px-4 py-1.5 text-right">
                          {labelled ? (
                            <Button asChild variant="ghost" size="icon" className="size-8">
                              <Link
                                to={`/print/labels?source=stock_in&sourceIds=${l.id}`}
                                title={`Print the ${l.serials.length} labels of ${l.productName}${l.batch ? ` · ${l.batch}` : ''}`}
                                aria-label={`Print labels of ${l.productName}${l.batch ? ` batch ${l.batch}` : ''}`}
                              >
                                <Printer />
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              disabled
                              title="This line has no labels"
                              aria-label={`${l.productName} has no labels`}
                            >
                              <Printer />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
      {confirming ? (
        <ConfirmDialog key={confirming.grnNo} receipt={confirming} onClose={() => setConfirming(null)} />
      ) : null}
      {editing ? (
        <GrnEditSheet
          key={editing.grnNo}
          receipt={editing}
          direct={isSuperAdmin || editing.status === 'pending'}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
