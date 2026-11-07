import { Eye, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { BarcodeScanInput } from '@/components/shared/barcode-scan-input';
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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { normalizeSerial } from '@/features/inventory/constants';
import { toastError } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/format';
import {
  useReportStockHoldMutation,
  type StockHold,
  type StockHoldReason,
  type StockHoldStatus,
} from '@redux/features/stock-holds';

export const HOLD_REASON_LABELS: Record<StockHoldReason, string> = {
  damaged: 'Damaged',
  expired: 'Expired',
  label_issue: 'Label issue',
  other: 'Other',
};

export const HOLD_REASON_TONES: Record<StockHoldReason, Tone> = {
  damaged: 'danger',
  expired: 'warning',
  label_issue: 'info',
  other: 'neutral',
};

export const HOLD_STATUS: Record<StockHoldStatus, { label: string; tone: Tone }> = {
  open: { label: 'Under observation', tone: 'warning' },
  released: { label: 'Released to stock', tone: 'success' },
  written_off: { label: 'Written off', tone: 'danger' },
  supplier_returned: { label: 'Sent to supplier', tone: 'neutral' },
};

const REASONS = Object.keys(HOLD_REASON_LABELS) as StockHoldReason[];

export function HoldStatusBadge({ status }: { status: StockHoldStatus }) {
  return <StatusBadge tone={HOLD_STATUS[status].tone}>{HOLD_STATUS[status].label}</StatusBadge>;
}

export interface ReportContext {
  title: string;
  saleId?: string;
  stockRequestId?: string;
}

export function ReportIssueDialog({
  context,
  serial: initialSerial = '',
  onClose,
  onReported,
}: {
  context: ReportContext;
  serial?: string;
  onClose: () => void;
  onReported?: (hold: StockHold) => void;
}) {
  const [report, reportState] = useReportStockHoldMutation();
  const [serial, setSerial] = useState(initialSerial);
  const [reason, setReason] = useState<StockHoldReason>('damaged');
  const [note, setNote] = useState('');
  const busy = reportState.isLoading;

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Put a piece under observation</DialogTitle>
          <DialogDescription>
            {context.title}. The piece stays out of every sale and transfer until the Warehouse Keeper or the
            Dispatch Department admin decides.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>DSM label</Label>
            {serial ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                <span className="font-mono text-sm font-medium">{serial}</span>
                {initialSerial ? null : (
                  <Button variant="ghost" size="sm" onClick={() => setSerial('')} disabled={busy}>
                    Change
                  </Button>
                )}
              </div>
            ) : (
              <BarcodeScanInput
                autoFocus
                placeholder="Scan the label of the piece"
                onScan={async (code) => setSerial(normalizeSerial(code))}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as StockHoldReason)}>
              <SelectTrigger className="w-full" aria-label="Reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {HOLD_REASON_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hold-note">Note</Label>
            <Textarea
              id="hold-note"
              placeholder="What is wrong with it?"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={!serial || busy}
            onClick={() =>
              report({
                serial,
                reason,
                note: note.trim() || null,
                ...(context.saleId ? { saleId: context.saleId } : {}),
                ...(context.stockRequestId ? { stockRequestId: context.stockRequestId } : {}),
              })
                .unwrap()
                .then((hold) => {
                  toast.success(`${hold.serial} is under observation (${hold.holdNo})`);
                  onReported?.(hold);
                  onClose();
                })
                .catch(toastError)
            }
          >
            {busy ? <Loader2 className="animate-spin" /> : <Eye />}
            Put under observation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface HoldLine {
  id: string;
  holdNo: string;
  serial: string;
  productName: string;
  reason: StockHoldReason;
  note: string | null;
  status: StockHoldStatus;
  decisionNote: string | null;
  createdAt: string;
}

export function HoldsTable({ holds, title = 'Under observation' }: { holds: HoldLine[]; title?: string }) {
  if (holds.length === 0) return null;
  const open = holds.filter((h) => h.status === 'open').length;
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Eye className="size-4 text-warning" />
        {title}
        {open ? (
          <span className="font-normal text-muted-foreground">· {open} waiting for a decision</span>
        ) : null}
      </h3>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Label</th>
              <th className="px-3 py-2 text-left font-medium">Product</th>
              <th className="px-3 py-2 text-left font-medium">Why</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {holds.map((h) => (
              <tr key={h.id} className="align-top">
                <td className="px-3 py-2">
                  <div className="font-mono text-xs font-medium">{h.serial}</div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</div>
                </td>
                <td className="px-3 py-2 font-medium">{h.productName}</td>
                <td className="px-3 py-2">
                  <StatusBadge tone={HOLD_REASON_TONES[h.reason]}>{HOLD_REASON_LABELS[h.reason]}</StatusBadge>
                  {h.note ? (
                    <div className="mt-1 max-w-56 text-xs text-muted-foreground">{h.note}</div>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <HoldStatusBadge status={h.status} />
                  {h.decisionNote ? (
                    <div className="mt-1 max-w-56 text-xs text-muted-foreground">“{h.decisionNote}”</div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export const holdLineOf = (h: StockHold): HoldLine => ({
  id: h.id,
  holdNo: h.holdNo,
  serial: h.serial,
  productName: h.product.name,
  reason: h.reason,
  note: h.note,
  status: h.status,
  decisionNote: h.decisionNote,
  createdAt: h.createdAt,
});
