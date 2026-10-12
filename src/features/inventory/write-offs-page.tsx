import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge, type Tone } from '@/components/shared/status-badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ROLE_LABELS } from '@/features/staff/api';
import type { Role } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatQuantity } from '@/lib/format';
import { useWriteOffs, WRITE_OFF_LABELS, type WriteOffReason, type WriteOffRecord } from './requests-api';

const REASON_TONES: Record<WriteOffReason, Tone> = {
  expired: 'warning',
  damaged: 'danger',
  lost: 'danger',
  adjustment: 'neutral',
};

export function WriteOffsPage() {
  const { isSuperAdmin } = useAuth();
  const [reason, setReason] = useState<WriteOffReason | 'all'>('all');
  const [search, setSearch] = useState('');
  const list = useWriteOffs({
    ...(reason === 'all' ? {} : { reason }),
    ...(search.trim() ? { search: search.trim() } : {}),
  });

  const columns: ColumnDef<WriteOffRecord, unknown>[] = [
    {
      id: 'writeOffNo',
      header: 'Write-off no',
      accessorKey: 'writeOffNo',
      cell: ({ row }) => (
        <span className="font-mono font-medium whitespace-nowrap">{row.original.writeOffNo}</span>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      accessorKey: 'date',
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.date)}</span>,
    },
    ...(isSuperAdmin
      ? ([
          {
            id: 'branch',
            header: 'Branch',
            accessorFn: (r) => r.branch.name,
            cell: ({ row }) => row.original.branch.name,
          },
        ] as ColumnDef<WriteOffRecord, unknown>[])
      : []),
    {
      id: 'product',
      header: 'Product',
      accessorKey: 'productName',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.productName}</div>
          <div className="text-xs text-muted-foreground">
            {row.original.batchNo ? `Batch ${row.original.batchNo}` : 'No batch'}
            {row.original.expiryDate ? ` · expires ${formatDate(row.original.expiryDate)}` : ''}
          </div>
        </div>
      ),
    },
    {
      id: 'qty',
      header: 'Qty',
      accessorFn: (r) => -Number(r.qty),
      meta: { align: 'right' },
      cell: ({ row }) => (
        <span className="text-destructive tabular-nums">
          −{formatQuantity(row.original.qty)} {row.original.unit}
        </span>
      ),
    },
    {
      id: 'reason',
      header: 'Why',
      accessorFn: (r) => WRITE_OFF_LABELS[r.reason],
      cell: ({ row }) => (
        <div className="space-y-1">
          <StatusBadge tone={REASON_TONES[row.original.reason]}>
            {WRITE_OFF_LABELS[row.original.reason]}
          </StatusBadge>
          {row.original.note ? (
            <div className="max-w-64 text-xs text-muted-foreground">{row.original.note}</div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'serials',
      header: 'Labels',
      accessorFn: (r) => r.serials.join(', '),
      cell: ({ row }) =>
        row.original.serials.length ? (
          <span className="font-mono text-xs" title={row.original.serials.join(', ')}>
            {row.original.serials.slice(0, 3).join(', ')}
            {row.original.serials.length > 3 ? ` +${row.original.serials.length - 3}` : ''}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'createdBy',
      header: 'By',
      accessorFn: (r) => r.createdBy?.name ?? '',
      cell: ({ row }) => (
        <div>
          <div>{row.original.createdBy?.name ?? '—'}</div>
          <div className="text-xs text-muted-foreground">
            {row.original.createdBy ? (ROLE_LABELS[row.original.createdBy.role as Role] ?? '') : ''}
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Write-offs"
        description="Stock taken out as expired, damaged or lost, with the reason and who did it. Written-off stock and labels can never be sold or dispatched. Write off a batch from Batches & Expiry."
      />
      <DataTable
        columns={columns}
        data={list.data}
        isLoading={list.isLoading}
        isFetching={list.isFetching}
        error={list.error}
        onRetry={() => void list.refetch()}
        getRowId={(r) => r.id}
        exportFileName="write-offs"
        emptyTitle="Nothing written off"
        toolbar={
          <>
            <Tabs value={reason} onValueChange={(v) => setReason(v as WriteOffReason | 'all')}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="expired">Expired</TabsTrigger>
                <TabsTrigger value="damaged">Damaged</TabsTrigger>
                <TabsTrigger value="lost">Lost</TabsTrigger>
              </TabsList>
            </Tabs>
            <Input
              placeholder="Search product, batch or number"
              className="h-9 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </>
        }
      />
    </>
  );
}
