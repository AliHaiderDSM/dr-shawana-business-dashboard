import { useQuery } from '@tanstack/react-query';
import { Building2, KeyRound, Loader2 } from 'lucide-react';
import { Suspense, useState, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { PageSkeleton } from '@/components/shared/skeletons';
import { ForbiddenState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { api, unwrap } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/utils';
import { BrandMark, Sidebar, SidebarNav } from './sidebar';
import { Topbar } from './topbar';

const COLLAPSE_KEY = 'dsm.sidebar.collapsed';

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <BrandMark />
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'anonymous') {
    const redirect =
      location.pathname === '/' ? '' : `?redirect=${encodeURIComponent(location.pathname + location.search)}`;
    return <Navigate to={`/login${redirect}`} replace />;
  }
  return children;
}

export function RequirePermission({ anyOf, children }: { anyOf: string[]; children: ReactNode }) {
  const { canAny } = useAuth();
  return canAny(anyOf) ? children : <ForbiddenState className="min-h-[60vh]" />;
}

export function RequireBranch({ children }: { children: ReactNode }) {
  const { isSuperAdmin, activeBranchId, setBranchId } = useAuth();
  const branches = useQuery({
    queryKey: ['branches', 'options'],
    queryFn: () => unwrap(api.GET('/admin/branches/options')).then((r) => r.data),
    enabled: isSuperAdmin && !activeBranchId,
  });
  if (!isSuperAdmin || activeBranchId) return children;
  return (
    <div className="mx-auto max-w-2xl py-10">
      <EmptyState
        icon={Building2}
        title="Choose a branch to continue"
        description="This screen works on one branch at a time. Pick a branch here or from the switcher at the top."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {(branches.data ?? []).map((branch) => (
          <button
            key={branch.id}
            type="button"
            onClick={() => setBranchId(branch.id)}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:border-border-strong hover:bg-accent"
          >
            <div className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft px-1.5 text-xs font-semibold text-primary-soft-foreground">
              {branch.code}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{branch.name}</div>
              <div className="text-xs text-muted-foreground">Open in this branch</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PasswordNotice() {
  const { me } = useAuth();
  const location = useLocation();
  if (!me?.profile.mustChangePassword || location.pathname === '/profile') return null;
  return (
    <div className="border-b bg-warning-soft px-4 py-2.5 text-sm text-warning-soft-foreground sm:px-6">
      <div className="mx-auto flex max-w-content items-center gap-3">
        <KeyRound className="size-4 shrink-0" />
        <span className="flex-1">You are using a temporary password. Please set your own password.</span>
        <Button asChild size="sm" variant="outline" className="h-7 bg-card">
          <Link to="/profile?tab=password">Change password</Link>
        </Button>
      </div>
    </div>
  );
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  function toggle() {
    setCollapsed((value) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, value ? '0' : '1');
      } catch {
        return !value;
      }
      return !value;
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-sidebar bg-sidebar p-0">
          <SheetHeader className="h-topbar justify-center border-b px-4">
            <SheetTitle asChild>
              <div>
                <BrandMark />
              </div>
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-var(--topbar-height))]">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </ScrollArea>
        </SheetContent>
      </Sheet>
      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-200 ease-standard',
          collapsed ? 'lg:pl-sidebar-collapsed' : 'lg:pl-sidebar',
        )}
      >
        <Topbar onOpenMenu={() => setMobileOpen(true)} />
        <PasswordNotice />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-content">
            <ErrorBoundary key={location.pathname}>
              <Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
