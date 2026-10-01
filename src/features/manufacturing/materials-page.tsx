import type { ColumnDef } from '@tanstack/react-table';
import { Eye, FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { useListState } from '@/hooks/use-list-state';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatQuantity } from '@/lib/format';
import { materialCategoriesApi, materialsApi, type Material } from './api';
import { MaterialFormSheet } from './material-form-sheet';

export function MaterialLevelBadge({ material }: { material: Material }) {
  const store = Number(material.storeQuantity);
  if (Number(material.bareMinimum) > 0 && store <= Number(material.bareMinimum))
    return <StatusBadge tone="danger">Bare minimum</StatusBadge>;
  if (Number(material.minimum) > 0 && store <= Number(material.minimum))
    return <StatusBadge tone="warning">Minimum</StatusBadge>;
  return <StatusBadge tone="success">OK</StatusBadge>;
}

export function MaterialsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const list = useListState({ defaultSort: 'name' });
  const query = materialsApi.useList(list.query);
  const categories = materialCategoriesApi.useOptions();
  const remove = materialsApi.useRemove();
  const [editing, setEditing] = useState<Material | null>(null);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<Material | null>(null);

  const openSheet = (material: Material | null) => {
    setEditing(material);
    setOpen(true);
  };

  const quantityCell = (value: string, unit: string) => (
    <span>
      {formatQuantity(value)} <span className="text-muted-foreground">{unit}</span>
    </span>
  );

  const columns: ColumnDef<Material, unknown>[] = [
    {
      id: 'name',
      header: 'Material',
      accessorKey: 'name',
      meta: { sortKey: 'name', hideable: false },
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      id: 'category',
      header: 'Category',
      accessorFn: (m) => m.category?.name ?? '',
      cell: ({ row }) => row.original.category?.name ?? '—',
    },
    {
      id: 'storeQuantity',
      header: 'Store qty',
      accessorKey: 'storeQuantity',
      meta: { align: 'right' },
      cell: ({ row }) => quantityCell(row.original.storeQuantity, row.original.unit),
    },
    {
      id: 'labQuantity',
      header: 'Lab qty',
      accessorKey: 'labQuantity',
      meta: { align: 'right' },
      cell: ({ row }) => quantityCell(row.original.labQuantity, row.original.unit),
    },
    {
      id: 'minimum',
      header: 'Minimum',
      accessorKey: 'minimum',
      meta: { align: 'right' },
      cell: ({ row }) => formatQuantity(row.original.minimum),
    },
    {
      id: 'bareMinimum',
      header: 'Bare minimum',
      accessorKey: 'bareMinimum',
      meta: { align: 'right' },
      cell: ({ row }) => formatQuantity(row.original.bareMinimum),
    },
    {
      id: 'level',
      header: 'Level',
      accessorFn: (m) => m.storeQuantity,
      cell: ({ row }) => <MaterialLevelBadge material={row.original} />,
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right', hideable: false },
      cell: ({ row }) => (
        <RowActions
          actions={[
            {
              label: 'Receipts',
              icon: Eye,
              onSelect: () => void navigate(`/materials/${row.original.id}`),
            },
            {
              label: 'Edit',
              icon: Pencil,
              hidden: !can('materials.update'),
              onSelect: () => openSheet(row.original),
            },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              separatorBefore: true,
              hidden: !can('materials.delete'),
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
        title="Materials"
        description="Raw materials in the store and the pharmacy lab."
        actions={
          can('materials.create') ? (
            <Button onClick={() => openSheet(null)}>
              <Plus />
              New material
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
        searchPlaceholder="Search materials"
        exportFileName="materials"
        onRowClick={(m) => void navigate(`/materials/${m.id}`)}
        emptyTitle="No materials yet"
        emptyDescription="Add raw materials with their minimum levels."
        emptyAction={
          can('materials.create') ? (
            <Button size="sm" onClick={() => openSheet(null)}>
              <FlaskConical />
              Add material
            </Button>
          ) : null
        }
        toolbar={
          <FilterSelect
            list={list}
            name="categoryId"
            allLabel="All categories"
            className="w-44"
            options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
        }
      />
      <MaterialFormSheet material={editing} open={open} onOpenChange={setOpen} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete ${removing?.name ?? 'material'}?`}
        description="This is refused while the material has stock or is used in a recipe."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? remove
                .mutateAsync(removing.id)
                .then(() => toast.success('Material deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}
