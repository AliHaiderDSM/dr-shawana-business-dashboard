import { useBranchOptions } from '@redux/features/branches';
import { useAuth } from './auth-context';

export { useBranchOptions };

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
  const { isSuperAdmin, me } = useAuth();
  const inWarehouse = useInWarehouse();
  return inWarehouse && (isSuperAdmin || me?.role === 'lab_officer' || me?.role === 'warehouse_keeper');
}
