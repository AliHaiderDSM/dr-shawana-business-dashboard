import { AlertTriangle } from 'lucide-react';
import { ErrorState } from '@/components/shared/error-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatMoney, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useGetProfitLossProductSalesQuery, type ProductSaleRow } from '@redux/features/reports';

const signed = (value: string | null) => {
  if (value === null) return '—';
  const n = Number(value);
  return n < 0 ? `− ${formatMoney(String(-n))}` : formatMoney(value);
};

function Figure({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          'font-semibold tabular-nums',
          tone === 'good' && 'text-success',
          tone === 'bad' && 'text-destructive',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function SaleRow({ row, showBranch }: { row: ProductSaleRow; showBranch: boolean }) {
  const isReturn = row.kind === 'return';
  return (
    <tr className={cn('align-top', isReturn && 'bg-destructive-soft/40')}>
      <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.date, 'dd MMM yyyy')}</td>
      <td className="px-3 py-2">
        <div className="font-mono text-xs font-medium">{row.reference}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {isReturn ? (
            <>
              <StatusBadge tone="danger">Return</StatusBadge>
              <span className="text-xs text-muted-foreground">of {row.invoiceNo}</span>
            </>
          ) : (
            <StatusBadge tone={row.saleType === 'online' ? 'info' : 'neutral'}>
              {row.saleType === 'online' ? 'Online' : 'Office'}
            </StatusBadge>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <div>{row.patient ?? '—'}</div>
        {showBranch ? <div className="text-xs text-muted-foreground">{row.branch.name}</div> : null}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{formatQuantity(row.qty)}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {row.unitPrice ? formatMoney(row.unitPrice) : '—'}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {row.discount && Number(row.discount) ? (
          <span className="text-destructive">− {formatMoney(row.discount)}</span>
        ) : (
          '—'
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        <div className="font-medium">{signed(row.revenue)}</div>
        {row.notReceived && Number(row.notReceived) ? (
          <div className="text-xs text-warning">{formatMoney(row.notReceived)} not received</div>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {signed(row.cost)}
        {row.costEstimated ? (
          <span className="ml-1 text-warning" title="Cost estimated from the last known cost">
            ⚠
          </span>
        ) : null}
      </td>
      <td
        className={cn(
          'px-3 py-2 text-right font-semibold tabular-nums',
          Number(row.profit) < 0 && 'text-destructive',
        )}
      >
        {signed(row.profit)}
      </td>
    </tr>
  );
}

export function ProductSalesSheet({
  product,
  year,
  month,
  branchId,
  scope,
  onClose,
}: {
  product: string | null;
  year: number;
  month: number | null;
  branchId: string | null;
  scope: string;
  onClose: () => void;
}) {
  const query = useGetProfitLossProductSalesQuery(
    { year, month, branchId, product: product ?? '' },
    { skip: !product },
  );
  const data = query.data;
  const showBranch = branchId === null;

  return (
    <Sheet open={Boolean(product)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-4xl">
        <SheetHeader>
          <SheetTitle>{product}</SheetTitle>
          <SheetDescription>
            {scope} · every invoice of this product. Revenue is the money received for it after discount;
            returns take their refund off.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          {query.isFetching && !data ? (
            <Skeleton className="h-72 w-full" />
          ) : query.error || !data ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                <Figure label="Sold" value={formatQuantity(data.summary.qty)} />
                <Figure label="At list price" value={formatMoney(data.summary.gross)} />
                <Figure
                  label="Discount"
                  value={Number(data.summary.discount) ? `− ${formatMoney(data.summary.discount)}` : '—'}
                  tone={Number(data.summary.discount) ? 'bad' : undefined}
                />
                <Figure label="Revenue" value={signed(data.summary.revenue)} />
                <Figure label="Cost" value={signed(data.summary.cost)} />
                <Figure
                  label="Profit"
                  value={signed(data.summary.profit)}
                  tone={Number(data.summary.profit) < 0 ? 'bad' : 'good'}
                />
              </div>

              {showBranch && data.branches.length > 1 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Branch</th>
                        <th className="px-3 py-2 text-right font-medium">Sold</th>
                        <th className="px-3 py-2 text-right font-medium">Revenue</th>
                        <th className="px-3 py-2 text-right font-medium">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.branches.map((b) => (
                        <tr key={b.code}>
                          <td className="px-3 py-2">
                            <span className="font-medium">{b.name}</span>{' '}
                            <span className="text-xs text-muted-foreground">{b.code}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatQuantity(b.qty)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{signed(b.revenue)}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">
                            {signed(b.profit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {data.rows.length === 0 ? (
                <p className="rounded-lg border px-3 py-6 text-center text-sm text-muted-foreground">
                  This product was not sold in this period.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Date</th>
                        <th className="px-3 py-2 text-left font-medium">Invoice</th>
                        <th className="px-3 py-2 text-left font-medium">
                          Patient{showBranch ? ' · branch' : ''}
                        </th>
                        <th className="px-3 py-2 text-right font-medium">Qty</th>
                        <th className="px-3 py-2 text-right font-medium">Price / unit</th>
                        <th className="px-3 py-2 text-right font-medium">Discount</th>
                        <th className="px-3 py-2 text-right font-medium">Revenue</th>
                        <th className="px-3 py-2 text-right font-medium">Cost</th>
                        <th className="px-3 py-2 text-right font-medium">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.rows.map((row) => (
                        <SaleRow key={`${row.kind}-${row.id}`} row={row} showBranch={showBranch} />
                      ))}
                    </tbody>
                    <tfoot className="border-t bg-muted/40 font-semibold">
                      <tr>
                        <td className="px-3 py-2" colSpan={3}>
                          {data.summary.sales} sale{data.summary.sales === 1 ? '' : 's'}
                          {data.summary.returns
                            ? ` · ${data.summary.returns} return${data.summary.returns === 1 ? '' : 's'}`
                            : ''}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatQuantity(data.summary.qty)}
                        </td>
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(data.summary.discount) ? `− ${formatMoney(data.summary.discount)}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{signed(data.summary.revenue)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{signed(data.summary.cost)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{signed(data.summary.profit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {data.rows.some((r) => r.costEstimated) ? (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />⚠ marks a sale whose
                  batch had no cost; the last known cost of the product is used.
                </p>
              ) : null}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
