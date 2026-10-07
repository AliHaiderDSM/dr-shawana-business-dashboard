import { productsApi } from '@/features/catalog/api';
import { useBranchOptions, useInWarehouse } from '@/lib/auth/branches';
import type { ColumnDef } from '@tanstack/react-table';
import { Ban, CheckCheck, Eye, Pencil, Plus, Printer, Trash2, Truck, Undo2 } from 'lucide-react';
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
import { formatCount, formatDate, formatMoney, formatQuantity } from '@/lib/format';
import {
  DELIVERY_LABELS,
  PAYMENT_STATUS_LABELS,
  SALE_TYPE_LABELS,
  salesApi,
  useSales,
  type SaleListItem,
} from './api';
import { DeliveryBadge, useOrderActions } from './delivery-actions';

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
  const totals = query.data?.meta.totals;

  const columns: ColumnDef<SaleListItem, unknown>[] = [
    {
      id: 'invoiceNo',
      header: 'Invoice',
      accessorKey: 'invoiceNo',
      meta: { sortKey: 'invoiceSeq', hideable: false },
      cell: ({ row }) => <span className="font-medium">{row.original.invoiceNo}</span>,
    },
    ...(inWarehouse
      ? [
          {
            id: 'branch',
            header: 'Branch',
            accessorFn: (r: SaleListItem) => r.branch?.name ?? '',
            cell: ({ row }: { row: { original: SaleListItem } }) => row.original.branch?.name ?? '—',
          } satisfies ColumnDef<SaleListItem, unknown>,
        ]
      : []),
    {
      id: 'date',
      header: 'Date',
      accessorKey: 'date',
      meta: { sortKey: 'date' },
      cell: ({ row }) => formatDate(row.original.date),
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
      id: 'type',
      header: 'Type',
      accessorFn: (s) => SALE_TYPE_LABELS[s.saleType],
      cell: ({ row }) => (
        <div className="text-sm">
          <div>{SALE_TYPE_LABELS[row.original.saleType]}</div>
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
      header: 'Sub amount',
      accessorKey: 'subtotal',
      meta: { align: 'right' },
      cell: ({ row }) => formatMoney(row.original.subtotal),
    },
    {
      id: 'discount',
      header: 'Discount',
      accessorKey: 'discountAmount',
      meta: { align: 'right' },
      cell: ({ row }) =>
        Number(row.original.discountAmount) ? (
          formatMoney(row.original.discountAmount)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'total',
      header: 'Total',
      accessorKey: 'total',
      meta: { align: 'right' },
      cell: ({ row }) => <span className="font-medium">{formatMoney(row.original.total)}</span>,
    },
    {
      id: 'received',
      header: 'Received',
      accessorKey: 'received',
      meta: { align: 'right' },
      cell: ({ row }) => formatMoney(row.original.received),
    },
    {
      id: 'remaining',
      header: 'Remaining',
      accessorKey: 'remaining',
      meta: { align: 'right' },
      cell: ({ row }) =>
        Number(row.original.remaining) > 0 ? (
          <span className="text-destructive">{formatMoney(row.original.remaining)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'payment',
      header: 'Payment',
      accessorKey: 'paymentStatus',
      cell: ({ row }) => <StatusBadge status={row.original.paymentStatus} />,
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
                sent {formatDate(row.original.dispatchedOn)}
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
                hidden: !online || s.deliveryStatus !== 'pending' || !can('sales.update'),
                onSelect: () => orders.dispatch(s),
              },
              {
                label: 'Mark delivered',
                icon: CheckCheck,
                separatorBefore: !online || s.deliveryStatus !== 'pending',
                hidden: !online || s.deliveryStatus !== 'dispatched' || !can('sales.update'),
                onSelect: () => orders.delivered(s),
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
        totalsRow={
          totals
            ? {
                invoiceNo: `Total · ${formatCount(query.data?.meta.total ?? 0)} sales`,
                qty: formatQuantity(totals.qty),
                subtotal: formatMoney(totals.subtotal),
                discount: formatMoney(totals.discount),
                total: formatMoney(totals.total),
                received: formatMoney(totals.received),
                remaining: formatMoney(totals.remaining),
              }
            : undefined
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
              options={enumOptions(['paid', 'partial', 'unpaid'] as const, PAYMENT_STATUS_LABELS)}
            />
            <FilterSelect
              list={list}
              name="deliveryStatus"
              allLabel="Any delivery"
              className="w-36"
              options={enumOptions(
                ['pending', 'dispatched', 'delivered', 'returned', 'cancelled'] as const,
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
