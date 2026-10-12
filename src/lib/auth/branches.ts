import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import { useAuth } from './auth-context';

export function useBranchOptions(enabled = true) {
  return useQuery({
    queryKey: ['branches', 'options'],
    queryFn: () => unwrap(api.GET('/admin/branches/options')).then((r) => r.data),
    enabled,
  });
}

export function useCurrentBranch() {
  const { branchId, isSuperAdmin } = useAuth();
  const branches = useBranchOptions(isSuperAdmin);
  return branches.data?.find((b) => b.id === branchId) ?? null;
}

export function useBranchKind() {
  const { me, isSuperAdmin } = useAuth();
  const current = useCurrentBranch();
  return isSuperAdmin ? (current?.kind ?? null) : (me?.branch?.kind ?? null);
}

export function useInWarehouse() {
  return useBranchKind() === 'warehouse';
}

export function useInDispatch() {
  return useBranchKind() === 'dispatch';
}

export function useHasDispatch() {
  const { me } = useAuth();
  return Boolean(me?.dispatchDepartmentId);
}

export function useCanReceiveStock() {
  const { isSuperAdmin } = useAuth();
  const inWarehouse = useInWarehouse();
  return isSuperAdmin && inWarehouse;
}
