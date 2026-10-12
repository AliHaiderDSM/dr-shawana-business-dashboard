import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { Role, Schemas } from '@/lib/api/types';

export type Staff = Schemas['Staff'];
export type StaffInput = Schemas['CreateStaff'];
export type StaffUpdate = Schemas['UpdateStaff'];
export type BranchRole = StaffInput['role'];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  branch_admin: 'Branch Admin',
  accountant: 'Accountant',
  doctor: 'Doctor',
  front_desk: 'Front Desk',
  team_manager: 'Team Manager',
  pharmacy: 'Pharmacy',
  store_keeper: 'Store Keeper',
  delivery_print: 'Delivery Print',
  dispatcher: 'Dispatcher',
  warehouse_keeper: 'Warehouse Keeper',
  lab_officer: 'Lab Officer',
};

export const BRANCH_ROLES: BranchRole[] = [
  'branch_admin',
  'accountant',
  'doctor',
  'front_desk',
  'team_manager',
  'pharmacy',
  'store_keeper',
  'delivery_print',
  'dispatcher',
  'warehouse_keeper',
  'lab_officer',
];

export const DISPATCH_ROLES: BranchRole[] = ['branch_admin', 'store_keeper', 'delivery_print', 'dispatcher'];

export function creatableRoles(actor: Role, branchKind?: string | null): BranchRole[] {
  const base =
    actor === 'super_admin'
      ? BRANCH_ROLES
      : actor === 'branch_admin'
        ? BRANCH_ROLES.filter((r) => r !== 'branch_admin')
        : [];
  if (branchKind === 'warehouse') return base.filter((r) => r === 'warehouse_keeper' || r === 'lab_officer');
  if (branchKind === 'dispatch') return base.filter((r) => DISPATCH_ROLES.includes(r));
  return base.filter((r) => r !== 'store_keeper' && r !== 'warehouse_keeper' && r !== 'lab_officer');
}

const inBranch = (branchId?: string | null) => (branchId ? { query: { branchId } } : {});

export function useStaffList(query: Record<string, unknown>, enabled = true) {
  return useQuery({
    queryKey: ['staff', 'list', query],
    queryFn: () => unwrap(api.GET('/branch/staff', { params: { query: query as never } })),
    placeholderData: (previous) => previous,
    enabled,
  });
}

function useStaffMutation<T>(fn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  });
}

export function useSaveStaff() {
  return useStaffMutation(
    ({ id, body, branchId }: { id?: string; body: StaffInput | StaffUpdate; branchId?: string | null }) =>
      id
        ? unwrap(
            api.PATCH('/branch/staff/{id}', {
              params: { path: { id }, ...inBranch(branchId) },
              body: body as StaffUpdate,
            }),
          )
        : unwrap(api.POST('/branch/staff', { params: inBranch(branchId), body: body as StaffInput })),
  );
}

export function useStaffStatus() {
  return useStaffMutation(
    ({ id, active, branchId }: { id: string; active: boolean; branchId?: string | null }) =>
      active
        ? unwrap(api.POST('/branch/staff/{id}/activate', { params: { path: { id }, ...inBranch(branchId) } }))
        : unwrap(
            api.POST('/branch/staff/{id}/deactivate', { params: { path: { id }, ...inBranch(branchId) } }),
          ),
  );
}

export function useResetPassword() {
  return useStaffMutation(
    ({ id, password, branchId }: { id: string; password: string; branchId?: string | null }) =>
      unwrap(
        api.POST('/branch/staff/{id}/reset-password', {
          params: { path: { id }, ...inBranch(branchId) },
          body: { password },
        }),
      ),
  );
}

export function useRemoveStaff() {
  return useStaffMutation(({ id, branchId }: { id: string; branchId?: string | null }) =>
    unwrap(api.DELETE('/branch/staff/{id}', { params: { path: { id }, ...inBranch(branchId) } })),
  );
}
