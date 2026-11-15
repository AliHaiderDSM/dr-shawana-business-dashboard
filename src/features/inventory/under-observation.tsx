import { Eye, Loader2, X } from 'lucide-react';
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
  type ReportStockHoldInput,
  type StockHold,
  type StockHoldReason,
  type StockHoldStatus,
} from '@redux/features/stock-holds';

export const HOLD_REASON_LABELS: Record<StockHoldReason, string> = {
  damaged: 'Damaged',
  expired: 'Expired',
  label_issue: 'Label issue',
  other: 'Other',
  missing: 'Missing',
};

export const HOLD_REASON_TONES: Record<StockHoldReason, Tone> = {
  damaged: 'danger',
  expired: 'warning',
  label_issue: 'info',
  other: 'neutral',
  missing: 'danger',
};

export const HOLD_STATUS: Record<StockHoldStatus, { label: string; tone: Tone }> = {
  open: { label: 'Under observation', tone: 'warning' },
  released: { label: 'Released to stock', tone: 'success' },
  written_off: { label: 'Written off', tone: 'danger' },
  supplier_returned: { label: 'Sent to supplier', tone: 'neutral' },
  sent_back: { label: 'Back to Super Admin stock', tone: 'info' },
};

type ReportReason = ReportStockHoldInput['reason'];
const REASONS: ReportReason[] = ['damaged', 'label_issue', 'other'];

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
  onReported?: (holds: StockHold[]) => void;
}) {
  const [report, reportState] = useReportStockHoldMutation();
  const [serials, setSerials] = useState<string[]>(initialSerial ? [initialSerial] : []);
  const [reason, setReason] = useState<ReportReason>('damaged');
  const [note, setNote] = useState('');
  const busy = reportState.isLoading;

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Put pieces under observation</DialogTitle>
          <DialogDescription>
            {context.title}. Scan every piece with the same problem. They stay out of every sale and transfer
            until the Super Admin, the Warehouse Keeper or the Dispatch Department admin decides.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>DSM labels {serials.length ? `(${serials.length})` : ''}</Label>
            <BarcodeScanInput
              autoFocus
              placeholder="Scan a label, then the next one"
              onScan={async (code) => {
                const serial = normalizeSerial(code);
                if (serials.includes(serial)) {
                  toast.info(`${serial} is already on the list`);
                  return;
                }
                setSerials((current) => [...current, serial]);
              }}
            />
            {serials.length ? (
              <div className="flex flex-wrap gap-1.5">
                {serials.map((serial) => (
                  <span
                    key={serial}
                    className="inline-flex items-center gap-1 rounded-md border bg-muted/40 py-0.5 pr-1 pl-2 font-mono text-xs font-medium"
                  >
                    {serial}
                    <button
                      type="button"
                      aria-label={`Remove ${serial}`}
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      disabled={busy}
                      onClick={() => setSerials((current) => current.filter((s) => s !== serial))}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as ReportReason)}>
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
            disabled={serials.length === 0 || busy}
            onClick={() =>
              report({
                serials,
                reason,
                note: note.trim() || null,
                ...(context.saleId ? { saleId: context.saleId } : {}),
                ...(context.stockRequestId ? { stockRequestId: context.stockRequestId } : {}),
              })
                .unwrap()
                .then((holds) => {
                  toast.success(
                    holds.length === 1
                      ? `${holds[0]!.serial} is under observation (${holds[0]!.holdNo})`
                      : `${holds.length} pieces are under observation`,
                  );
                  onReported?.(holds);
                  onClose();
                })
                .catch(toastError)
            }
          >
            {busy ? <Loader2 className="animate-spin" /> : <Eye />}
            {serials.length > 1 ? `Put ${serials.length} under observation` : 'Put under observation'}
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
