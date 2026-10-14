import { productsApi } from '@/features/catalog/api';
import { useBranchOptions, useInWarehouse } from '@/lib/auth/branches';
import type { ColumnDef } from '@tanstack/react-table';
import { Ban, CheckCircle2, Eye, HandCoins, Pencil, Plus, Printer, Trash2, Truck, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { DateRangeFilter, enumOptions, FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { useStaffList } from '@/features/staff/api';
import { useListState } from '@/hooks/use-list-state';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/utils';
import { TraceNumber } from '@/features/trace/trace-page';
import { formatAmount, formatCount, formatDate, formatMoney, formatQuantity } from '@/lib/format';
import {
  DELIVERY_LABELS,
  PAYMENT_STATUS_LABELS,
  SALE_TYPE_LABELS,
  salesApi,
  useApprovePayments,
  useSales,
  type SaleListItem,
} from './api';
import { DeliveryBadge, useOrderActions } from './delivery-actions';
import { SalePaymentSheet } from './sale-detail-page';

const OWN_ONLY = new Set(['front_desk', 'team_manager']);

export function useCanChangeSale() {
  const { me, can } = useAuth();
  return (sale: Pick<SaleListItem, 'createdBy'>, action: 'update' | 'delete') =>
    can(`sales.${action}`) && (!OWN_ONLY.has(me?.role ?? '') || sale.createdBy === me?.profile.id);
}

export function SalesPage() {
  const navigate = useNavigate();
  const { can, setBranchId } = useAuth();
  const canChange = useCanChangeSale();
  const inWarehouse = useInWarehouse();
  const branches = useBranchOptions(inWarehouse);
  const products = productsApi.useOptions();
  const open = (sale: SaleListItem, path = `/sales/${sale.id}`) => {
    if (inWarehouse && sale.branch) setBranchId(sale.branch.id);
    void navigate(path);
  };
  const list = useListState({ defaultSort: '-invoiceSeq' });
  const query = useSales(list.query);
  const staff = useStaffList({ pageSize: 100 }, can('staff.view'));
  const remove = salesApi.useRemove();
  const orders = useOrderActions();
  const [removing, setRemoving] = useState<SaleListItem | null>(null);
  const [paying, setPaying] = useState<SaleListItem | null>(null);
  const [payKey, setPayKey] = useState(0);
  const due = list.filters.due === 'true';
  const awaiting = list.filters.deliveryStatus === 'pending';
  const approval = list.filters.paymentStatus === 'awaiting_approval';
  const completed = list.filters.completed === 'true';
  const pending = list.filters.pending === 'true';
  const approve = useApprovePayments();
  const byBranch = query.data?.meta.byBranch;
  const totals = query.data?.meta.totals;

  const columns: ColumnDef<SaleListItem, unknown>[] = [
    {
      id: 'invoiceNo',
      header: 'Invoice',
      accessorKey: 'invoiceNo',
      meta: { sortKey: 'invoiceSeq', hideable: false },
      cell: ({ row }) => <TraceNumber number={row.original.invoiceNo} />,
    },
    ...(inWarehouse
      ? [
          {
            id: 'branch',
            header: 'Branch',
            accessorFn: (r: SaleListItem) => r.branch?.name ?? '',
            cell: ({ row }: { row: { original: SaleListItem } }) =>
              row.original.branch ? (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-xs font-semibold text-primary-soft-foreground">
                    {row.original.branch.code}
                  </span>
                  {row.original.branch.name}
                </span>
              ) : (
                '—'
              ),
          } satisfies ColumnDef<SaleListItem, unknown>,
        ]
      : []),
    {
      id: 'date',
      header: 'Date',
      accessorKey: 'date',
      meta: { sortKey: 'date' },
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.date)}</span>,
    },
    {
      id: 'customer',
      header: 'Customer',
      accessorFn: (s) => `${s.patient?.name ?? ''} ${s.patient?.phone ?? ''}`,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.patient?.name}</div>
          <div className="text-xs text-muted-foreground tabular-nums">{row.original.patient?.phone}</div>
        </div>
      ),
    },
    {
      id: 'products',
      header: 'Products',
      accessorFn: (s) =>
        (s.products ?? []).map((p) => (p.qty ? `${p.name} x ${Number(p.qty)}` : p.name)).join('; '),
      cell: ({ row }) => (
        <ul className="space-y-0.5">
          {(row.original.products ?? []).map((p, index) => (
            <li key={`${p.name}-${index}`} className="max-w-56 truncate" title={p.name}>
              {p.name}
              {p.qty ? (
                <span className="text-muted-foreground tabular-nums"> × {formatQuantity(p.qty)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      accessorFn: (s) => SALE_TYPE_LABELS[s.saleType],
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <StatusBadge tone={row.original.saleType === 'online' ? 'info' : 'neutral'} dot={false}>
            {SALE_TYPE_LABELS[row.original.saleType]}
          </StatusBadge>
          <div className="text-xs text-muted-foreground">{row.original.city}</div>
        </div>
      ),
    },
    {
      id: 'qty',
      header: 'Qty',
      accessorKey: 'totalQty',
      meta: { align: 'right' },
      cell: ({ row }) => formatQuantity(row.original.totalQty),
    },
    {
      id: 'subtotal',
      header: 'Actual amount',
      accessorKey: 'grossAmount',
      meta: { align: 'right' },
      cell: ({ row }) => formatAmount(row.original.grossAmount),
    },
    {
      id: 'discount',
      header: 'Discount',
      accessorKey: 'discountTotal',
      meta: { align: 'right' },
      cell: ({ row }) =>
        Number(row.original.discountTotal) ? (
          <span className="text-destructive tabular-nums">−{formatAmount(row.original.discountTotal)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'total',
      header: 'Net-amount',
      accessorKey: 'total',
      meta: { align: 'right' },
      cell: ({ row }) => <span className="font-medium">{formatAmount(row.original.total)}</span>,
    },
    {
      id: 'remaining',
      header: 'Remaining',
      accessorKey: 'remaining',
      meta: { align: 'right' },
      cell: ({ row }) =>
        Number(row.original.remaining) > 0 ? (
          <span className="font-medium text-destructive tabular-nums">
            {formatAmount(row.original.remaining)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'payment',
      header: 'Payment',
      accessorKey: 'paymentStatus',
      cell: ({ row }) =>
        row.original.paymentStatus === 'partial' ? (
          <StatusBadge tone="warning">Remaining</StatusBadge>
        ) : (
          <StatusBadge status={row.original.paymentStatus} />
        ),
    },
    {
      id: 'delivery',
      header: 'Delivery',
      accessorFn: (s) => (s.deliveryStatus ? DELIVERY_LABELS[s.deliveryStatus] : ''),
      cell: ({ row }) =>
        row.original.deliveryStatus ? (
          <div>
            <DeliveryBadge status={row.original.deliveryStatus} />
            {row.original.dispatchedOn ? (
              <div className="mt-0.5 text-xs text-muted-foreground">
                dispatched {formatDate(row.original.dispatchedOn)}
              </div>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right', hideable: false },
      cell: ({ row }) => {
        const s = row.original;
        const online = s.saleType === 'online';
        return (
          <RowActions
            actions={[
              { label: 'Open', icon: Eye, onSelect: () => open(s) },
              { label: 'Print bill', icon: Printer, onSelect: () => open(s, `/print/bill/${s.id}`) },
              {
                label: 'Approve payment',
                icon: CheckCircle2,
                hidden:
                  s.paymentStatus !== 'awaiting_approval' ||
                  s.deliveryStatus === 'cancelled' ||
                  !can('salePayments.update'),
                onSelect: () =>
                  approve
                    .mutateAsync({ id: s.id })
                    .then(() => toast.success(`${s.invoiceNo}: payment approved`))
                    .catch(toastError),
              },
              {
                label: 'Mark as paid',
                icon: HandCoins,
                hidden: Number(s.remaining) <= 0 || !canChange(s, 'update'),
                onSelect: () => {
                  setPaying(s);
                  setPayKey((k) => k + 1);
                },
              },
              {
                label: 'Edit',
                icon: Pencil,
                hidden:
                  !canChange(s, 'update') ||
                  s.deliveryStatus === 'returned' ||
                  s.deliveryStatus === 'cancelled',
                onSelect: () => void navigate(`/sales/${s.id}/edit`),
              },
              {
                label: 'Dispatch',
                icon: Truck,
                separatorBefore: true,
                hidden:
                  !online ||
                  s.deliveryStatus !== 'pending' ||
                  !can('sales.update') ||
                  Boolean(s.fulfillmentBranchId),
                onSelect: () => orders.dispatch(s),
              },
              {
                label: 'Mark returned',
                icon: Undo2,
                hidden:
                  !online ||
                  (s.deliveryStatus !== 'dispatched' && s.deliveryStatus !== 'delivered') ||
                  !can('sales.update'),
                onSelect: () => orders.returned(s),
              },
              {
                label: 'Cancel order',
                icon: Ban,
                hidden: !online || s.deliveryStatus !== 'pending' || !canChange(s, 'update'),
                onSelect: () => orders.cancel(s),
              },
              {
                label: 'Delete',
                icon: Trash2,
                destructive: true,
                separatorBefore: true,
                hidden: !canChange(s, 'delete'),
                onSelect: () => setRemoving(s),
              },
            ]}
          />
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Sales"
        description="Every sale in this branch. Totals cover all matching sales, not just this page."
        actions={
          can('sales.create') ? (
            <Button asChild>
              <Link to="/sales/new">
                <Plus />
                Add sale
              </Link>
            </Button>
          ) : null
        }
      />
      {byBranch?.length ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {byBranch.map((b) => {
            const selected = list.filters.branchId === b.branchId;
            return (
              <button
                key={b.branchId}
                type="button"
                onClick={() => list.setFilter('branchId', selected ? undefined : b.branchId)}
                className={cn(
                  'rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:border-border-strong',
                  selected && 'border-primary ring-1 ring-primary',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{b.branchName}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatCount(b.count)} sales · {formatQuantity(b.qty)} qty
                  </span>
                </div>
                <div className="mt-2 text-xl font-semibold tabular-nums">{formatMoney(b.total)}</div>
              </button>
            );
          })}
        </div>
      ) : null}
      <DataTable
        columns={columns}
        data={query.data?.data}
        meta={query.data?.meta}
        list={list}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        searchPlaceholder="Invoice, customer or phone"
        exportFileName="sales"
        onRowClick={(s) => open(s)}
        emptyTitle="No sales yet"
        dense
        totalsRow={
          totals
            ? {
                invoiceNo: `Total · ${formatCount(query.data?.meta.total ?? 0)} sales`,
                qty: formatQuantity(totals.qty),
                subtotal: formatAmount(totals.gross),
                discount: formatAmount(totals.discountTotal),
                total: formatAmount(totals.total),
                remaining: formatAmount(totals.remaining),
              }
            : undefined
        }
        quickFilters={
          <div
            className="inline-flex items-center gap-1 rounded-lg bg-muted p-1"
            role="tablist"
            aria-label="Sale status"
          >
            {(
              [
                ['all', 'All sales', !due && !awaiting && !approval && !completed && !pending],
                ['completed', 'Completed', completed],
                ['pending', 'Pending', pending],
                ['due', 'Payment pending', due],
                ['approval', 'Awaiting approval', approval],
                ['awaiting', 'Awaiting dispatch', awaiting],
              ] as const
            ).map(([key, label, active]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                title={key === 'pending' ? 'Payment or dispatch still pending' : undefined}
                onClick={() =>
                  list.setFilters({
                    completed: key === 'completed' ? 'true' : undefined,
                    pending: key === 'pending' ? 'true' : undefined,
                    due: key === 'due' ? 'true' : undefined,
                    paymentStatus: key === 'approval' ? 'awaiting_approval' : undefined,
                    deliveryStatus: key === 'awaiting' ? 'pending' : undefined,
                  })
                }
                className={cn(
                  'h-8 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        }
        toolbar={
          <>
            <DateRangeFilter list={list} />
            {inWarehouse ? (
              <FilterSelect
                list={list}
                name="branchId"
                allLabel="All branches"
                className="w-44"
                options={(branches.data ?? [])
                  .filter((b) => b.kind === 'branch')
                  .map((b) => ({ value: b.id, label: b.name }))}
              />
            ) : null}
            <FilterSelect
              list={list}
              name="productId"
              allLabel="All products"
              className="w-48"
              options={(products.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
            <FilterSelect
              list={list}
              name="saleType"
              allLabel="Office & online"
              className="w-40"
              options={enumOptions(['office', 'online'] as const, SALE_TYPE_LABELS)}
            />
            <FilterSelect
              list={list}
              name="paymentStatus"
              allLabel="Any payment"
              className="w-36"
              options={enumOptions(
                ['paid', 'partial', 'unpaid', 'awaiting_approval'] as const,
                PAYMENT_STATUS_LABELS,
              )}
            />
            <FilterSelect
              list={list}
              name="deliveryStatus"
              allLabel="Any delivery"
              className="w-36"
              options={enumOptions(
                ['pending', 'dispatched', 'returned', 'cancelled'] as const,
                DELIVERY_LABELS,
              )}
            />
            {staff.data?.data.length ? (
              <FilterSelect
                list={list}
                name="createdBy"
                allLabel="All staff"
                className="w-40"
                options={staff.data.data.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))}
              />
            ) : null}
          </>
        }
      />
      {orders.dialogs}
      {paying ? (
        <SalePaymentSheet
          key={payKey}
          saleId={paying.id}
          payment={null}
          suggested={paying.remaining}
          open
          onOpenChange={(open) => !open && setPaying(null)}
        />
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete sale ${removing?.invoiceNo ?? ''}?`}
        description="Its stock is put back and its payments are removed from the accounts."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? remove
                .mutateAsync(removing.id)
                .then(() => toast.success('Sale deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
