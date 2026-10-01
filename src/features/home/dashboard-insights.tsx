import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowUpRight, PackageCheck, Truck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useStockBalances } from '@/features/inventory/api';
import { api, unwrap } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import { formatCount, formatMoney, formatQuantity } from '@/lib/format';
import type { DashboardData } from './api';

function Card({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-xl border bg-card shadow-xs">
      <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </header>
      <div className="flex-1 p-5">{children}</div>
    </section>
  );
}

export function TopProducts({ data }: { data: DashboardData }) {
  const totals = (data.charts.productSales ?? [])
    .map((p) => ({ name: p.product, qty: p.qty.reduce((sum, q) => sum + Number(q), 0) }))
    .filter((p) => p.qty > 0)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 6);
  const max = totals[0]?.qty ?? 0;
  return (
    <Card title="Top products" description={`Units sold in ${data.charts.year}`}>
      {totals.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No products sold yet.</p>
      ) : (
        <ol className="space-y-3">
          {totals.map((p, index) => (
            <li key={p.name} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">
                  <span className="mr-2 text-muted-foreground tabular-nums">{index + 1}.</span>
                  {p.name}
                </span>
                <span className="font-medium tabular-nums">{formatQuantity(p.qty)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-chart-1"
                  style={{ width: `${max ? (p.qty / max) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function StockAlerts({ data }: { data: DashboardData }) {
  const low = useStockBalances({ lowStockOnly: 'true', pageSize: 6 });
  const rows = low.data?.data ?? [];
  return (
    <Card
      title="Low stock"
      description={`${formatCount(data.stock?.lowStockCount ?? 0)} products at or below their alert level`}
      action={
        <Button asChild variant="ghost" size="sm">
          <Link to="/stock?lowStockOnly=true">
            View all
            <ArrowUpRight />
          </Link>
        </Button>
      }
    >
      {low.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : rows.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <PackageCheck className="size-4 text-success" />
          Everything is above its alert level.
        </p>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.productId} className="flex items-center gap-3 py-2 text-sm">
              <AlertTriangle className="size-4 shrink-0 text-warning" />
              <Link to={`/stock/${row.productId}`} className="min-w-0 flex-1 truncate hover:underline">
                {row.name}
              </Link>
              <span className="font-medium tabular-nums">
                {formatQuantity(row.quantity)} {row.unit}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                / {formatQuantity(row.lowStockThreshold)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function PendingDeliveries({ count }: { count: number }) {
  return (
    <Card title="Pending deliveries" description="Online sales not yet delivered">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-info-soft text-info-soft-foreground">
            <Truck className="size-5" />
          </span>
          <span className="text-3xl font-semibold tabular-nums">{formatCount(count)}</span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/sales?saleType=online&deliveryStatus=pending">
            Open
            <ArrowUpRight />
          </Link>
        </Button>
      </div>
    </Card>
  );
}

export function BranchComparison({
  rows,
  label,
}: {
  rows: NonNullable<DashboardData['byBranch']>;
  label: string;
}) {
  const { setBranchId } = useAuth();
  const total = (r: (typeof rows)[number]) => Number(r.salesMonth) + Number(r.appointmentsMonth);
  const sorted = [...rows].sort((a, b) => total(b) - total(a));
  return (
    <section className="rounded-xl border bg-card shadow-xs xl:col-span-3">
      <header className="border-b px-5 py-4">
        <h2 className="text-sm font-semibold">Branch comparison</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}. Open a branch to work inside it.</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
              <th className="px-5 py-2 text-left font-medium">Branch</th>
              <th className="px-5 py-2 text-right font-medium">Sales</th>
              <th className="px-5 py-2 text-right font-medium">Appointments</th>
              <th className="px-5 py-2 text-right font-medium">Total</th>
              <th className="px-5 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, index) => (
              <tr key={row.branch} className="border-b last:border-b-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={index === 0 && total(row) > 0 ? 'success' : 'neutral'} dot={false}>
                      {row.branch}
                    </StatusBadge>
                    <span className="font-medium">{row.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-right tabular-nums">{formatMoney(row.salesMonth)}</td>
                <td className="px-5 py-3 text-right tabular-nums">{formatMoney(row.appointmentsMonth)}</td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatMoney(total(row))}</td>
                <td className="px-5 py-3 text-right">
                  <BranchLink code={row.branch} onOpen={setBranchId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BranchLink({ code, onOpen }: { code: string; onOpen: (id: string) => void }) {
  const { branches } = useBranchCodes();
  const id = branches.get(code);
  if (!id) return null;
  return (
    <Button variant="ghost" size="sm" onClick={() => onOpen(id)}>
      Open
      <ArrowUpRight />
    </Button>
  );
}

function useBranchCodes() {
  const query = useQuery({
    queryKey: ['branches', 'options'],
    queryFn: () => unwrap(api.GET('/admin/branches/options')).then((r) => r.data),
    staleTime: 5 * 60_000,
  });
  return { branches: new Map((query.data ?? []).map((b) => [b.code, b.id])) };
}
