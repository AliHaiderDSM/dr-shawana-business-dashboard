import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, PackageCheck } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TraceNumber } from '@/features/trace/trace-page';
import { api, unwrap } from '@/lib/api/client';
import { toastError } from '@/lib/api/errors';
import type { Schemas } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatDateTime, formatQuantity, isoDate } from '@/lib/format';
import { normalizeSerial } from './api';

type Receipt = Schemas['StoreReceipt'];
type Line = Receipt['lines'][number];

function useReceipts(status?: 'pending' | 'confirmed') {
  return useQuery({
    queryKey: ['stock', 'receipts', status ?? null],
    queryFn: () =>
      unwrap(api.GET('/branch/stock-receipts', { params: { query: status ? { status } : {} } })).then(
        (r) => r.data,
      ),
  });
}

function useConfirm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ grnNo, body }: { grnNo: string; body: Schemas['ConfirmStoreReceipt'] }) =>
      unwrap(api.POST('/branch/stock-receipts/{grnNo}/confirm', { params: { path: { grnNo } }, body })),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stock'] }),
        queryClient.invalidateQueries({ queryKey: ['sidebar-badges'] }),
      ]),
  });
}

interface Count {
  received: string;
  note: string;
  missing: string[];
}

function ConfirmDialog({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  const confirm = useConfirm();
  const [date, setDate] = useState(isoDate());
  const [counts, setCounts] = useState<Record<string, Count>>(() =>
    Object.fromEntries(
      receipt.lines.map((l) => [l.id, { received: String(Number(l.qty)), note: '', missing: [] }]),
    ),
  );
  const update = (id: string, change: Partial<Count>) =>
    setCounts((current) => ({ ...current, [id]: { ...current[id]!, ...change } }));
  const shortOf = (line: Line) => Number(line.qty) - (Number(counts[line.id]?.received) || 0);
  const invalid = receipt.lines.some((l) => {
    const c = counts[l.id];
    const received = Number(c?.received);
    if (!c || c.received === '' || received < 0 || received > Number(l.qty)) return true;
    return l.labels > 0 && shortOf(l) !== c.missing.length;
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !confirm.isPending && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Confirm {receipt.grnNo}</DialogTitle>
          <DialogDescription>
            Count what arrived. Change the received quantity of any line that is short and say why; for
            labelled products, scan the labels that are missing. Only the received quantity becomes stock.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="max-w-48 space-y-2">
            <Label htmlFor="receipt-date">Date received</Label>
            <Input
              id="receipt-date"
              type="date"
              value={date}
              min={receipt.date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <ul className="divide-y rounded-lg border">
            {receipt.lines.map((line) => {
              const c = counts[line.id]!;
              const short = shortOf(line);
              return (
                <li key={line.id} className="space-y-2 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-40 flex-1">
                      <div className="font-medium">{line.productName}</div>
                      <div className="text-xs text-muted-foreground">
                        Entered {formatQuantity(line.qty)} {line.unit}
                        {line.batch ? ` · batch ${line.batch}` : ''}
                        {line.expiryDate ? ` · expires ${formatDate(line.expiryDate)}` : ''}
                        {line.labels ? ` · ${line.labels} labels` : ''}
                      </div>
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
                        onChange={(e) => update(line.id, { received: e.target.value, missing: [] })}
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
                  {short > 0 && line.labels > 0 ? (
                    <div className="space-y-1.5">
                      <BarcodeScanInput
                        placeholder={`Scan the ${short} missing label(s)`}
                        onScan={async (code) => {
                          const serial = normalizeSerial(code);
                          if (c.missing.includes(serial)) return;
                          if (c.missing.length >= short) {
                            toast.error(`Only ${short} label(s) are missing`);
                            return;
                          }
                          update(line.id, { missing: [...c.missing, serial] });
                        }}
                      />
                      <div className="flex flex-wrap gap-1">
                        {c.missing.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className="rounded-md border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] hover:line-through"
                            onClick={() => update(line.id, { missing: c.missing.filter((x) => x !== s) })}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={confirm.isPending}>
            Cancel
          </Button>
          <Button
            disabled={invalid || confirm.isPending}
            onClick={() =>
              confirm
                .mutateAsync({
                  grnNo: receipt.grnNo,
                  body: {
                    date,
                    lines: receipt.lines
                      .filter((l) => shortOf(l) > 0)
                      .map((l) => ({
                        id: l.id,
                        receivedQty: counts[l.id]!.received,
                        note: counts[l.id]!.note.trim() || null,
                        ...(counts[l.id]!.missing.length ? { missingSerials: counts[l.id]!.missing } : {}),
                      })),
                  },
                })
                .then(() => {
                  toast.success(`${receipt.grnNo} confirmed. It is in the Super Admin stock now.`);
                  onClose();
                })
                .catch(toastError)
            }
          >
            {confirm.isPending ? <Loader2 className="animate-spin" /> : <PackageCheck />}
            Confirm received
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StoreReceiptsPage() {
  const { me } = useAuth();
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'all'>('pending');
  const receipts = useReceipts(status === 'all' ? undefined : status);
  const [confirming, setConfirming] = useState<Receipt | null>(null);
  const keeper = me?.role === 'warehouse_keeper';

  return (
    <>
      <PageHeader
        title="Store receipts"
        description={
          keeper
            ? 'Stock In entries waiting for you. Count what arrived and confirm; only then it becomes stock.'
            : 'Every Stock In of the Super Admin stock by GRN number. It becomes stock when the Warehouse Keeper confirms it.'
        }
      />
      <Tabs className="mb-4" value={status} onValueChange={(v) => setStatus(v as typeof status)}>
        <TabsList>
          <TabsTrigger value="pending">Waiting</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>
      {receipts.isLoading ? (
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
                {keeper && r.status === 'pending' ? (
                  <Button onClick={() => setConfirming(r)}>
                    <PackageCheck />
                    Count & confirm
                  </Button>
                ) : null}
              </header>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Product</th>
                    <th className="px-4 py-2 text-right font-medium">Entered</th>
                    <th className="px-4 py-2 text-right font-medium">Received</th>
                    <th className="px-4 py-2 text-left font-medium">Batch</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {r.lines.map((l) => {
                    const short = l.receivedQty !== null && Number(l.receivedQty) < Number(l.qty);
                    return (
                      <tr key={l.id}>
                        <td className="px-4 py-2">
                          <div className="font-medium">{l.productName}</div>
                          {l.receiptNote ? (
                            <div className="text-xs text-warning-soft-foreground">{l.receiptNote}</div>
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
    </>
  );
}
