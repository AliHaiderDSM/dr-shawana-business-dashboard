import type { ColumnDef } from '@tanstack/react-table';
import { KeyRound, Loader2, Pencil, Plus, Power, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CredentialsDialog } from '@/components/shared/credentials-dialog';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { generatePassword, SecretReveal } from '@/components/shared/secret-reveal';
import { StatusBadge } from '@/components/shared/status-badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useListState } from '@/hooks/use-list-state';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatRelative, initials } from '@/lib/format';
import {
  BRANCH_ROLES,
  ROLE_LABELS,
  useRemoveStaff,
  useResetPassword,
  useStaffList,
  useStaffStatus,
  type Staff,
} from './api';
import { StaffFormSheet } from './staff-form-sheet';

interface Credentials {
  staff: Staff;
  password: string;
  reason: 'created' | 'reset';
}

function ResetPasswordDialog({
  staff,
  onClose,
  onDone,
}: {
  staff: Staff | null;
  onClose: () => void;
  onDone: (c: Credentials) => void;
}) {
  const reset = useResetPassword();
  const [password, setPassword] = useState(generatePassword);
  if (!staff) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && !reset.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a temporary password for {staff.firstName} {staff.lastName}. Their current password stops
            working.
          </DialogDescription>
        </DialogHeader>
        <SecretReveal value={password} onRegenerate={() => setPassword(generatePassword())} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={reset.isPending}>
            Cancel
          </Button>
          <Button
            disabled={reset.isPending}
            onClick={() =>
              reset.mutate(
                { id: staff.id, password },
                {
                  onSuccess: () => onDone({ staff, password, reason: 'reset' }),
                  onError: (error) => toastError(error),
                },
              )
            }
          >
            {reset.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
            Reset password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StaffPage() {
  const { me, can } = useAuth();
  const list = useListState({ defaultSort: 'firstName' });
  const query = useStaffList(list.query);
  const setStatus = useStaffStatus();
  const remove = useRemoveStaff();
  const [editing, setEditing] = useState<Staff | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [resetting, setResetting] = useState<Staff | null>(null);
  const [toggling, setToggling] = useState<Staff | null>(null);
  const [removing, setRemoving] = useState<Staff | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const canCreate = can('staff.create');
  const canUpdate = can('staff.update');
  const canDelete = can('staff.delete');
  const manageable = (s: Staff) =>
    s.id !== me?.profile.id && (me?.role === 'super_admin' || s.role !== 'branch_admin');

  const columns: ColumnDef<Staff, unknown>[] = [
    {
      id: 'name',
      header: 'Employee',
      accessorFn: (s) => `${s.firstName} ${s.lastName}`,
      meta: { sortKey: 'firstName', hideable: false },
      cell: ({ row }) => {
        const name = `${row.original.firstName} ${row.original.lastName}`;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary-soft text-xs font-medium text-primary-soft-foreground">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate font-medium">{name}</div>
              <div className="truncate text-xs text-muted-foreground">{row.original.email}</div>
            </div>
          </div>
        );
      },
    },
    { id: 'username', header: 'Username', accessorKey: 'username', meta: { sortKey: 'username' } },
    {
      id: 'role',
      header: 'Role',
      accessorFn: (s) => ROLE_LABELS[s.role],
      meta: { sortKey: 'role' },
      cell: ({ row }) => <span className="text-sm">{ROLE_LABELS[row.original.role]}</span>,
    },
    {
      id: 'phone',
      header: 'Phone',
      accessorKey: 'phone',
      cell: ({ getValue }) => (getValue() as string) || '—',
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={row.original.status} />
          {row.original.mustChangePassword ? (
            <StatusBadge tone="warning" dot={false}>
              Temp password
            </StatusBadge>
          ) : null}
        </div>
      ),
    },
    {
      id: 'lastLoginAt',
      header: 'Last sign-in',
      accessorKey: 'lastLoginAt',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.lastLoginAt ? formatRelative(row.original.lastLoginAt) : 'Never'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right', hideable: false },
      cell: ({ row }) =>
        manageable(row.original) ? (
          <RowActions
            actions={[
              {
                label: 'Edit',
                icon: Pencil,
                hidden: !canUpdate,
                onSelect: () => {
                  setEditing(row.original);
                  setFormKey((k) => k + 1);
                  setFormOpen(true);
                },
              },
              {
                label: 'Reset password',
                icon: KeyRound,
                hidden: !canUpdate,
                onSelect: () => setResetting(row.original),
              },
              {
                label: row.original.status === 'active' ? 'Deactivate' : 'Activate',
                icon: Power,
                hidden: !canUpdate,
                separatorBefore: true,
                onSelect: () => setToggling(row.original),
              },
              {
                label: 'Remove',
                icon: Trash2,
                destructive: true,
                hidden: !canDelete,
                onSelect: () => setRemoving(row.original),
              },
            ]}
          />
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Employees"
        description="Staff accounts of this branch. Each role sees only its own screens."
        actions={
          canCreate ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormKey((k) => k + 1);
                setFormOpen(true);
              }}
            >
              <Plus />
              New employee
            </Button>
          ) : null
        }
      />
      <DataTable
        columns={columns}
        data={query.data?.data}
        meta={query.data?.meta}
        list={list}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        searchPlaceholder="Search name, username or email"
        exportFileName="employees"
        emptyTitle="No employees yet"
        emptyDescription="Add the people who work in this branch."
        emptyAction={
          canCreate ? (
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <UserPlus />
              Add employee
            </Button>
          ) : null
        }
        toolbar={
          <>
            <Select
              value={list.filters.role ?? 'all'}
              onValueChange={(v) => list.setFilter('role', v === 'all' ? undefined : v)}
            >
              <SelectTrigger size="sm" className="h-9 w-40" aria-label="Role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {BRANCH_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={list.filters.status ?? 'all'}
              onValueChange={(v) => list.setFilter('status', v === 'all' ? undefined : v)}
            >
              <SelectTrigger size="sm" className="h-9 w-36" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />
      <StaffFormSheet
        key={formKey}
        open={formOpen}
        onOpenChange={setFormOpen}
        staff={editing}
        onCreated={(staff, password) => setCredentials({ staff, password, reason: 'created' })}
      />
      <ResetPasswordDialog
        key={resetting?.id}
        staff={resetting}
        onClose={() => setResetting(null)}
        onDone={(c) => {
          setResetting(null);
          setCredentials(c);
        }}
      />
      <CredentialsDialog
        value={
          credentials
            ? {
                title: credentials.reason === 'created' ? 'Employee created' : 'Password reset',
                name: `${credentials.staff.firstName} ${credentials.staff.lastName}`,
                username: credentials.staff.username,
                password: credentials.password,
              }
            : null
        }
        onClose={() => setCredentials(null)}
      />
      <ConfirmDialog
        open={toggling !== null}
        onOpenChange={(o) => !o && setToggling(null)}
        title={toggling?.status === 'active' ? 'Deactivate this employee?' : 'Activate this employee?'}
        description={
          toggling?.status === 'active'
            ? 'They will be signed out and cannot sign in until activated again.'
            : 'They will be able to sign in again.'
        }
        confirmLabel={toggling?.status === 'active' ? 'Deactivate' : 'Activate'}
        destructive={toggling?.status === 'active'}
        onConfirm={() =>
          toggling
            ? setStatus
                .mutateAsync({ id: toggling.id, active: toggling.status !== 'active' })
                .then(() => toast.success('Employee status updated'))
                .catch(toastError)
            : undefined
        }
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this employee?"
        description="Their sign-in is blocked and they disappear from lists. Records they created stay intact."
        confirmLabel="Remove"
        destructive
        onConfirm={() =>
          removing
            ? remove
                .mutateAsync(removing.id)
                .then(() => toast.success('Employee removed'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
