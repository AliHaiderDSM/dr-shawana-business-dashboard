import type { ColumnDef } from '@tanstack/react-table';
import { Eye, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { StatusBadge } from '@/components/shared/status-badge';
import { Thumb } from '@/components/shared/thumb';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useListState } from '@/hooks/use-list-state';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatMoney, formatQuantity } from '@/lib/format';
import { categoriesApi, productsApi, type Product } from './api';
import { ProductFormSheet } from './product-form-sheet';

export function ProductsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const list = useListState({ defaultSort: 'name' });
  const query = productsApi.useList(list.query);
  const categories = categoriesApi.useOptions();
  const remove = productsApi.useRemove();
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<Product | null>(null);

  const openSheet = (product: Product | null) => {
    setEditing(product);
    setOpen(true);
  };

  const columns: ColumnDef<Product, unknown>[] = [
    {
      id: 'name',
      header: 'Product',
      accessorKey: 'name',
      meta: { sortKey: 'name', hideable: false },
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Thumb src={row.original.imageUrl} name={row.original.name} />
          <div className="min-w-0">
            <div className="truncate font-medium">{row.original.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {[row.original.sku ? `SKU ${row.original.sku}` : null, row.original.barcode]
                .filter(Boolean)
                .join(' · ') || 'No SKU'}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      accessorFn: (p) => p.category?.name ?? '',
      cell: ({ row }) => row.original.category?.name ?? '—',
    },
    {
      id: 'batchNo',
      header: 'Batch / Gram',
      accessorFn: (p) => p.batchNo ?? '',
      cell: ({ row }) => row.original.batchNo ?? '—',
    },
    { id: 'unit', header: 'Unit', accessorKey: 'unit' },
    {
      id: 'salePrice',
      header: 'Sale price',
      accessorKey: 'salePrice',
      meta: { sortKey: 'salePrice', align: 'right' },
      cell: ({ row }) => <span className="font-medium">{formatMoney(row.original.salePrice)}</span>,
    },
    {
      id: 'lowStockThreshold',
      header: 'Low stock at',
      accessorKey: 'lowStockThreshold',
      meta: { align: 'right' },
      cell: ({ row }) => formatQuantity(row.original.lowStockThreshold),
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right', hideable: false },
      cell: ({ row }) => (
        <RowActions
          actions={[
            { label: 'View', icon: Eye, onSelect: () => navigate(`/products/${row.original.id}`) },
            {
              label: 'Edit',
              icon: Pencil,
              hidden: !can('products.update'),
              onSelect: () => openSheet(row.original),
            },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              separatorBefore: true,
              hidden: !can('products.delete'),
              onSelect: () => setRemoving(row.original),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything the branch sells. Prices follow the latest purchase entry."
        actions={
          can('products.create') ? (
            <Button onClick={() => openSheet(null)}>
              <Plus />
              New product
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
        searchPlaceholder="Name, SKU, batch or barcode"
        exportFileName="products"
        onRowClick={(p) => navigate(`/products/${p.id}`)}
        emptyTitle="No products yet"
        emptyDescription="Add products with their first purchase to start tracking stock."
        emptyAction={
          can('products.create') ? (
            <Button size="sm" onClick={() => openSheet(null)}>
              <Package />
              Add product
            </Button>
          ) : null
        }
        toolbar={
          <>
            <Select
              value={list.filters.categoryId ?? 'all'}
              onValueChange={(v) => list.setFilter('categoryId', v === 'all' ? undefined : v)}
            >
              <SelectTrigger size="sm" className="h-9 w-44" aria-label="Category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(categories.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
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
      <ProductFormSheet open={open} onOpenChange={setOpen} product={editing} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete ${removing?.name ?? 'product'}?`}
        description="The product is hidden from new sales. Its stock history and past sales are kept."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? remove
                .mutateAsync(removing.id)
                .then(() => toast.success('Product deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
