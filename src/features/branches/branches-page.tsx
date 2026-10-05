import type { ColumnDef } from '@tanstack/react-table';
import { Building2, Eye, Pencil, Plus, Power, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useListState } from '@/hooks/use-list-state';
import { toastError } from '@/lib/api/errors';
import { formatDate } from '@/lib/format';
import { useBranches, useSetBranchStatus, type Branch } from './api';
import { BranchAdminDialog } from './branch-admin-dialog';
import { BranchFormSheet } from './branch-form-sheet';

export function BranchesPage() {
  const list = useListState({ defaultSort: 'name' });
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = useBranches(list.query);
  const setStatus = useSetBranchStatus();
  const [editing, setEditing] = useState<Branch | null>(null);
  const [formOpen, setFormOpen] = useState(params.get('new') === '1');
  const [adminFor, setAdminFor] = useState<Branch | null>(null);
  const [toggling, setToggling] = useState<Branch | null>(null);

  function openForm(branch: Branch | null) {
    setEditing(branch);
    setFormOpen(true);
  }

  const columns: ColumnDef<Branch, unknown>[] = [
    {
      id: 'name',
      header: 'Branch',
      accessorKey: 'name',
      meta: { sortKey: 'name', hideable: false },
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft px-1.5 text-xs font-semibold text-primary-soft-foreground">
            {row.original.code}
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium">{row.original.name}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.kind === 'warehouse' ? 'Main warehouse' : 'Branch'}
            </div>
          </div>
        </div>
      ),
    },
    { id: 'code', header: 'Code', accessorKey: 'code', meta: { sortKey: 'code' } },
    { id: 'city', header: 'City', accessorKey: 'city', meta: { sortKey: 'city' } },
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
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'createdAt',
      header: 'Created',
      accessorKey: 'createdAt',
      meta: { sortKey: 'createdAt', exportValue: (r: unknown) => formatDate((r as Branch).createdAt) },
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right', hideable: false },
      cell: ({ row }) => (
        <RowActions
          actions={[
            {
              label: 'View details',
              icon: Eye,
              onSelect: () => navigate(`/admin/branches/${row.original.id}`),
            },
            { label: 'Edit', icon: Pencil, onSelect: () => openForm(row.original) },
            { label: 'Create branch admin', icon: UserPlus, onSelect: () => setAdminFor(row.original) },
            {
              label: row.original.status === 'active' ? 'Deactivate' : 'Activate',
              icon: Power,
              destructive: row.original.status === 'active',
              separatorBefore: true,
              onSelect: () => setToggling(row.original),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Branches"
        description="Create branches, assign their admins and control which branches are active."
        actions={
          <Button onClick={() => openForm(null)}>
            <Plus />
            New branch
          </Button>
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
        searchPlaceholder="Search name, code or city"
        exportFileName="branches"
        onRowClick={(branch) => navigate(`/admin/branches/${branch.id}`)}
        emptyTitle="No branches yet"
        emptyDescription="Create the first branch to get started."
        emptyAction={
          <Button size="sm" onClick={() => openForm(null)}>
            <Building2 />
            Create branch
          </Button>
        }
        toolbar={
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
        }
      />
      <BranchFormSheet
        open={formOpen}
        branch={editing}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open && params.get('new')) setParams({}, { replace: true });
        }}
      />
      <BranchAdminDialog
        branch={adminFor}
        open={adminFor !== null}
        onOpenChange={(o) => !o && setAdminFor(null)}
      />
      <ConfirmDialog
        open={toggling !== null}
        onOpenChange={(o) => !o && setToggling(null)}
        title={
          toggling?.status === 'active' ? `Deactivate ${toggling?.name}?` : `Activate ${toggling?.name}?`
        }
        description={
          toggling?.status === 'active'
            ? 'Staff of this branch will not be able to sign in until it is activated again. No data is deleted.'
            : 'Staff of this branch will be able to sign in again.'
        }
        confirmLabel={toggling?.status === 'active' ? 'Deactivate' : 'Activate'}
        destructive={toggling?.status === 'active'}
        onConfirm={() =>
          toggling
            ? setStatus
                .mutateAsync({ id: toggling.id, active: toggling.status !== 'active' })
                .then(() => toast.success('Branch status updated'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
