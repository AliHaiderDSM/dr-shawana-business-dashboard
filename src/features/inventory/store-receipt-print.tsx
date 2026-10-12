import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import {
  Letterhead,
  PrintField,
  PrintPage,
  PrintTable,
  SignatureLine,
} from '@/components/shared/print-document';
import { api, unwrap } from '@/lib/api/client';
import { formatDate, formatDateTime, formatQuantity } from '@/lib/format';

export function StoreReceiptPrint() {
  const [params] = useSearchParams();
  const grnNo = (params.get('grn') ?? '').toUpperCase();
  const query = useQuery({
    queryKey: ['stock', 'receipts', 'print', grnNo],
    queryFn: () =>
      unwrap(api.GET('/branch/stock-receipts', { params: { query: { grnNo } } })).then(
        (r) => r.data[0] ?? null,
      ),
    enabled: grnNo.length > 0,
  });

  return (
    <PrintPage isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}>
      {() => {
        const r = query.data;
        if (!r) return <p className="text-sm">No receipt has the number {grnNo}.</p>;
        const entered = r.lines.reduce((sum, l) => sum + Number(l.qty), 0);
        const received = r.lines.reduce((sum, l) => sum + Number(l.receivedQty ?? 0), 0);
        const confirmed = r.status === 'confirmed';
        return (
          <div className="space-y-6">
            <Letterhead title="Goods Received Note" subtitle={r.grnNo} />
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <PrintField label="GRN No" value={r.grnNo} />
              <PrintField
                label="Status"
                value={confirmed ? 'Received and checked' : 'Waiting for the store check'}
              />
              <PrintField label="Stock In date" value={formatDate(r.date, 'dd-MM-yyyy')} />
              <PrintField label="Supplier" value={r.supplier ?? '—'} />
              <PrintField label="Entered by" value={r.enteredBy?.name ?? '—'} />
              <PrintField label="Entered on" value={formatDateTime(r.createdAt)} />
              <PrintField label="Checked by" value={r.confirmedBy?.name ?? '—'} />
              <PrintField label="Checked on" value={r.confirmedAt ? formatDateTime(r.confirmedAt) : '—'} />
            </div>
            <PrintTable
              head={['Sr', 'Product', 'Batch', 'Expiry', 'Entered', 'Received', 'Short', 'Note']}
              rows={r.lines.map((l, i) => {
                const short = l.receivedQty === null ? null : Number(l.qty) - Number(l.receivedQty);
                return [
                  i + 1,
                  l.productName,
                  l.batch ?? '—',
                  l.expiryDate ? formatDate(l.expiryDate, 'dd-MM-yyyy') : '—',
                  `${formatQuantity(l.qty)} ${l.unit}`,
                  l.receivedQty === null ? '' : formatQuantity(l.receivedQty),
                  short ? formatQuantity(String(short)) : short === 0 ? '0' : '',
                  l.receiptNote ?? '',
                ];
              })}
              foot={[
                <span key="t">Total</span>,
                '',
                '',
                '',
                formatQuantity(String(entered)),
                confirmed ? formatQuantity(String(received)) : '',
                confirmed ? formatQuantity(String(entered - received)) : '',
                '',
              ]}
            />
            {r.note ? <p className="text-sm">Note: {r.note}</p> : null}
            <p className="text-xs text-muted-foreground">
              Match the physical stock with this sheet. Only the received quantity is in the Super Admin
              stock.
            </p>
            <div className="flex pt-10">
              <SignatureLine label="Entered by (Lab Officer)" />
              <SignatureLine label="Received & checked by (Warehouse Keeper)" />
              <SignatureLine label="Authorized signature" />
            </div>
          </div>
        );
      }}
    </PrintPage>
  );
}
