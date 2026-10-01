import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, Pencil, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { DetailList, Panel } from '@/components/shared/panel';
import { DetailSkeleton } from '@/components/shared/skeletons';
import { StatusBadge } from '@/components/shared/status-badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { api, unwrap } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import { formatCount, formatDate, initials } from '@/lib/format';
import { useBranch } from './api';
import { BranchAdminDialog } from './branch-admin-dialog';
import { BranchFormSheet } from './branch-form-sheet';

function useBranchStaff(branchId: string) {
  return useQuery({
    queryKey: ['staff', 'branch-summary', branchId],
    queryFn: async () => {
      const [all, admins] = await Promise.all([
        unwrap(api.GET('/branch/staff', { params: { query: { branchId, pageSize: 1 } } })),
        unwrap(
          api.GET('/branch/staff', { params: { query: { branchId, role: 'branch_admin', pageSize: 10 } } }),
        ),
      ]);
      return { total: all.meta.total, admins: admins.data };
    },
  });
}

export function BranchDetailPage() {
  const { id = '' } = useParams();
  const { setBranchId } = useAuth();
  const branch = useBranch(id);
  const staff = useBranchStaff(id);
  const [editOpen, setEditOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  if (branch.isLoading) return <DetailSkeleton />;
  if (branch.error || !branch.data)
    return <ErrorState error={branch.error} onRetry={() => void branch.refetch()} />;
  const b = branch.data;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
        <Link to="/admin/branches">
          <ArrowLeft />
          Branches
        </Link>
      </Button>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {b.name}
            <StatusBadge status={b.status} />
          </span>
        }
        description={`${b.code} · ${b.city}${b.isHeadOffice ? ' · Head office' : ''}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil />
              Edit
            </Button>
            <Button onClick={() => setBranchId(b.id)}>
              Work in this branch
              <ArrowUpRight />
            </Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Branch details" className="lg:col-span-2">
          <DetailList
            items={[
              { label: 'Name', value: b.name },
              { label: 'Code', value: b.code },
              { label: 'City', value: b.city },
              { label: 'Phone', value: b.phone },
              { label: 'Email', value: b.email },
              { label: 'Address', value: b.address },
              { label: 'Created', value: formatDate(b.createdAt) },
              { label: 'Last updated', value: formatDate(b.updatedAt) },
            ]}
          />
        </Panel>
        <div className="space-y-6">
          <Panel title="Team">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-info-soft text-info-soft-foreground">
                <Users className="size-5" />
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums">
                  {staff.isLoading ? '…' : formatCount(staff.data?.total)}
                </div>
                <div className="text-sm text-muted-foreground">staff members</div>
              </div>
            </div>
          </Panel>
          <Panel
            title="Branch admins"
            actions={
              <Button size="sm" variant="outline" onClick={() => setAdminOpen(true)}>
                <UserPlus />
                Add
              </Button>
            }
            bodyClassName="p-0"
          >
            {staff.data?.admins.length ? (
              <ul className="divide-y">
                {staff.data.admins.map((admin) => {
                  const name = `${admin.firstName} ${admin.lastName}`;
                  return (
                    <li key={admin.id} className="flex items-center gap-3 px-5 py-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-primary-soft text-xs text-primary-soft-foreground">
                          {initials(name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{name}</div>
                        <div className="truncate text-xs text-muted-foreground">{admin.email}</div>
                      </div>
                      <StatusBadge status={admin.status} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                {staff.isLoading
                  ? 'Loading…'
                  : 'No branch admin yet. Add one so the branch can start working.'}
              </p>
            )}
          </Panel>
        </div>
      </div>
      <BranchFormSheet open={editOpen} onOpenChange={setEditOpen} branch={b} />
      <BranchAdminDialog branch={b} open={adminOpen} onOpenChange={setAdminOpen} />
    </>
  );
}
