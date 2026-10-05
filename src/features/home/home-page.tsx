import { ExpiryAlertsPanel } from '@/features/inventory/expiry-alerts';
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
import { useInWarehouse } from '@/lib/auth/branches';
import { visibleMenu } from '@/lib/permissions/menu';
import { useDashboard } from './api';
import { DashboardOverview } from './dashboard-overview';

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
        description="The whole system at a glance. Open a branch to work inside it."
        actions={
          <Button asChild>
            <Link to="/admin/branches?new=1">
              <Plus />
              New branch
            </Link>
          </Button>
        }
      />
      <ExpiryAlertsPanel className="mb-6" />
      <DashboardOverview />
      <h2 className="mt-8 mb-3 text-sm font-semibold">Branches</h2>
      {branches.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : branches.error ? (
        <ErrorState error={branches.error} onRetry={() => void branches.refetch()} />
      ) : branches.data?.data.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Building2}
            title="No branches yet"
            description="Create your first branch, then add its branch admin."
            action={
              <Button asChild size="sm">
                <Link to="/admin/branches?new=1">Create branch</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {branches.data?.data.map((branch) => (
            <div key={branch.id} className="flex flex-col rounded-xl border bg-card p-5 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft px-2 text-xs font-semibold text-primary-soft-foreground">
                    {branch.code}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{branch.name}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {branch.city}
                      {branch.kind === 'warehouse' ? ' · Super Admin stock' : ''}
                    </div>
                  </div>
                </div>
                <StatusBadge status={branch.status} />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <BranchFigure label="Sales this month" value={figures.get(branch.code)?.salesMonth} />
                <BranchFigure
                  label="Appointment payments"
                  value={figures.get(branch.code)?.appointmentsMonth}
                />
              </div>
              <div className="mt-5 flex items-center gap-2 border-t pt-4">
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/admin/branches/${branch.id}`}>Details</Link>
                </Button>
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setBranchId(branch.id)}>
                  Work in branch
                  <ArrowUpRight />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function BranchHome() {
  const { me, can, isSuperAdmin } = useAuth();
  const inWarehouse = useInWarehouse();
  const links = visibleMenu(can, isSuperAdmin, me?.role, inWarehouse)
    .flatMap((g) => g.items)
    .filter((i) => i.path !== '/');

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${me?.profile.firstName ?? ''}`}
        description={`${titleCase(me?.role ?? '')}${me?.branch ? ` · ${me.branch.name}` : ''}`}
      />
      <ExpiryAlertsPanel className="mb-6" />
      <DashboardOverview />
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
  return isSuperAdmin && !activeBranchId ? <SuperAdminHome /> : <BranchHome />;
}
