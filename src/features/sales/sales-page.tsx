import type { ColumnDef } from '@tanstack/react-table';
import { CheckCheck, Eye, Pencil, Plus, Printer, Trash2, Undo2 } from 'lucide-react';
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
import { formatDate, formatMoney, formatQuantity } from '@/lib/format';
import {
  DELIVERY_LABELS,
  PAYMENT_STATUS_LABELS,
  SALE_TYPE_LABELS,
  salesApi,
  useSales,
  useSetDelivery,
  type DeliveryStatus,
  type SaleListItem,
} from './api';

const OWN_ONLY = new Set(['front_desk', 'team_manager']);

export function useCanChangeSale() {
  const { me, can } = useAuth();
  return (sale: Pick<SaleListItem, 'createdBy'>, action: 'update' | 'delete') =>
    can(`sales.${action}`) && (!OWN_ONLY.has(me?.role ?? '') || sale.createdBy === me?.profile.id);
}

export function useDeliveryAction() {
  const setDelivery = useSetDelivery();
  const [pending, setPending] = useState<{ sale: SaleListItem; status: DeliveryStatus } | null>(null);
  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => !open && setPending(null)}
      title={
        pending?.status === 'returned'
          ? `Mark ${pending.sale.invoiceNo} as returned?`
          : `Mark ${pending?.sale.invoiceNo ?? ''} as delivered?`
      }
      description={
        pending?.status === 'returned'
          ? 'Everything still on the sale goes to the returns section for inspection. Stock changes only after inspection.'
          : 'The order reached the customer.'
      }
      confirmLabel={pending?.status === 'returned' ? 'Mark returned' : 'Mark delivered'}
      destructive={pending?.status === 'returned'}
      onConfirm={() =>
        pending
          ? setDelivery
              .mutateAsync({ id: pending.sale.id, status: pending.status })
              .then(() =>
                toast.success(`${pending.sale.invoiceNo}: ${DELIVERY_LABELS[pending.status].toLowerCase()}`),
              )
              .catch(toastError)
          : undefined
      }
    />
  );
  return { ask: (sale: SaleListItem, status: DeliveryStatus) => setPending({ sale, status }), dialog };
}

export function SalesPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const canChange = useCanChangeSale();
  const list = useListState({ defaultSort: '-invoiceSeq' });
  const query = useSales(list.query);
  const staff = useStaffList({ pageSize: 100 }, can('staff.view'));
  const remove = salesApi.useRemove();
  const delivery = useDeliveryAction();
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
      id: 'payment',
      header: 'Payment',
      accessorKey: 'paymentStatus',
      cell: ({ row }) => <StatusBadge status={row.original.paymentStatus} />,
    },
    {
      id: 'delivery',
      header: 'Delivery',
      accessorFn: (s) => s.deliveryStatus ?? '',
      cell: ({ row }) =>
        row.original.deliveryStatus ? (
          <StatusBadge status={row.original.deliveryStatus} />
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
              { label: 'Open', icon: Eye, onSelect: () => void navigate(`/sales/${s.id}`) },
              { label: 'Print bill', icon: Printer, onSelect: () => void navigate(`/print/bill/${s.id}`) },
              {
                label: 'Edit',
                icon: Pencil,
                hidden: !canChange(s, 'update') || s.deliveryStatus === 'returned',
                onSelect: () => void navigate(`/sales/${s.id}/edit`),
              },
              {
                label: 'Mark delivered',
                icon: CheckCheck,
                separatorBefore: true,
                hidden: !online || s.deliveryStatus !== 'pending' || !canChange(s, 'update'),
                onSelect: () => delivery.ask(s, 'delivered'),
              },
              {
                label: 'Mark returned',
                icon: Undo2,
                hidden: !online || s.deliveryStatus === 'returned' || !canChange(s, 'update'),
                onSelect: () => delivery.ask(s, 'returned'),
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
        onRowClick={(s) => void navigate(`/sales/${s.id}`)}
        emptyTitle="No sales yet"
        footer={
          totals ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-t bg-muted/30 px-4 py-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
              {(
                [
                  ['Qty', formatQuantity(totals.qty)],
                  ['Sub amount', formatMoney(totals.subtotal)],
                  ['Discount', formatMoney(totals.discount)],
                  ['Total', formatMoney(totals.total)],
                  ['Received', formatMoney(totals.received)],
                  ['Remaining', formatMoney(totals.remaining)],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="font-semibold tabular-nums">{value}</div>
                </div>
              ))}
            </div>
          ) : null
        }
        toolbar={
          <>
            <DateRangeFilter list={list} />
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
              options={enumOptions(['pending', 'delivered', 'returned'] as const, DELIVERY_LABELS)}
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
      {delivery.dialog}
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
