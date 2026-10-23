import { Check, Loader2, Plus, Send, Trash2, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Combobox } from '@/components/shared/combobox';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { MoneyInput } from '@/components/shared/money-input';
import { StatusBadge, type Tone } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toastError } from '@/lib/api/errors';
import type { Schemas } from '@/lib/api/types';
import { formatDate, formatDateTime, formatMoney, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { productsApi } from '@redux/features/catalog';
import {
  type GrnAddLine,
  type GrnEditRequest,
  type GrnEditStatus,
  type GrnLineChange,
  useDecideGrnEditMutation,
  useEditStoreReceiptMutation,
  useGrnEditRequests,
} from '@redux/features/inventory';

type Receipt = Schemas['StoreReceipt'];

interface LineDraft {
  qty: string;
  batch: string;
  manufacturingDate: string;
  expiryDate: string;
  unitCost: string;
  removed: boolean;
}

interface AddDraft {
  key: number;
  productId: string;
  qty: string;
  batch: string;
  manufacturingDate: string;
  expiryDate: string;
  unitCost: string;
  labels: 'none' | 'generate';
}

const STATUS: Record<GrnEditStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Waiting for the Super Admin', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

const text = (value: string | null | undefined) => value ?? '';
const nullable = (value: string) => (value.trim() === '' ? null : value.trim());
const qtyOf = (value: string | number) => String(Number(value));

function draftOf(line: Receipt['lines'][number]): LineDraft {
  return {
    qty: qtyOf(line.qty),
    batch: text(line.batch),
    manufacturingDate: text(line.manufacturingDate),
    expiryDate: text(line.expiryDate),
    unitCost: line.unitCost === null ? '' : String(Number(line.unitCost)),
    removed: false,
  };
}

const emptyAdd = (key: number): AddDraft => ({
  key,
  productId: '',
  qty: '',
  batch: '',
  manufacturingDate: '',
  expiryDate: '',
  unitCost: '',
  labels: 'none',
});

export function GrnEditSheet({
  receipt,
  direct,
  onClose,
}: {
  receipt: Receipt;
  direct: boolean;
  onClose: () => void;
}) {
  const [save, saveState] = useEditStoreReceiptMutation();
  const products = productsApi.useOptions({}, true);
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>(() =>
    Object.fromEntries(receipt.lines.map((l) => [l.id, draftOf(l)])),
  );
  const [adds, setAdds] = useState<AddDraft[]>([]);
  const [note, setNote] = useState('');
  const busy = saveState.isLoading;

  const setLine = (id: string, change: Partial<LineDraft>) =>
    setDrafts((current) => ({ ...current, [id]: { ...current[id]!, ...change } }));
  const setAdd = (key: number, change: Partial<AddDraft>) =>
    setAdds((current) => current.map((a) => (a.key === key ? { ...a, ...change } : a)));

  const update: GrnLineChange[] = [];
  for (const line of receipt.lines) {
    const draft = drafts[line.id]!;
    if (draft.removed) continue;
    const original = draftOf(line);
    const change: GrnLineChange = { id: line.id };
    if (Number(draft.qty) !== Number(original.qty)) change.qty = draft.qty;
    if (draft.batch.trim() !== original.batch) change.batch = nullable(draft.batch);
    if (draft.manufacturingDate !== original.manufacturingDate)
      change.manufacturingDate = nullable(draft.manufacturingDate);
    if (draft.expiryDate !== original.expiryDate) change.expiryDate = nullable(draft.expiryDate);
    if (draft.unitCost !== original.unitCost) change.unitCost = nullable(draft.unitCost);
    if (Object.keys(change).length > 1) update.push(change);
  }
  const remove = receipt.lines.filter((l) => drafts[l.id]!.removed).map((l) => l.id);
  const add: GrnAddLine[] = adds.map((a) => ({
    productId: a.productId,
    qty: a.qty,
    batch: nullable(a.batch),
    manufacturingDate: nullable(a.manufacturingDate),
    expiryDate: nullable(a.expiryDate),
    unitCost: nullable(a.unitCost),
    labels: a.labels,
  }));
  const badLine = receipt.lines.some((l) => !drafts[l.id]!.removed && !(Number(drafts[l.id]!.qty) > 0));
  const badAdd = adds.some((a) => !a.productId || !(Number(a.qty) > 0));
  const nothing = update.length + remove.length + add.length === 0;
  const allGone = remove.length === receipt.lines.length && add.length === 0;
  const blocked = badLine || badAdd || nothing || allGone;

  const submit = () =>
    save({ grnNo: receipt.grnNo, body: { note: nullable(note), update, add, remove } })
      .unwrap()
      .then((result) => {
        toast.success(
          result.applied
            ? `${receipt.grnNo} updated`
            : `${receipt.grnNo} edit sent to the Super Admin. The stock changes once it is approved.`,
        );
        onClose();
      })
      .catch(toastError);

  return (
    <Sheet open onOpenChange={(open) => !open && !busy && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-5xl">
        <SheetHeader>
          <SheetTitle>Edit {receipt.grnNo}</SheetTitle>
          <SheetDescription>
            {direct
              ? receipt.status === 'pending'
                ? 'This GRN is still waiting for the Warehouse Keeper, so your changes apply at once.'
                : 'Your changes apply at once.'
              : 'This GRN is already confirmed. Your changes go to the Super Admin; the stock changes only after approval.'}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-4">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Product</th>
                  <th className="px-3 py-2 text-left font-medium">Qty</th>
                  <th className="px-3 py-2 text-left font-medium">Batch</th>
                  <th className="px-3 py-2 text-left font-medium">Mfg date</th>
                  <th className="px-3 py-2 text-left font-medium">Expiry</th>
                  <th className="px-3 py-2 text-left font-medium">Unit cost</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {receipt.lines.map((line) => {
                  const draft = drafts[line.id]!;
                  const relabel =
                    line.labels > 0 &&
                    (Number(draft.qty) !== Number(line.qty) || draft.batch.trim() !== text(line.batch));
                  return (
                    <tr key={line.id} className={cn('align-top', draft.removed && 'bg-destructive-soft/40')}>
                      <td className="px-3 py-2">
                        <div className={cn('font-medium', draft.removed && 'line-through')}>
                          {line.productName}
                        </div>
                        {line.labels > 0 ? (
                          <div className="text-xs text-muted-foreground">{line.labels} labels</div>
                        ) : null}
                        {relabel ? (
                          <div className="mt-1 text-xs text-warning-soft-foreground">
                            New labels are printed for this line
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <MoneyInput
                          prefix=""
                          decimals={3}
                          className="h-8 w-24"
                          aria-label={`${line.productName} qty`}
                          disabled={draft.removed}
                          value={draft.qty}
                          onChange={(e) => setLine(line.id, { qty: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="h-8 w-32"
                          aria-label={`${line.productName} batch`}
                          disabled={draft.removed}
                          value={draft.batch}
                          onChange={(e) => setLine(line.id, { batch: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="date"
                          className="h-8 w-36"
                          aria-label={`${line.productName} manufacturing date`}
                          disabled={draft.removed}
                          value={draft.manufacturingDate}
                          onChange={(e) => setLine(line.id, { manufacturingDate: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="date"
                          className="h-8 w-36"
                          aria-label={`${line.productName} expiry`}
                          disabled={draft.removed}
                          value={draft.expiryDate}
                          onChange={(e) => setLine(line.id, { expiryDate: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <MoneyInput
                          className="h-8 w-28"
                          aria-label={`${line.productName} unit cost`}
                          disabled={draft.removed}
                          value={draft.unitCost}
                          onChange={(e) => setLine(line.id, { unitCost: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn('size-8', !draft.removed && 'text-destructive')}
                          aria-label={
                            draft.removed ? `Keep ${line.productName}` : `Remove ${line.productName}`
                          }
                          onClick={() => setLine(line.id, { removed: !draft.removed })}
                        >
                          {draft.removed ? <Undo2 /> : <Trash2 />}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {adds.map((a) => (
                  <tr key={a.key} className="bg-success-soft/30 align-top">
                    <td className="px-3 py-2">
                      <Combobox
                        className="w-56"
                        value={a.productId || null}
                        onChange={(value) => setAdd(a.key, { productId: value ?? '' })}
                        options={(products.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                        placeholder="Choose product"
                        aria-label="New product"
                      />
                      <Select
                        value={a.labels}
                        onValueChange={(v) => setAdd(a.key, { labels: v as AddDraft['labels'] })}
                      >
                        <SelectTrigger size="sm" className="mt-1 w-56" aria-label="Labels">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No labels</SelectItem>
                          <SelectItem value="generate">Print new labels</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <MoneyInput
                        prefix=""
                        decimals={3}
                        className="h-8 w-24"
                        aria-label="New product qty"
                        value={a.qty}
                        onChange={(e) => setAdd(a.key, { qty: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-8 w-32"
                        aria-label="New product batch"
                        value={a.batch}
                        onChange={(e) => setAdd(a.key, { batch: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="date"
                        className="h-8 w-36"
                        aria-label="New product manufacturing date"
                        value={a.manufacturingDate}
                        onChange={(e) => setAdd(a.key, { manufacturingDate: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="date"
                        className="h-8 w-36"
                        aria-label="New product expiry"
                        value={a.expiryDate}
                        onChange={(e) => setAdd(a.key, { expiryDate: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <MoneyInput
                        className="h-8 w-28"
                        aria-label="New product unit cost"
                        value={a.unitCost}
                        onChange={(e) => setAdd(a.key, { unitCost: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label="Drop this new line"
                        onClick={() => setAdds((current) => current.filter((x) => x.key !== a.key))}
                      >
                        <X />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={adds.length >= 20}
            onClick={() => setAdds((current) => [...current, emptyAdd(Date.now())])}
          >
            <Plus />
            Add product
          </Button>
          {allGone ? (
            <p className="text-sm text-destructive">A GRN needs at least one line. Keep or add a line.</p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="grn-edit-note">
              Why this change {direct ? '' : '(the Super Admin sees this)'}
            </Label>
            <Textarea
              id="grn-edit-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. One more pack came in the box"
            />
          </div>
        </div>
        <SheetFooter className="flex-row justify-end gap-2 border-t px-4 py-3">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={blocked || busy}>
            {busy ? <Loader2 className="animate-spin" /> : direct ? <Check /> : <Send />}
            {direct ? 'Save changes' : 'Send for approval'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ChangeList({ request }: { request: GrnEditRequest }) {
  const nameOf = (id: string) => request.before.find((b) => b.id === id)?.productName ?? 'Line';
  const rows: { tone: 'change' | 'add' | 'remove'; text: string }[] = [];
  for (const change of request.changes.update) {
    const before = request.before.find((b) => b.id === change.id);
    const parts: string[] = [];
    if (change.qty !== undefined)
      parts.push(`qty ${formatQuantity(before?.qty ?? 0)} → ${formatQuantity(change.qty)}`);
    if (change.batch !== undefined) parts.push(`batch ${before?.batch ?? '—'} → ${change.batch ?? '—'}`);
    if (change.manufacturingDate !== undefined)
      parts.push(`mfg ${formatDate(before?.manufacturingDate)} → ${formatDate(change.manufacturingDate)}`);
    if (change.expiryDate !== undefined)
      parts.push(`expiry ${formatDate(before?.expiryDate)} → ${formatDate(change.expiryDate)}`);
    if (change.unitCost !== undefined)
      parts.push(`cost ${formatMoney(before?.unitCost)} → ${formatMoney(change.unitCost)}`);
    rows.push({ tone: 'change', text: `${nameOf(change.id)}: ${parts.join(', ')}` });
  }
  for (const id of request.changes.remove) {
    const before = request.before.find((b) => b.id === id);
    rows.push({ tone: 'remove', text: `Remove ${nameOf(id)} (${formatQuantity(before?.qty ?? 0)})` });
  }
  for (const a of request.changes.add) {
    rows.push({
      tone: 'add',
      text: `Add ${a.productName ?? 'product'} × ${formatQuantity(a.qty)}${a.batch ? ` · batch ${a.batch}` : ''}${a.expiryDate ? ` · expiry ${formatDate(a.expiryDate)}` : ''}`,
    });
  }
  return (
    <ul className="space-y-1 text-sm">
      {rows.map((r, i) => (
        <li key={i} className="flex items-start gap-2">
          <span
            className={cn(
              'mt-0.5 rounded px-1.5 py-0.5 text-xs font-semibold',
              r.tone === 'add' && 'bg-success-soft text-success-soft-foreground',
              r.tone === 'remove' && 'bg-destructive-soft text-destructive-soft-foreground',
              r.tone === 'change' && 'bg-info-soft text-info-soft-foreground',
            )}
          >
            {r.tone === 'add' ? 'Add' : r.tone === 'remove' ? 'Remove' : 'Change'}
          </span>
          <span>{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function GrnEditRequests({ canDecide }: { canDecide: boolean }) {
  const requests = useGrnEditRequests();
  const [decide, decideState] = useDecideGrnEditMutation();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const answer = (request: GrnEditRequest, approve: boolean) =>
    decide({ id: request.id, approve, note: notes[request.id]?.trim() || null })
      .unwrap()
      .then(() =>
        toast.success(`${request.grnNo} edit ${approve ? 'approved; the stock is updated' : 'rejected'}`),
      )
      .catch(toastError);

  if (requests.isLoading) return <Skeleton className="h-40 rounded-xl" />;
  if (requests.error) return <ErrorState error={requests.error} onRetry={() => void requests.refetch()} />;
  if ((requests.data ?? []).length === 0)
    return (
      <EmptyState
        icon={Check}
        title="No GRN edits"
        description="When the Lab Officer changes a confirmed GRN, the change waits here for the Super Admin."
      />
    );
  return (
    <div className="space-y-4">
      {(requests.data ?? []).map((r) => {
        const look = STATUS[r.status];
        return (
          <section key={r.id} className="overflow-hidden rounded-xl border bg-card shadow-xs">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.grnNo}</span>
                  <StatusBadge tone={look.tone}>{look.label}</StatusBadge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.branchName} · asked by {r.requestedBy?.name ?? '—'} on {formatDateTime(r.createdAt)}
                  {r.decidedBy && r.decidedAt
                    ? ` · ${r.status} by ${r.decidedBy.name} on ${formatDateTime(r.decidedAt)}`
                    : ''}
                </div>
              </div>
            </header>
            <div className="space-y-3 px-4 py-3">
              {r.note ? <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">“{r.note}”</p> : null}
              <ChangeList request={r} />
              {r.decisionNote ? (
                <p className="text-sm text-muted-foreground">Super Admin: {r.decisionNote}</p>
              ) : null}
              {canDecide && r.status === 'pending' ? (
                <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                  <Input
                    className="h-9 min-w-56 flex-1"
                    placeholder="Note (optional)"
                    aria-label={`Note for ${r.grnNo}`}
                    value={notes[r.id] ?? ''}
                    onChange={(e) => setNotes((current) => ({ ...current, [r.id]: e.target.value }))}
                  />
                  <Button
                    variant="outline"
                    disabled={decideState.isLoading}
                    onClick={() => void answer(r, false)}
                  >
                    <X />
                    Reject
                  </Button>
                  <Button disabled={decideState.isLoading} onClick={() => void answer(r, true)}>
                    {decideState.isLoading ? <Loader2 className="animate-spin" /> : <Check />}
                    Approve
                  </Button>
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
