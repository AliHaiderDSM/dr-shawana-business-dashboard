import { useParams } from 'react-router';
import {
  Letterhead,
  PrintField,
  PrintPage,
  PrintTable,
  SignatureLine,
} from '@/components/shared/print-document';
import { formatDate, formatQuantity } from '@/lib/format';
import { salesApi } from '@redux/features/sales';

export function GdnPrint() {
  const { id = '' } = useParams();
  const sale = salesApi.useDetail(id);

  return (
    <PrintPage isLoading={sale.isLoading} error={sale.error} onRetry={() => void sale.refetch()}>
      {() => {
        const s = sale.data;
        const g = s?.gdn;
        if (!s || !g)
          return <p className="text-sm">This order has not been dispatched yet, so it has no GDN.</p>;
        const nameOf = (productId: string) =>
          s.items.find((i) => i.productId === productId)?.product?.name ?? 'Product';
        const labelsOf = (productId: string) =>
          (s.serials ?? []).filter((p) => p.productId === productId).map((p) => p.serial);
        const rows = (s.batches ?? []).length
          ? (s.batches ?? []).map((b) => ({
              productId: b.productId,
              batch: b.batchNo,
              manufactured: b.manufacturingDate,
              expiry: b.expiryDate,
              qty: b.qty,
            }))
          : s.items.map((i) => ({
              productId: i.productId,
              batch: null,
              manufactured: null,
              expiry: null,
              qty: i.qty,
            }));
        const total = rows.reduce((sum, r) => sum + Number(r.qty), 0);
        return (
          <div className="space-y-6">
            <Letterhead title="Goods Dispatch Note" subtitle={g.gdnNo} />
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <PrintField label="GDN No" value={g.gdnNo} />
              <PrintField label="Order No" value={s.invoiceNo} />
              <PrintField
                label="Dispatch date"
                value={g.dispatchedOn ? formatDate(g.dispatchedOn, 'dd-MM-yyyy') : '—'}
              />
              <PrintField label="Order date" value={formatDate(s.date, 'dd-MM-yyyy')} />
              <PrintField label="Dispatched from" value={g.from ? `${g.from.name} (${g.from.code})` : '—'} />
              <PrintField
                label="Booked at"
                value={g.bookedAt ? `${g.bookedAt.name} (${g.bookedAt.code})` : '—'}
              />
              <PrintField label="Dispatched by" value={g.dispatchedBy ?? '—'} />
              <PrintField
                label="Customer"
                value={g.customer ? `${g.customer.name} · ${g.customer.phone}` : '—'}
              />
              <PrintField
                label="Deliver to"
                value={g.customer ? [g.customer.address, g.customer.city].filter(Boolean).join(', ') : '—'}
              />
            </div>
            <PrintTable
              head={['Sr', 'Product', 'Batch', 'Mfg', 'Expiry', 'Qty', 'Labels']}
              rows={rows.map((r, i) => [
                i + 1,
                nameOf(r.productId),
                r.batch ?? '—',
                r.manufactured ? formatDate(r.manufactured, 'dd-MM-yyyy') : '—',
                r.expiry ? formatDate(r.expiry, 'dd-MM-yyyy') : '—',
                formatQuantity(r.qty),
                labelsOf(r.productId).join(', '),
              ])}
              foot={[<span key="t">Total</span>, '', '', '', '', formatQuantity(String(total)), '']}
            />
            {s.note ? <p className="text-sm">Note: {s.note}</p> : null}
            <p className="text-xs text-muted-foreground">
              Check the parcel against this sheet before it leaves. Every product here left the stock on the
              dispatch date.
            </p>
            <div className="flex pt-10">
              <SignatureLine label="Packed by" />
              <SignatureLine label="Dispatched by" />
              <SignatureLine label="Received by (courier / customer)" />
            </div>
          </div>
        );
      }}
    </PrintPage>
  );
}
