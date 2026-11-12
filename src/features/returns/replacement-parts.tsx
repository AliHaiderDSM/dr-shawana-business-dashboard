import type { ColumnDef } from '@tanstack/react-table';
import { Loader2, PackagePlus, Send, Trash2, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { BarcodeScanInput } from '@/components/shared/barcode-scan-input';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { DateRangeFilter, FilterSelect } from '@/components/shared/list-filters';
import { Panel } from '@/components/shared/panel';
import { RowActions } from '@/components/shared/row-actions';
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
import { Textarea } from '@/components/ui/textarea';
import { useListState } from '@/hooks/use-list-state';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatQuantity, isoDate } from '@/lib/format';
import {
  useCreateReplacementMutation,
  useRemoveReplacementMutation,
  useReplacements,
  useSendReplacementMutation,
  type ReplacementStatus,
  type SaleReplacement,
  type SaleReturn,
} from '@redux/features/returns';

export const REPLACEMENT_STATUS_LABELS: Record<ReplacementStatus, string> = {
  pending: 'Waiting for dispatch',
  sent: 'Sent',
};

export function ReplacementStatusBadge({ status }: { status: ReplacementStatus }) {
  return (
    <StatusBadge tone={status === 'sent' ? 'success' : 'warning'}>
      {REPLACEMENT_STATUS_LABELS[status]}
    </StatusBadge>
  );
}

export function useCanReplace() {
  const { me, isSuperAdmin } = useAuth();
  return isSuperAdmin || me?.role === 'branch_admin' || me?.role === 'dispatcher';
}

function mergeItems(items: { productId: string; product?: { name: string } | null; qty: string }[]) {
  const merged = new Map<string, { productId: string; name: string; qty: number }>();
  for (const item of items) {
    const entry = merged.get(item.productId) ?? {
      productId: item.productId,
      name: item.product?.name ?? 'Product',
      qty: 0,
    };
    entry.qty += Number(item.qty);
    merged.set(item.productId, entry);
  }
  return [...merged.values()];
}

