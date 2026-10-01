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
];

export function creatableRoles(actor: Role): BranchRole[] {
  if (actor === 'super_admin') return BRANCH_ROLES;
  if (actor === 'branch_admin') return BRANCH_ROLES.filter((r) => r !== 'branch_admin');
  return [];
}

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
  return useStaffMutation(({ id, body }: { id?: string; body: StaffInput | StaffUpdate }) =>
    id
      ? unwrap(api.PATCH('/branch/staff/{id}', { params: { path: { id } }, body: body as StaffUpdate }))
      : unwrap(api.POST('/branch/staff', { body: body as StaffInput })),
  );
}

export function useStaffStatus() {
  return useStaffMutation(({ id, active }: { id: string; active: boolean }) =>
    active
      ? unwrap(api.POST('/branch/staff/{id}/activate', { params: { path: { id } } }))
      : unwrap(api.POST('/branch/staff/{id}/deactivate', { params: { path: { id } } })),
  );
}

export function useResetPassword() {
  return useStaffMutation(({ id, password }: { id: string; password: string }) =>
    unwrap(api.POST('/branch/staff/{id}/reset-password', { params: { path: { id } }, body: { password } })),
  );
}

export function useRemoveStaff() {
  return useStaffMutation((id: string) =>
    unwrap(api.DELETE('/branch/staff/{id}', { params: { path: { id } } })),
  );
}
