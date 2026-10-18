import { useSearchParams } from 'react-router';
import {
  Letterhead,
  PrintField,
  PrintPage,
  PrintTable,
  SignatureLine,
} from '@/components/shared/print-document';
import { formatDate, formatDateTime, formatQuantity } from '@/lib/format';
import { useIncomingTransferByNo } from '@redux/features/stock-requests';

export function TransferReceiptPrint() {
  const [params] = useSearchParams();
  const transferNo = (params.get('transfer') ?? '').toUpperCase();
  const query = useIncomingTransferByNo(transferNo);

  return (
    <PrintPage isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}>
      {() => {
        const t = query.data;
        if (!t) return <p className="text-sm">No transfer has the number {transferNo}.</p>;
        const total = t.items.reduce((sum, i) => sum + Number(i.qty), 0);
        const labels = t.items.reduce((sum, i) => sum + i.labels, 0);
        return (
          <div className="space-y-6">
            <Letterhead title="Stock Receiving Receipt" subtitle={t.transferNo} />
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <PrintField label="Transfer No" value={t.transferNo} />
              <PrintField label="Request No" value={t.request?.requestNo ?? '—'} />
              <PrintField label="Received by branch" value={`${t.toBranch.name} · ${t.toBranch.code}`} />
              <PrintField label="Status" value={t.received ? 'Received' : 'Waiting for the branch admin'} />
              <PrintField label="Sent on" value={formatDate(t.date, 'dd-MM-yyyy')} />
              <PrintField label="Sent by" value={t.sentBy?.name ?? '—'} />
              <PrintField label="Received on" value={t.receivedAt ? formatDateTime(t.receivedAt) : '—'} />
              <PrintField label="Received by" value={t.receivedBy?.name ?? '—'} />
            </div>
            <PrintTable
              head={['Sr', 'Product', 'Qty', 'Labelled pieces', 'Received']}
              rows={t.items.map((item, i) => [
                i + 1,
                item.productName,
                `${formatQuantity(item.qty)} ${item.unit}`,
                item.labels || '—',
                item.received ? 'Yes' : 'No',
              ])}
              foot={[<span key="t">Total</span>, '', formatQuantity(String(total)), labels || '—', '']}
            />
            {t.note ? <p className="text-sm">Note: {t.note}</p> : null}
            <p className="text-xs text-muted-foreground">
              Match the physical stock with this sheet. The received stock is in the branch Stock In.
            </p>
            <div className="flex pt-10">
              <SignatureLine label="Sent by (Warehouse Keeper)" />
              <SignatureLine label="Received & checked by (Branch Admin)" />
              <SignatureLine label="Authorized signature" />
            </div>
          </div>
        );
      }}
    </PrintPage>
  );
}