function LabelScanner({ serials, onChange }: { serials: string[]; onChange: (next: string[]) => void }) {
  const add = async (code: string) => {
    const serial = code.trim().toUpperCase();
    if (!serial) return;
    if (serials.includes(serial)) {
      toast.error(`${serial} is already scanned`);
      return;
    }
    onChange([...serials, serial]);
  };
  return (
    <div className="space-y-2">
      <Label>Labels of the new pieces</Label>
      <BarcodeScanInput onScan={add} placeholder="Scan the DSM label of each labelled piece" />
      <p className="text-xs text-muted-foreground">
        Only products with DSM labels need a scan. The earliest-expiry batch must go first.
      </p>
      {serials.length ? (
        <div className="flex flex-wrap gap-1.5">
          {serials.map((serial) => (
            <span
              key={serial}
              className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-xs"
            >
              {serial}
              <button
                type="button"
                aria-label={`Remove ${serial}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onChange(serials.filter((s) => s !== serial))}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CreateReplacementDialog({
  record,
  replaced,
  onClose,
}: {
  record: SaleReturn;
  replaced: Map<string, number>;
  onClose: () => void;
}) {
  const [create, createState] = useCreateReplacementMutation();
  const key = useIdempotencyKey();
  const online = record.sale?.saleType === 'online';
  const lines = mergeItems(record.items).map((line) => ({
    ...line,
    left: Math.max(0, line.qty - (replaced.get(line.productId) ?? 0)),
  }));
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.productId, l.left > 0 ? String(l.left) : ''])),
  );
  const [serials, setSerials] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(isoDate());
  const chosen = lines
    .map((l) => ({ productId: l.productId, qty: qty[l.productId] ?? '', left: l.left, name: l.name }))
    .filter((l) => Number(l.qty) > 0);
  const tooMany = chosen.find((l) => Number(l.qty) > l.left);

  const submit = () =>
    create({
      returnId: record.id,
      idempotencyKey: key.key,
      date,
      note: note.trim() || null,
      items: chosen.map((l) => ({ productId: l.productId, qty: l.qty })),
      ...(online || serials.length === 0 ? {} : { serials }),
    })
      .unwrap()
      .then((created) => {
        key.renew();
        toast.success(
          created.status === 'pending'
            ? `${created.replacementNo} saved. The Dispatch Department sends it.`
            : `${created.replacementNo} handed over. Stock updated.`,
        );
        onClose();
      })
      .catch(toastError);

  return (
    <Dialog open onOpenChange={(open) => !open && !createState.isLoading && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Send replacement · {record.returnNo}</DialogTitle>
          <DialogDescription>
            The same products go out again for free: no payment, not a sale.{' '}
            {online
              ? 'This is an online order, so it waits for the Dispatch Department, which scans and sends it.'
              : 'The stock leaves now.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-[minmax(0,1fr)_5rem_5rem_6rem] gap-2 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Product</span>
              <span className="text-right">Returned</span>
              <span className="text-right">Can send</span>
              <span>Replace</span>
            </div>
            {lines.map((line) => (
              <div
                key={line.productId}
                className="grid grid-cols-[minmax(0,1fr)_5rem_5rem_6rem] items-center gap-2 border-t px-3 py-2 text-sm"
              >
                <span className="truncate font-medium">{line.name}</span>
                <span className="text-right tabular-nums">{formatQuantity(line.qty)}</span>
                <span className="text-right tabular-nums">{formatQuantity(line.left)}</span>
                <Input
                  aria-label={`Replace ${line.name}`}
                  inputMode="decimal"
                  className="h-8"
                  disabled={line.left === 0}
                  value={qty[line.productId] ?? ''}
                  onChange={(e) =>
                    /^\d*(\.\d{0,3})?$/.test(e.target.value) &&
                    setQty((current) => ({ ...current, [line.productId]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          {tooMany ? (
            <p className="text-sm text-destructive">
              {tooMany.name}: at most {formatQuantity(tooMany.left)} can be replaced.
            </p>
          ) : null}
          {online ? null : <LabelScanner serials={serials} onChange={setSerials} />}
          <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="replacement-date">Date</Label>
              <Input
                id="replacement-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="replacement-note">Note</Label>
              <Textarea
                id="replacement-note"
                rows={2}
                value={note}
                placeholder="e.g. customer sent a photo of the damaged bottle"
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={createState.isLoading}>
            Cancel
          </Button>
          <Button
            disabled={createState.isLoading || chosen.length === 0 || Boolean(tooMany) || !date}
            onClick={() => void submit()}
          >
            {createState.isLoading ? <Loader2 className="animate-spin" /> : <PackagePlus />}
            {online ? 'Save for dispatch' : 'Hand over'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SendReplacementDialog({
  replacement,
  onClose,
}: {
  replacement: SaleReplacement;
  onClose: () => void;
}) {
  const [send, sendState] = useSendReplacementMutation();
  const [serials, setSerials] = useState<string[]>([]);
  const [date, setDate] = useState(isoDate());
  return (
    <Dialog open onOpenChange={(open) => !open && !sendState.isLoading && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send {replacement.replacementNo}</DialogTitle>
          <DialogDescription>
            Free replacement for {replacement.sale?.invoiceNo} · {replacement.sale?.patient?.name}. The stock
            leaves when you send it.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1 rounded-lg border px-3 py-2 text-sm">
          {replacement.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-2">
              <span className="truncate">{item.product?.name}</span>
              <span className="tabular-nums">× {formatQuantity(item.qty)}</span>
            </li>
          ))}
        </ul>
        <LabelScanner serials={serials} onChange={setSerials} />
        <div className="max-w-40 space-y-2">
          <Label htmlFor="replacement-send-date">Sent on</Label>
          <Input
            id="replacement-send-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sendState.isLoading}>
            Cancel
          </Button>
          <Button
            disabled={sendState.isLoading || !date}
            onClick={() =>
              send({ replacementId: replacement.id, date, ...(serials.length ? { serials } : {}) })
                .unwrap()
                .then((sent) => {
                  toast.success(`${sent.replacementNo} sent. Stock updated.`);
                  onClose();
                })
                .catch(toastError)
            }
          >
            {sendState.isLoading ? <Loader2 className="animate-spin" /> : <Send />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveReplacementDialog({
  replacement,
  onClose,
}: {
  replacement: SaleReplacement;
  onClose: () => void;
}) {
  const [remove] = useRemoveReplacementMutation();
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Delete ${replacement.replacementNo}?`}
      description="It was not sent yet, so the stock is unchanged."
      confirmLabel="Delete"
      destructive
      onConfirm={() =>
        remove(replacement.id)
          .unwrap()
          .then(() => {
            toast.success('Replacement deleted');
            onClose();
          })
          .catch(toastError)
      }
    />
  );
}

export function ReturnReplacementsPanel({ record }: { record: SaleReturn }) {
  const canReplace = useCanReplace();
  const query = useReplacements({ saleReturnId: record.id, pageSize: 100, sort: '-date' });
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<SaleReplacement | null>(null);
  const [removing, setRemoving] = useState<SaleReplacement | null>(null);
  const list = query.data?.data ?? [];
  const replaced = new Map<string, number>();
  for (const r of list)
    for (const item of r.items)
      replaced.set(item.productId, (replaced.get(item.productId) ?? 0) + Number(item.qty));
  const anyLeft = mergeItems(record.items).some((l) => l.qty > (replaced.get(l.productId) ?? 0));

  return (
    <Panel
      title="Replacement"
      description="Same products sent again for free. Not a sale: no payment and no revenue."
      actions={
        canReplace && anyLeft ? (
          <Button size="sm" variant="outline" className="print:hidden" onClick={() => setCreating(true)}>
            <PackagePlus />
            Send replacement
          </Button>
        ) : null
      }
    >
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No replacement sent.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{r.replacementNo}</span>
                <ReplacementStatusBadge status={r.status} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatDate(r.date)}
                {r.sentOn ? ` · sent ${formatDate(r.sentOn)}` : ''}
              </div>
              <ul className="mt-2 space-y-0.5 text-sm">
                {r.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-2">
                    <span className="truncate">{item.product?.name}</span>
                    <span className="tabular-nums">× {formatQuantity(item.qty)}</span>
                  </li>
                ))}
              </ul>
              {r.note ? (
                <p className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground">{r.note}</p>
              ) : null}
              {canReplace && r.status === 'pending' ? (
                <div className="mt-3 flex gap-2 print:hidden">
                  <Button size="sm" onClick={() => setSending(r)}>
                    <Send />
                    Send
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRemoving(r)}>
                    <Trash2 />
                    Delete
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {creating ? (
        <CreateReplacementDialog record={record} replaced={replaced} onClose={() => setCreating(false)} />
      ) : null}
      {sending ? <SendReplacementDialog replacement={sending} onClose={() => setSending(null)} /> : null}
      {removing ? <RemoveReplacementDialog replacement={removing} onClose={() => setRemoving(null)} /> : null}
    </Panel>
  );
}

export function ReplacementsTable() {
  const navigate = useNavigate();
  const canReplace = useCanReplace();
  const list = useListState({ defaultSort: '-date', prefix: 'rp_' });
  const query = useReplacements(list.query);
  const [sending, setSending] = useState<SaleReplacement | null>(null);

  const columns: ColumnDef<SaleReplacement, unknown>[] = [
    {
      id: 'replacementNo',
      header: 'Replacement no',
      accessorKey: 'replacementNo',
      meta: { sortKey: 'replacementSeq', hideable: false },
      cell: ({ row }) => <span className="font-medium">{row.original.replacementNo}</span>,
    },
    {
      id: 'date',
      header: 'Date',
      accessorKey: 'date',
      meta: { sortKey: 'date' },
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      id: 'sale',
      header: 'Sale',
      accessorFn: (r) => `${r.sale?.invoiceNo ?? ''} ${r.sale?.patient?.name ?? ''}`,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.sale?.invoiceNo}</div>
          <div className="text-xs text-muted-foreground">{row.original.sale?.patient?.name}</div>
        </div>
      ),
    },
    {
      id: 'return',
      header: 'Return',
      accessorKey: 'returnNo',
      cell: ({ row }) => (
        <Link
          to={`/returns/${row.original.saleReturnId}`}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.returnNo}
        </Link>
      ),
    },
    {
      id: 'items',
      header: 'Products',
      accessorFn: (r) => r.items.map((i) => `${i.product?.name ?? ''} x ${Number(i.qty)}`).join('; '),
      cell: ({ row }) => (
        <ul className="space-y-0.5 text-sm">
          {row.original.items.map((i) => (
            <li key={i.id} className="whitespace-nowrap">
              {i.product?.name}{' '}
              <span className="text-muted-foreground tabular-nums">× {formatQuantity(i.qty)}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (r) => REPLACEMENT_STATUS_LABELS[r.status],
      cell: ({ row }) => <ReplacementStatusBadge status={row.original.status} />,
    },
    {
      id: 'sentOn',
      header: 'Sent on',
      accessorKey: 'sentOn',
      cell: ({ row }) =>
        row.original.sentOn ? (
          formatDate(row.original.sentOn)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right', hideable: false },
      cell: ({ row }) => (
        <RowActions
          actions={[
            ...(canReplace && row.original.status === 'pending'
              ? [{ label: 'Send', icon: Send, onSelect: () => setSending(row.original) }]
              : []),
            {
              label: 'Open return',
              icon: Undo2,
              onSelect: () => void navigate(`/returns/${row.original.saleReturnId}`),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={query.data?.data}
        meta={query.data?.meta}
        list={list}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        searchPlaceholder="Replacement, return, invoice or patient"
        exportFileName="replacements"
        onRowClick={(r) => void navigate(`/returns/${r.saleReturnId}`)}
        emptyTitle="No replacements"
        emptyDescription="Open a damaged or expired return and use Send replacement."
        toolbar={
          <>
            <FilterSelect
              list={list}
              name="status"
              allLabel="All statuses"
              className="w-48"
              options={[
                { value: 'pending', label: REPLACEMENT_STATUS_LABELS.pending },
                { value: 'sent', label: REPLACEMENT_STATUS_LABELS.sent },
              ]}
            />
            <DateRangeFilter list={list} />
          </>
        }
      />
      {sending ? <SendReplacementDialog replacement={sending} onClose={() => setSending(null)} /> : null}
    </>
  );
}
