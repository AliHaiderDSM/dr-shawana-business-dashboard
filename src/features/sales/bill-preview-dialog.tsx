import { Download, Loader2, Printer } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useBill } from './api';
import { BillSheet } from './bill-print';

async function downloadPdf(node: HTMLElement, fileName: string) {
  const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  const image = await toPng(node, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true });
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const margin = 10;
  const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = pdf.internal.pageSize.getHeight() - margin * 2;
  const height = (node.offsetHeight * pageWidth) / node.offsetWidth;
  let offset = 0;
  while (offset < height) {
    if (offset > 0) pdf.addPage();
    pdf.addImage(image, 'PNG', margin, margin - offset, pageWidth, height);
    offset += pageHeight;
  }
  pdf.save(fileName);
}

export function BillPreviewDialog({
  saleId,
  invoiceNo,
  open,
  onClose,
}: {
  saleId: string;
  invoiceNo: string;
  open: boolean;
  onClose: () => void;
}) {
  const bill = useBill(saleId);
  const sheet = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  const download = async () => {
    if (!sheet.current) return;
    setSaving(true);
    try {
      await downloadPdf(sheet.current, `Bill-${invoiceNo}.pdf`);
    } catch {
      toast.error('Could not make the PDF. Use Print and choose Save as PDF.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-4 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Bill {invoiceNo}</DialogTitle>
          <DialogDescription>Check the bill, then download it as a PDF or print it.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-muted/40 p-4">
          {bill.isLoading ? (
            <div className="space-y-4 bg-card p-8">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : bill.error || !bill.data ? (
            <ErrorState error={bill.error} onRetry={() => void bill.refetch()} />
          ) : (
            <div ref={sheet} className="mx-auto max-w-[210mm] bg-card p-10 text-card-foreground shadow-sm">
              <BillSheet bill={bill.data} />
            </div>
          )}
        </div>
        <DialogFooter className="flex-row flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="outline"
            disabled={!bill.data}
            onClick={() => window.open(`/print/bill/${saleId}`, '_blank', 'noopener')}
          >
            <Printer />
            Print
          </Button>
          <Button disabled={!bill.data || saving} onClick={() => void download()}>
            {saving ? <Loader2 className="animate-spin" /> : <Download />}
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
