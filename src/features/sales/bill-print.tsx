import { useParams } from 'react-router';
import { Letterhead, PrintPage, PrintTable } from '@/components/shared/print-document';
import { formatDate, formatMoney, formatQuantity } from '@/lib/format';
import { SALE_TYPE_LABELS, useBill } from './api';

export function BillPrint() {
  const { id = '' } = useParams();
  const bill = useBill(id);

  return (
    <PrintPage isLoading={bill.isLoading} error={bill.error} onRetry={() => void bill.refetch()}>
      {() => {
        const b = bill.data;
        if (!b) return null;
        const org = b.company
          ? {
              name: b.company.name,
              lines: [
                b.company.phone ? `Phone No: ${b.company.phone}` : null,
                b.company.address,
                `${b.branch.name}, ${b.branch.city}`,
              ],
            }
          : {
              name: b.branch.name,
              lines: [b.branch.phone ? `Phone No: ${b.branch.phone}` : null, b.branch.address, b.branch.city],
            };
        const summary: [string, string][] = [
          ['Total Qty', formatQuantity(b.sale.totalQty)],
          ['Sub Amount', formatMoney(b.sale.subtotal)],
          [`Discount (${Number(b.sale.discountPercent)}%)`, formatMoney(b.sale.discountAmount)],
          ['After Discount Price', formatMoney(b.sale.total)],
          ['Received', formatMoney(b.sale.received)],
          ['Remaining', formatMoney(b.sale.remaining)],
        ];
        return (
          <div className="space-y-6 text-sm">
            <Letterhead title="Bill" subtitle={SALE_TYPE_LABELS[b.sale.saleType]} organization={org} />
            <div className="flex justify-between gap-6">
              <div>
                <div>
                  <span className="font-semibold">Customer: </span>
                  {b.customer ? `${b.customer.name} ${b.customer.phone}` : '—'}
                </div>
                <div>
                  <span className="font-semibold">Address: </span>
                  {b.customer?.address ?? b.customer?.city ?? '—'}
                </div>
              </div>
              <div className="text-right">
                <div>
                  <span className="font-semibold">Bill No: </span>ORD#{b.sale.invoiceNo}
                </div>
                <div>
                  <span className="font-semibold">Date: </span>
                  {formatDate(b.sale.date, 'dd-MM-yyyy')}
                </div>
              </div>
            </div>
            {(['cash', 'online'] as const).map((method) =>
              b.payments[method].length ? (
                <div key={method} className="space-y-1">
                  <div className="font-semibold">
                    Payment Method: {method === 'cash' ? 'Cash Payment' : 'Online Payment'}
                  </div>
                  {b.payments[method].map((p) => (
                    <div key={p.id} className="flex gap-6 text-muted-foreground">
                      <span>Amount: {formatMoney(p.amount)}</span>
                      <span>Date: {formatDate(p.date, 'dd-MM-yyyy')}</span>
                      {method === 'online' && p.senderBank ? <span>Bank: {p.senderBank}</span> : null}
                    </div>
                  ))}
                </div>
              ) : null,
            )}
            <PrintTable
              head={['Sr', 'Product', 'Qty', 'Price', 'Total']}
              rows={b.items.map((i) => [
                i.sr,
                <span key="p" className="block text-left">
                  {i.product}
                  {i.bundle ? <span className="text-muted-foreground"> ({i.bundle})</span> : null}
                </span>,
                formatQuantity(i.qty),
                formatMoney(i.unitPrice),
                formatMoney(i.lineTotal),
              ])}
              foot={['', 'Total', formatQuantity(b.sale.totalQty), '', formatMoney(b.sale.subtotal)]}
            />
            <dl className="ml-auto w-72 space-y-1">
              {summary.map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="font-semibold">{label}:</dt>
                  <dd className="tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            {b.sale.note ? <p className="border-t pt-3">Note: {b.sale.note}</p> : null}
          </div>
        );
      }}
    </PrintPage>
  );
}
