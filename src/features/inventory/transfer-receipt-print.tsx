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

const ISSUE_LABELS: Record<string, string> = { missing: 'Missing', damaged: 'Damaged' };

export function TransferReceiptPrint() {
  const [params] = useSearchParams();
  const transferNo = (params.get('transfer') ?? '').toUpperCase();
  const query = useIncomingTransferByNo(transferNo);

  return (
    <PrintPage isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}>
      {() => {
        const t = query.data;
        if (!t) return <p className="text-sm">No transfer has the number {transferNo}.</p>;
        const arrivedOf = (item: (typeof t.items)[number]) => Number(item.qty) - item.issues.length;
        const sent = t.items.reduce((sum, i) => sum + Number(i.qty), 0);
        const arrived = t.items.reduce((sum, i) => sum + arrivedOf(i), 0);
        const issues = t.items.flatMap((item) =>
          item.issues.map((issue) => ({ ...issue, product: item.productName })),
        );
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
              head={['Sr', 'Product', 'Sent', 'Arrived', 'Missing', 'Damaged']}
              rows={t.items.map((item, i) => [
                i + 1,
                item.productName,
                `${formatQuantity(item.qty)} ${item.unit}`,
                t.received ? `${formatQuantity(String(arrivedOf(item)))} ${item.unit}` : '—',
                item.issues.filter((x) => x.reason === 'missing').length || '—',
                item.issues.filter((x) => x.reason === 'damaged').length || '—',
              ])}
              foot={[
                <span key="t">Total</span>,
                '',
                formatQuantity(String(sent)),
                t.received ? formatQuantity(String(arrived)) : '—',
                issues.filter((x) => x.reason === 'missing').length || '—',
                issues.filter((x) => x.reason === 'damaged').length || '—',
              ]}
            />
            {issues.length ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Missing or damaged pieces (under observation)</h3>
                <PrintTable
                  head={['Sr', 'Label', 'Product', 'Problem', 'Number']}
                  rows={issues.map((issue, i) => [
                    i + 1,
                    issue.serial,
                    issue.product,
                    ISSUE_LABELS[issue.reason] ?? issue.reason,
                    issue.holdNo,
                  ])}
                />
              </div>
            ) : null}
            {t.note ? <p className="text-sm">Note: {t.note}</p> : null}
            <p className="text-xs text-muted-foreground">
              Match the physical stock with this sheet. Only the arrived pieces are in the branch stock;
              missing or damaged pieces wait under observation for the Super Admin.
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
