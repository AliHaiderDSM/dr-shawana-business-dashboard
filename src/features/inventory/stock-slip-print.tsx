import { useSearchParams } from 'react-router';
import { Letterhead, PrintPage, PrintTable, SignatureLine } from '@/components/shared/print-document';
import { formatDate, formatQuantity } from '@/lib/format';
import { stockLineDetail, stockParty, useStockDocumentsByIds, type StockKind } from './api';
import { STOCK_KINDS } from './stock-config';

export function StockSlipPrint({ kind }: { kind: StockKind }) {
  const config = STOCK_KINDS[kind];
  const [params] = useSearchParams();
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean);
  const query = useStockDocumentsByIds(kind, ids);

  return (
    <PrintPage isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}>
      {() => {
        const rows = query.data ?? [];
        const total = rows.reduce((sum, r) => sum + Number(r.qty), 0);
        const first = rows[0];
        return (
          <div className="space-y-6">
            <Letterhead
              title={config.slipTitle}
              subtitle={first ? `Entered ${formatDate(first.createdAt, 'dd-MM-yyyy h:mm a')}` : undefined}
            />
            {kind === 'in' ? (
              <PrintTable
                head={['Sr', 'Date', 'Supplier', 'Product', 'Batch', 'Qty']}
                rows={rows.map((r, i) => [
                  i + 1,
                  formatDate(r.date, 'dd-MM-yyyy'),
                  stockParty(r)?.name ?? '—',
                  r.product?.name ?? '—',
                  stockLineDetail(r) ?? '—',
                  formatQuantity(r.qty),
                ])}
                foot={[<span key="t">Total</span>, '', '', '', '', formatQuantity(total)]}
              />
            ) : (
              <PrintTable
                head={['Sr', 'Date', 'Dispatcher', 'Product', 'Qty', 'Stock To']}
                rows={rows.map((r, i) => [
                  i + 1,
                  formatDate(r.date, 'dd-MM-yyyy'),
                  stockParty(r)?.name ?? '—',
                  r.product?.name ?? '—',
                  formatQuantity(r.qty),
                  stockLineDetail(r) ?? '—',
                ])}
                foot={[<span key="t">Total</span>, '', '', '', formatQuantity(total), '']}
              />
            )}
            {first?.note ? <p className="text-sm">Note: {first.note}</p> : null}
            <div className="flex pt-10">
              <SignatureLine label="Received by" />
              <SignatureLine label="Authorized signature" />
            </div>
          </div>
        );
      }}
    </PrintPage>
  );
}

export function StockInSlipPrint() {
  return <StockSlipPrint kind="in" />;
}

export function StockOutSlipPrint() {
  return <StockSlipPrint kind="out" />;
}
