import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, AUTH_EXPIRED_EVENT, unwrap } from '@/lib/api/client';
import type { Me } from '@/lib/api/types';
import { ALL_BRANCHES, branchStore, lastUserStore, sessionStore } from './session';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  me: Me | null;
  isSuperAdmin: boolean;
  branchId: string;
  activeBranchId: string | null;
  setBranchId: (branchId: string) => void;
  can: (permission: string) => boolean;
  canAny: (permissions: string[]) => boolean;
  login: (identifier: string, password: string) => Promise<Me>;
  logout: () => void;
  refreshMe: () => Promise<unknown>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const ME_QUERY_KEY = ['auth', 'me'] as const;

const SUPER_ADMIN_MANAGES = new Set([
  'branches',
  'company',
  'staff',
  'doctors',
  'reports',
  'dashboard',
  'salePayments',
  'accounts',
]);
const SUPER_ADMIN_STOCK_MODULES = new Set([
  'stock',
  'inventoryReport',
  'products',
  'categories',
  'bundles',
  'suppliers',
  'materials',
  'materialCategories',
  'recipes',
  'labTransfers',
  'production',
  'finishedGoods',
  'materialReport',
]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [hasSession, setHasSession] = useState(() => sessionStore.get() !== null);
  const [branchId, setBranchState] = useState(() => branchStore.get());

  const meQuery = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => unwrap(api.GET('/auth/me')).then((r) => r.data),
    enabled: hasSession,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const me = hasSession ? (meQuery.data ?? null) : null;
  if (me) lastUserStore.set(me.profile.id);
  const isSuperAdmin = me?.role === 'super_admin';
  branchStore.setSuperAdmin(isSuperAdmin);
  const branchOptions = useQuery({
    queryKey: ['branches', 'options'],
    queryFn: () => unwrap(api.GET('/admin/branches/options')).then((r) => r.data),
    enabled: isSuperAdmin,
    staleTime: 5 * 60_000,
  });
  const superAdminStock = (branchOptions.data ?? []).find((b) => b.kind === 'warehouse')?.id ?? null;
  branchStore.setWarehouse(superAdminStock);

  const logout = useCallback(() => {
    sessionStore.clear();
    setHasSession(false);
    setBranchState(ALL_BRANCHES);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, logout);
  }, [logout]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const { data } = await unwrap(api.POST('/auth/login', { body: { identifier, password } }));
      sessionStore.set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
      });
      queryClient.setQueryData(ME_QUERY_KEY, data.me);
      setHasSession(true);
      return data.me;
    },
    [queryClient],
  );

  const setBranchId = useCallback(
    (next: string) => {
      branchStore.set(next);
      setBranchState(next);
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== ME_QUERY_KEY[0] });
    },
    [queryClient],
  );

  const knownBranch = (branchOptions.data ?? []).some((b) => b.id === branchId);
  const effectiveBranchId = isSuperAdmin && superAdminStock && !knownBranch ? superAdminStock : branchId;

  useEffect(() => {
    if (effectiveBranchId !== branchId) branchStore.set(effectiveBranchId);
  }, [effectiveBranchId, branchId]);

  const value = useMemo<AuthContextValue>(() => {
    const permissions = new Set(me?.permissions ?? []);
    const selectedKind = (branchOptions.data ?? []).find((b) => b.id === effectiveBranchId)?.kind;
    const can = (permission: string) => {
      if (!permissions.has(permission)) return false;
      if (!isSuperAdmin) return true;
      const [module = '', action] = permission.split('.');
      if (action === 'view' || SUPER_ADMIN_MANAGES.has(module)) return true;
      return selectedKind === 'warehouse' && SUPER_ADMIN_STOCK_MODULES.has(module);
    };
    const status: AuthStatus =
      !hasSession || meQuery.isError ? 'anonymous' : me ? 'authenticated' : 'loading';
    const activeBranchId = isSuperAdmin
      ? effectiveBranchId === ALL_BRANCHES
        ? null
        : effectiveBranchId
      : (me?.branch?.id ?? null);
    return {
      status,
      me,
      isSuperAdmin,
      branchId: effectiveBranchId,
      activeBranchId,
      setBranchId,
      can,
      canAny: (list) => list.some(can),
      login,
      logout,
      refreshMe: () => meQuery.refetch(),
    };
  }, [
    me,
    hasSession,
    isSuperAdmin,
    effectiveBranchId,
    setBranchId,
    login,
    logout,
    meQuery,
    branchOptions.data,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
