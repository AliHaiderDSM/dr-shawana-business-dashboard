import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Outlet, type RouteObject } from 'react-router';
import {
  AppShell,
  FullPageLoader,
  RequireAuth,
  RequireBranch,
  RequirePermission,
} from '@/components/layout/app-shell';
import { LoginPage } from '@/features/auth/login-page';
import { HomePage } from '@/features/home/home-page';
import { ComingSoonPage, NotFoundPage } from '@/features/system/system-pages';
import { MENU } from '@/lib/permissions/menu';
import { printRoutes, screenRoutes, type ScreenRoute } from './screens';

function guard(element: ReactNode, anyOf: string[], scope: ScreenRoute['scope']) {
  const inner = scope === 'branch' ? <RequireBranch>{element}</RequireBranch> : element;
  return <RequirePermission anyOf={anyOf}>{inner}</RequirePermission>;
}

const PublicHistoryPage = lazy(() =>
  import('@/features/public/public-history-page').then((m) => ({ default: m.PublicHistoryPage })),
);

const toRoute = (route: ScreenRoute): RouteObject => ({
  path: route.path,
  element: guard(route.element, route.anyOf, route.scope),
});

const pendingRoutes: RouteObject[] = MENU.flatMap((group) => group.items)
  .filter((item) => item.phase)
  .map((item) => ({
    path: item.path.slice(1),
    element: guard(<ComingSoonPage item={item} />, item.anyOf, 'any'),
  }));

const childRoutes: RouteObject[] = [
  { index: true, element: <HomePage /> },
  ...screenRoutes.map(toRoute),
  ...pendingRoutes,
  { path: '*', element: <NotFoundPage /> },
];

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/p/:token',
    element: (
      <Suspense fallback={<FullPageLoader />}>
        <PublicHistoryPage />
      </Suspense>
    ),
  },
  {
    path: '/print',
    element: (
      <RequireAuth>
        <Suspense fallback={<FullPageLoader />}>
          <Outlet />
        </Suspense>
      </RequireAuth>
    ),
    children: printRoutes.map(toRoute),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: childRoutes,
  },
]);
