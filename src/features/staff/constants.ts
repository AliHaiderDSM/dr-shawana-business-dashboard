import type { BranchRole } from '@redux/features/staff/types';
import type { Role } from '@/lib/api/types';

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
  return base.filter(
    (r) => r !== 'store_keeper' && r !== 'dispatcher' && r !== 'warehouse_keeper' && r !== 'lab_officer',
  );
}
