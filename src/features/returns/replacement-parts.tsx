import type { ColumnDef } from '@tanstack/react-table';
import { Check, Loader2, PackagePlus, ReceiptText, Send, Trash2, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { AttachmentList } from '@/components/shared/attachment-list';
import { BarcodeScanInput } from '@/components/shared/barcode-scan-input';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { FilePicker } from '@/components/shared/file-upload';
import { DateRangeFilter, FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { Panel } from '@/components/shared/panel';
import { RowActions } from '@/components/shared/row-actions';
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
import { useListState } from '@/hooks/use-list-state';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { useInWarehouse } from '@/lib/auth/branches';
import { branchStore } from '@/lib/auth/session';
import { formatDate, formatQuantity, isoDate } from '@/lib/format';
import {
  replacementFileUrl,
  useCreateReplacementMutation,
  useCreateSaleReplacementMutation,
  useDecideReplacementMutation,
  useGetReplaceableQuery,
  useRemoveReplacementMutation,
  useReplacements,
  useSendReplacementMutation,
  type ReplacementReason,
  type ReplacementStatus,
  type SaleReplacement,
  type SaleReturn,
} from '@redux/features/returns';
import { REASON_LABELS } from './constants';

export const REPLACEMENT_STATUS_LABELS: Record<ReplacementStatus, string> = {
  pending_approval: 'Waiting for approval',
  approved: 'Approved · to send',
  rejected: 'Rejected',
  sent: 'Sent',
};

const STATUS_TONES: Record<ReplacementStatus, Tone> = {
  pending_approval: 'warning',
  approved: 'info',
  rejected: 'danger',
  sent: 'success',
};

const DIRECT_REASONS: ReplacementReason[] = ['damaged', 'wrong_item', 'other'];

export function ReplacementStatusBadge({ status }: { status: ReplacementStatus }) {
  return <StatusBadge tone={STATUS_TONES[status]}>{REPLACEMENT_STATUS_LABELS[status]}</StatusBadge>;
}

export function useCanReplace() {
  const { me, isSuperAdmin } = useAuth();
  return isSuperAdmin || me?.role === 'branch_admin' || me?.role === 'dispatcher';
}

function useCanSend(replacement: SaleReplacement) {
  const { activeBranchId } = useAuth();
  const canReplace = useCanReplace();
  const stockBranch = replacement.sale?.fulfillmentBranchId ?? replacement.branchId;
  return canReplace && replacement.status === 'approved' && activeBranchId === stockBranch;
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

interface Line {
  productId: string;
  name: string;
  total: number;
  left: number;
  hint?: string | null;
}

function replaceHint(returned: number, replaced: number) {
  const parts = [
    returned > 0 ? `${formatQuantity(returned)} returned: replace it from the return` : null,
    replaced > 0 ? `${formatQuantity(replaced)} already replaced` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function RequestReplacementDialog({
  title,
  totalLabel,
  lines,
  loading,
  withReason,
  saving,
  onSubmit,
  onClose,
}: {
  title: string;
  totalLabel: string;
  lines: Line[];
  loading?: boolean;
  withReason: boolean;
  saving: boolean;
  onSubmit: (input: {
    date: string;
    note: string | null;
    reason: ReplacementReason | null;
    items: { productId: string; qty: string }[];
    files: File[];
  }) => Promise<unknown>;
  onClose: () => void;
}) {
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<ReplacementReason | ''>('');
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(isoDate());
  const chosen = lines.map((l) => ({ ...l, qty: qty[l.productId] ?? '' })).filter((l) => Number(l.qty) > 0);
  const tooMany = chosen.find((l) => Number(l.qty) > l.left);
  const ready = chosen.length > 0 && !tooMany && Boolean(date) && (!withReason || Boolean(reason));

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            The same products go out again for free: no payment, not a sale. The Super Admin approves it
            first; the stock leaves only when it is sent.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-[minmax(0,1fr)_5rem_5rem_6rem] gap-2 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Product</span>
              <span className="text-right">{totalLabel}</span>
              <span className="text-right">Can replace</span>
              <span>Replace</span>
            </div>
            {loading ? (
              <p className="border-t px-3 py-3 text-sm text-muted-foreground">Loading…</p>
            ) : (
              lines.map((line) => (
                <div
                  key={line.productId}
                  className="grid grid-cols-[minmax(0,1fr)_5rem_5rem_6rem] items-center gap-2 border-t px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{line.name}</span>
                    {line.hint ? (
                      <span className="block text-xs text-muted-foreground">{line.hint}</span>
                    ) : null}
                  </span>
                  <span className="text-right tabular-nums">{formatQuantity(line.total)}</span>
                  <span className="text-right tabular-nums">{formatQuantity(line.left)}</span>
                  {line.left === 0 ? (
                    <span className="text-sm text-muted-foreground">—</span>
                  ) : (
                    <Input
                      aria-label={`Replace ${line.name}`}
                      inputMode="decimal"
                      className="h-8"
                      value={qty[line.productId] ?? ''}
                      onChange={(e) =>
                        /^\d*(\.\d{0,3})?$/.test(e.target.value) &&
                        setQty((current) => ({ ...current, [line.productId]: e.target.value }))
                      }
                    />
                  )}
                </div>
              ))
            )}
          </div>
          {tooMany ? (
            <p className="text-sm text-destructive">
              {tooMany.name}: at most {formatQuantity(tooMany.left)} can be replaced.
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {withReason ? (
              <div className="space-y-2">
                <Label htmlFor="replacement-reason">Reason</Label>
                <Select value={reason} onValueChange={(value) => setReason(value as ReplacementReason)}>
                  <SelectTrigger id="replacement-reason" className="w-full">
                    <SelectValue placeholder="Choose a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIRECT_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {REASON_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="replacement-date">Date</Label>
              <Input
                id="replacement-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
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
          <div className="space-y-2">
            <Label>Photos or proof (optional)</Label>
            <FilePicker files={files} onChange={setFiles} disabled={saving} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={saving || !ready}
            onClick={() =>
              void onSubmit({
                date,
                note: note.trim() || null,
                reason: reason || null,
                items: chosen.map((l) => ({ productId: l.productId, qty: l.qty })),
                files,
              })
                .then(onClose)
                .catch(toastError)
            }
          >
            {saving ? <Loader2 className="animate-spin" /> : <PackagePlus />}
            Send for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReturnRequestDialog({
  record,
  replaced,
  onClose,
}: {
  record: SaleReturn;
  replaced: Map<string, number>;
  onClose: () => void;
}) {
  const [create, state] = useCreateReplacementMutation();
  const key = useIdempotencyKey();
  const lines = mergeItems(record.items).map((line) => ({
    productId: line.productId,
    name: line.name,
    total: line.qty,
    left: Math.max(0, line.qty - (replaced.get(line.productId) ?? 0)),
  }));
  return (
    <RequestReplacementDialog
      title={`Replacement · ${record.returnNo}`}
      totalLabel="Returned"
      lines={lines}
      withReason={false}
      saving={state.isLoading}
      onClose={onClose}
      onSubmit={({ date, note, items, files }) =>
        create({ returnId: record.id, idempotencyKey: key.key, date, note, items, files })
          .unwrap()
          .then((created) => {
            key.renew();
            toast.success(`${created.replacementNo} sent to the Super Admin for approval`);
          })
      }
    />
  );
}

function SaleRequestDialog({
  saleId,
  invoiceNo,
  onClose,
}: {
  saleId: string;
  invoiceNo: string;
  onClose: () => void;
}) {
  const replaceable = useGetReplaceableQuery(saleId);
  const [create, state] = useCreateSaleReplacementMutation();
  const key = useIdempotencyKey();
  const lines = (replaceable.data?.items ?? []).map((i) => ({
    productId: i.productId,
    name: i.name,
    total: Number(i.sold),
    left: Number(i.replaceable),
    hint: replaceHint(Number(i.returned), Number(i.replaced)),
  }));
  return (
    <RequestReplacementDialog
      title={`Replacement without a return · ${invoiceNo}`}
      totalLabel="Sold"
      lines={lines}
      loading={replaceable.isLoading}
      withReason
      saving={state.isLoading}
      onClose={onClose}
      onSubmit={({ date, note, reason, items, files }) =>
        create({
          saleId,
          idempotencyKey: key.key,
          date,
          note,
          reason: reason ?? 'other',
          items,
          files,
        })
          .unwrap()
          .then((created) => {
            key.renew();
            toast.success(`${created.replacementNo} sent to the Super Admin for approval`);
          })
      }
    />
  );
}

function DecideDialog({
  replacement,
  approve,
  onClose,
}: {
  replacement: SaleReplacement;
  approve: boolean;
  onClose: () => void;
}) {
  const [decide, state] = useDecideReplacementMutation();
  const [note, setNote] = useState('');
  const missing = !approve && !note.trim();
  return (
    <Dialog open onOpenChange={(open) => !open && !state.isLoading && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {approve ? 'Approve' : 'Reject'} {replacement.replacementNo}?
          </DialogTitle>
          <DialogDescription>
            {approve
              ? 'The branch can then send it. The stock leaves when it is sent.'
              : 'Nothing is sent and the stock is unchanged.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="replacement-decision">{approve ? 'Note (optional)' : 'Why is it rejected?'}</Label>
          <Textarea
            id="replacement-decision"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={state.isLoading}>
            Cancel
          </Button>
          <Button
            variant={approve ? 'default' : 'destructive'}
            disabled={state.isLoading || missing}
            onClick={() =>
              decide({ replacementId: replacement.id, approve, note: note.trim() || null })
                .unwrap()
                .then((r) => {
                  toast.success(`${r.replacementNo} ${approve ? 'approved' : 'rejected'}`);
                  onClose();
                })
                .catch(toastError)
            }
          >
            {state.isLoading ? <Loader2 className="animate-spin" /> : approve ? <Check /> : <X />}
            {approve ? 'Approve' : 'Reject'}
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
      description="It was not approved yet, so nothing changes in the stock."
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

type Action = { kind: 'approve' | 'reject' | 'send' | 'remove'; replacement: SaleReplacement };

function ActionDialogs({ action, onClose }: { action: Action | null; onClose: () => void }) {
  if (!action) return null;
  if (action.kind === 'send')
    return <SendReplacementDialog replacement={action.replacement} onClose={onClose} />;
  if (action.kind === 'remove')
    return <RemoveReplacementDialog replacement={action.replacement} onClose={onClose} />;
  return (
    <DecideDialog replacement={action.replacement} approve={action.kind === 'approve'} onClose={onClose} />
  );
}

function ReplacementCard({
  replacement: r,
  showReturn,
  onAction,
}: {
  replacement: SaleReplacement;
  showReturn: boolean;
  onAction: (action: Action) => void;
}) {
  const { isSuperAdmin } = useAuth();
  const canReplace = useCanReplace();
  const canSend = useCanSend(r);
  const waiting = r.status === 'pending_approval';
  return (
    <li className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{r.replacementNo}</span>
        <ReplacementStatusBadge status={r.status} />
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {formatDate(r.date)} · {REASON_LABELS[r.reason]}
        {showReturn ? (
          r.saleReturnId ? (
            <>
              {' · '}
              <Link to={`/returns/${r.saleReturnId}`} className="text-primary hover:underline">
                {r.returnNo}
              </Link>
            </>
          ) : (
            ' · without a return'
          )
        ) : null}
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
      {r.note ? <p className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground">{r.note}</p> : null}
      {r.files.length ? (
        <AttachmentList
          className="mt-2"
          files={r.files}
          getUrl={(file) => replacementFileUrl(r.id, file.id)}
        />
      ) : null}
      {r.decisionNote ? (
        <p
          className={
            r.status === 'rejected'
              ? 'mt-2 text-xs whitespace-pre-wrap text-destructive'
              : 'mt-2 text-xs whitespace-pre-wrap text-muted-foreground'
          }
        >
          Super Admin: {r.decisionNote}
        </p>
      ) : null}
      {(isSuperAdmin && waiting) || canSend || (canReplace && waiting) ? (
        <div className="mt-3 flex flex-wrap gap-2 print:hidden">
          {isSuperAdmin && waiting ? (
            <>
              <Button size="sm" onClick={() => onAction({ kind: 'approve', replacement: r })}>
                <Check />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction({ kind: 'reject', replacement: r })}
              >
                <X />
                Reject
              </Button>
            </>
          ) : null}
          {canSend ? (
            <Button size="sm" onClick={() => onAction({ kind: 'send', replacement: r })}>
              <Send />
              Send
            </Button>
          ) : null}
          {canReplace && waiting ? (
            <Button size="sm" variant="ghost" onClick={() => onAction({ kind: 'remove', replacement: r })}>
              <Trash2 />
              Delete
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ReplacementList({
  list,
  loading,
  empty,
  showReturn,
}: {
  list: SaleReplacement[];
  loading: boolean;
  empty: string;
  showReturn: boolean;
}) {
  const [action, setAction] = useState<Action | null>(null);
  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <ReplacementCard key={r.id} replacement={r} showReturn={showReturn} onAction={setAction} />
          ))}
        </ul>
      )}
      <ActionDialogs action={action} onClose={() => setAction(null)} />
    </>
  );
}

export function ReturnReplacementsPanel({ record }: { record: SaleReturn }) {
  const canReplace = useCanReplace();
  const query = useReplacements({ saleReturnId: record.id, pageSize: 100, sort: 'replacementNo' });
  const [creating, setCreating] = useState(false);
  const list = query.data?.data ?? [];
  const replaced = new Map<string, number>();
  for (const r of list.filter((x) => x.status !== 'rejected'))
    for (const item of r.items)
      replaced.set(item.productId, (replaced.get(item.productId) ?? 0) + Number(item.qty));
  const anyLeft = mergeItems(record.items).some((l) => l.qty > (replaced.get(l.productId) ?? 0));

  return (
    <Panel
      title="Replacement"
      description="Same products sent again for free after the Super Admin approves. Not a sale."
      actions={
        canReplace && anyLeft ? (
          <Button size="sm" variant="outline" className="print:hidden" onClick={() => setCreating(true)}>
            <PackagePlus />
            Request replacement
          </Button>
        ) : null
      }
    >
      <ReplacementList list={list} loading={query.isLoading} empty="No replacement." showReturn={false} />
      {creating ? (
        <ReturnRequestDialog record={record} replaced={replaced} onClose={() => setCreating(false)} />
      ) : null}
    </Panel>
  );
}

export function SaleReplacementsPanel({
  sale,
}: {
  sale: {
    id: string;
    invoiceNo: string;
    saleType: string;
    deliveryStatus?: string | null;
    cancelledOn?: string | null;
  };
}) {
  const canReplace = useCanReplace();
  const query = useReplacements({ saleId: sale.id, pageSize: 100, sort: 'replacementNo' });
  const [creating, setCreating] = useState(false);
  const blocked =
    Boolean(sale.cancelledOn) ||
    sale.deliveryStatus === 'cancelled' ||
    (sale.saleType === 'online' && sale.deliveryStatus === 'pending');
  const replaceable = useGetReplaceableQuery(sale.id, { skip: !canReplace || blocked });
  const items = replaceable.data?.items ?? [];
  const anyLeft = items.some((i) => Number(i.replaceable) > 0);
  const allReturned = items.length > 0 && !anyLeft && items.some((i) => Number(i.returned) > 0);
  return (
    <Panel
      title="Replacements"
      description="Free replacements of this sale, numbered on the invoice."
      actions={
        canReplace && !blocked && anyLeft ? (
          <Button size="sm" variant="outline" className="print:hidden" onClick={() => setCreating(true)}>
            <PackagePlus />
            Replacement request
          </Button>
        ) : null
      }
    >
      <ReplacementList
        list={query.data?.data ?? []}
        loading={query.isLoading}
        empty="No replacement."
        showReturn
      />
      {canReplace && allReturned ? (
        <p className="mt-3 text-xs text-muted-foreground print:hidden">
          Nothing left to replace without a return. For a returned product, open its return and use Request
          replacement.
        </p>
      ) : null}
      {creating ? (
        <SaleRequestDialog saleId={sale.id} invoiceNo={sale.invoiceNo} onClose={() => setCreating(false)} />
      ) : null}
    </Panel>
  );
}

function ReplacementsTable() {
  const navigate = useNavigate();
  const { isSuperAdmin, activeBranchId } = useAuth();
  const canReplace = useCanReplace();
  const list = useListState({ defaultSort: '-createdAt' });
  const query = useReplacements(list.query);
  const [action, setAction] = useState<Action | null>(null);
  const inWarehouse = useInWarehouse();
  const openSale = (r: SaleReplacement) => {
    if (inWarehouse) branchStore.setViewBranch(r.branchId);
    void navigate(`/sales/${r.saleId}`);
  };

  const columns: ColumnDef<SaleReplacement, unknown>[] = [
    {
      id: 'replacementNo',
      header: 'Replacement no',
      accessorKey: 'replacementNo',
      meta: { sortKey: 'replacementNo', hideable: false },
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
      id: 'patient',
      header: 'Patient',
      accessorFn: (r) => r.sale?.patient?.name ?? '',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.sale?.patient?.name}</div>
          <div className="text-xs text-muted-foreground">{row.original.sale?.patient?.phone}</div>
        </div>
      ),
    },
    {
      id: 'return',
      header: 'Return',
      accessorFn: (r) => r.returnNo ?? 'Without a return',
      cell: ({ row }) =>
        row.original.saleReturnId ? (
          <Link
            to={`/returns/${row.original.saleReturnId}`}
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.returnNo}
          </Link>
        ) : (
          <span className="text-muted-foreground">Without a return</span>
        ),
    },
    {
      id: 'reason',
      header: 'Reason',
      accessorFn: (r) => REASON_LABELS[r.reason],
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
      cell: ({ row }) => {
        const r = row.original;
        const waiting = r.status === 'pending_approval';
        const stockBranch = r.sale?.fulfillmentBranchId ?? r.branchId;
        return (
          <RowActions
            actions={[
              ...(isSuperAdmin && waiting
                ? [
                    {
                      label: 'Approve',
                      icon: Check,
                      onSelect: () => setAction({ kind: 'approve', replacement: r }),
                    },
                    {
                      label: 'Reject',
                      icon: X,
                      onSelect: () => setAction({ kind: 'reject', replacement: r }),
                    },
                  ]
                : []),
              ...(canReplace && r.status === 'approved' && activeBranchId === stockBranch
                ? [{ label: 'Send', icon: Send, onSelect: () => setAction({ kind: 'send', replacement: r }) }]
                : []),
              { label: 'Open sale', icon: ReceiptText, onSelect: () => openSale(r) },
              ...(r.saleReturnId
                ? [
                    {
                      label: 'Open return',
                      icon: Undo2,
                      onSelect: () => void navigate(`/returns/${r.saleReturnId}`),
                    },
                  ]
                : []),
              ...(canReplace && waiting
                ? [
                    {
                      label: 'Delete',
                      icon: Trash2,
                      destructive: true,
                      onSelect: () => setAction({ kind: 'remove', replacement: r }),
                    },
                  ]
                : []),
            ]}
          />
        );
      },
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
        searchPlaceholder="Replacement, invoice, return or patient"
        exportFileName="replacements"
        onRowClick={openSale}
        emptyTitle="No replacements"
        emptyDescription="Open a sale or a return and use Replacement request."
        toolbar={
          <>
            <FilterSelect
              list={list}
              name="status"
              allLabel="All statuses"
              className="w-48"
              options={(Object.keys(REPLACEMENT_STATUS_LABELS) as ReplacementStatus[]).map((value) => ({
                value,
                label: REPLACEMENT_STATUS_LABELS[value],
              }))}
            />
            <FilterSelect
              list={list}
              name="kind"
              allLabel="With and without return"
              className="w-52"
              options={[
                { value: 'with_return', label: 'With a return' },
                { value: 'without_return', label: 'Without a return' },
              ]}
            />
            <DateRangeFilter list={list} />
          </>
        }
      />
      <ActionDialogs action={action} onClose={() => setAction(null)} />
    </>
  );
}

export function ReplacementsPage() {
  return (
    <>
      <PageHeader
        title="Replacements"
        description="Free replacements, with or without a return. The Super Admin approves each one; then the stock branch sends it."
      />
      <ReplacementsTable />
    </>
  );
}
