import type { ColumnDef } from '@tanstack/react-table';
import { Paperclip, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { DateRangeFilter, FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { RowActions } from '@/components/shared/row-actions';
import { Button } from '@/components/ui/button';
import { productsApi, suppliersApi } from '@/features/catalog/api';
import { useListState } from '@/hooks/use-list-state';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatQuantity } from '@/lib/format';
import {
  STOCK_DESTINATIONS,
  stockLineDetail,
  stockParty,
  useRemoveStockDocument,
  useStockDocuments,
  type StockDocument,
  type StockKind,
} from './api';
import { STOCK_KINDS } from './stock-config';
import { StockDocumentSheet } from './stock-document-sheet';
import { StockEntrySheet } from './stock-entry-sheet';

function sameSlip(a: StockDocument, b: StockDocument) {
  return a.createdAt === b.createdAt && a.createdBy === b.createdBy;
}

export function StockDocumentsPage({ kind }: { kind: StockKind }) {
  const config = STOCK_KINDS[kind];
  const navigate = useNavigate();
  const { can } = useAuth();
  const list = useListState({ defaultSort: '-date' });
  const query = useStockDocuments(kind, list.query);
  const remove = useRemoveStockDocument(kind);
  const products = productsApi.useOptions();
  const parties = suppliersApi.useOptions({ type: config.partyType });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StockDocument | null>(null);
  const [removing, setRemoving] = useState<StockDocument | null>(null);
  const rows = query.data?.data ?? [];

  const printSlip = (row: StockDocument) => {
    const ids = rows.filter((r) => sameSlip(r, row)).map((r) => r.id);
    void navigate(`${config.printPath}?ids=${ids.join(',')}`);
  };

  const columns: ColumnDef<StockDocument, unknown>[] = [
    {
      id: 'date',
      header: 'Date',
      accessorKey: 'date',
      meta: { sortKey: 'date' },
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.date)}</span>,
    },
    {
      id: 'product',
      header: 'Product',
      accessorFn: (r) => r.product?.name ?? '',
      meta: { hideable: false },
      cell: ({ row }) => <span className="font-medium">{row.original.product?.name ?? '—'}</span>,
    },
    {
      id: 'qty',
      header: 'Quantity',
      accessorKey: 'qty',
      meta: { align: 'right' },
      cell: ({ row }) => formatQuantity(row.original.qty),
    },
    {
      id: 'detail',
      header: config.detailLabel,
      accessorFn: (r) => stockLineDetail(r) ?? '',
      cell: ({ row }) => {
        const detail = stockLineDetail(row.original);
        if (!detail) return <span className="text-muted-foreground">—</span>;
        const expiry = 'expiryDate' in row.original ? row.original.expiryDate : null;
        const batchId = 'batchId' in row.original ? row.original.batchId : null;
        return (
          <div>
            {batchId ? (
              <Link
                to={`/inventory/batches/${batchId}`}
                className="font-mono text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {detail}
              </Link>
            ) : (
              detail
            )}
            {expiry ? <div className="text-xs text-muted-foreground">exp {formatDate(expiry)}</div> : null}
          </div>
        );
      },
    },
    {
      id: 'party',
      header: config.partyLabel,
      accessorFn: (r) => stockParty(r)?.name ?? '',
      cell: ({ row }) => stockParty(row.original)?.name ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'note',
      header: 'Note',
      accessorKey: 'note',
      cell: ({ row }) => (
        <span className="line-clamp-1 max-w-56 text-muted-foreground">{row.original.note ?? '—'}</span>
      ),
    },
    {
      id: 'files',
      header: 'Files',
      accessorFn: (r) => r.attachments.length,
      meta: { align: 'center' },
      cell: ({ row }) =>
        row.original.attachments.length ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Paperclip className="size-3.5" />
            {row.original.attachments.length}
          </span>
        ) : null,
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right', hideable: false },
      cell: ({ row }) => (
        <RowActions
          actions={[
            { label: 'Print slip', icon: Printer, onSelect: () => printSlip(row.original) },
            {
              label: 'Edit',
              icon: Pencil,
              hidden: !can('stock.update'),
              onSelect: () => setEditing(row.original),
            },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              separatorBefore: true,
              hidden: !can('stock.delete'),
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
        title={config.title}
        description={config.description}
        actions={
          can('stock.create') ? (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New {config.title.toLowerCase()}
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
        searchPlaceholder="Search product or note"
        exportFileName={kind === 'in' ? 'stock-in' : 'stock-out'}
        onRowClick={can('stock.update') ? setEditing : undefined}
        emptyTitle={`No ${config.title.toLowerCase()} entries`}
        emptyDescription={config.description}
        toolbar={
          <>
            <FilterSelect
              list={list}
              name="productId"
              allLabel="All products"
              className="w-48"
              options={(products.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
            <FilterSelect
              list={list}
              name="partyId"
              allLabel={`All ${config.partyLabel.toLowerCase()}s`}
              options={(parties.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
            {kind === 'out' ? (
              <FilterSelect
                list={list}
                name="destination"
                allLabel="All destinations"
                options={STOCK_DESTINATIONS.map((d) => ({ value: d, label: d }))}
              />
            ) : null}
            <DateRangeFilter list={list} />
          </>
        }
      />
      <StockDocumentSheet config={config} open={creating} onOpenChange={setCreating} />
      <StockEntrySheet
        key={editing?.id ?? 'none'}
        config={config}
        entry={editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Delete this entry?"
        description="Its stock movement is reversed. This is refused if it would take the product below zero."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? remove
                .mutateAsync(removing.id)
                .then(() => toast.success('Entry deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </>
  );
}

export function StockInPage() {
  return <StockDocumentsPage kind="in" />;
}

export function StockOutPage() {
  return <StockDocumentsPage kind="out" />;
}
