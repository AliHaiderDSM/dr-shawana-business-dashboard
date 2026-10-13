import { ExpiryAlertsPanel } from '@/features/inventory/expiry-alerts';
import { PendingDiscountsBanner } from '@/features/sales/discount-requests-page';
import { PendingStockRequestsBanner } from '@/features/inventory/stock-requests-page';
import { PendingWriteOffsBanner } from '@/features/inventory/write-offs-page';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Building2, MapPin, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api, unwrap } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import { formatMoney, titleCase } from '@/lib/format';
import { useHasDispatch, useInDispatch, useInWarehouse } from '@/lib/auth/branches';
import { visibleMenu } from '@/lib/permissions/menu';
import { useDashboard } from './api';
import { DashboardOverview } from './dashboard-overview';
import { DispatchOverview, KeeperOverview } from './dispatch-overview';

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

function BranchFigure({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="rounded-lg border px-3 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">
        {value === undefined ? '—' : formatMoney(value)}
      </div>
    </div>
  );
}

function SuperAdminHome() {
  const { setBranchId } = useAuth();
  const dashboard = useDashboard(new Date().getFullYear());
  const figures = new Map((dashboard.data?.byBranch ?? []).map((row) => [row.branch, row]));
  const branches = useQuery({
    queryKey: ['branches', 'list', 'home'],
    queryFn: () => unwrap(api.GET('/admin/branches', { params: { query: { pageSize: 100, sort: 'name' } } })),
  });

  return (
    <>
      <PageHeader
        title={greeting()}
        description="Every branch at a glance. Pick a branch at the top to look inside it."
        actions={
          <Button asChild>
            <Link to="/admin/branches?new=1">
              <Plus />
              New branch
            </Link>
          </Button>
        }
      />
      <PendingDiscountsBanner className="mb-4" />
      <PendingStockRequestsBanner className="mb-4" />
      <PendingWriteOffsBanner className="mb-4" />
      <ExpiryAlertsPanel className="mb-6" />
      <DashboardOverview />
 
    </>
  );
}

function BranchHome() {
  const { me, can, isSuperAdmin } = useAuth();
  const inWarehouse = useInWarehouse();
  const inDispatch = useInDispatch();
  const hasDispatch = useHasDispatch();
  const dispatchView = inDispatch || me?.role === 'dispatcher';
  const links = visibleMenu(can, isSuperAdmin, me?.role, inWarehouse, { inDispatch, hasDispatch })
    .flatMap((g) => g.items)
    .filter((i) => i.path !== '/');

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${me?.profile.firstName ?? ''}`}
        description={`${titleCase(me?.role ?? '')}${me?.branch ? ` · ${me.branch.name}` : ''}`}
      />
      <ExpiryAlertsPanel className="mb-6" />
      {me?.role === 'warehouse_keeper' || me?.role === 'lab_officer' ? (
        <KeeperOverview />
      ) : dispatchView ? (
        <DispatchOverview />
      ) : (
        <DashboardOverview />
      )}
      <div className="mt-8 rounded-xl border bg-card shadow-xs">
        <div className="border-b px-5 py-4">
          <h2 className="text-sm font-semibold">Quick access</h2>
          <p className="text-sm text-muted-foreground">The screens available to your role.</p>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {links.map((item) => (
            <Link
              key={item.key}
              to={item.path}
              className="group flex items-center gap-3 bg-card px-5 py-4 transition-colors hover:bg-accent"
            >
              <div className="flex size-9 items-center justify-center rounded-lg border bg-background text-muted-foreground group-hover:text-foreground">
                <item.icon className="size-4" />
              </div>
              <span className="text-sm font-medium">{item.label}</span>
              <ArrowUpRight className="ml-auto size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
          {Array.from({ length: (3 - (links.length % 3)) % 3 }, (_, i) => (
            <div key={i} aria-hidden className="hidden bg-card lg:block" />
          ))}
        </div>
      </div>
    </>
  );
}

export function HomePage() {
  const { isSuperAdmin, activeBranchId } = useAuth();
  const inWarehouse = useInWarehouse();
  return isSuperAdmin && (!activeBranchId || inWarehouse) ? <SuperAdminHome /> : <BranchHome />;
}
