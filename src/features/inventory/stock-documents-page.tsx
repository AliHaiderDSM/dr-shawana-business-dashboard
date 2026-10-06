import { useCanReceiveStock } from '@/lib/auth/branches';
import type { ColumnDef } from '@tanstack/react-table';
import { Paperclip, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
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
import { formatDate, formatMoney, formatQuantity } from '@/lib/format';
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

const dateOrDash = (value: string | null | undefined) =>
  value ? (
    <span className="whitespace-nowrap">{formatDate(value)}</span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );

function isTransferIn(doc: StockDocument) {
  return 'transferOutId' in doc && Boolean(doc.transferOutId);
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
  const canReceive = useCanReceiveStock();
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
        const batchId = 'batchId' in row.original ? row.original.batchId : null;
        return batchId ? (
          <Link
            to={`/inventory/batches/${batchId}`}
            className="font-mono text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {detail}
          </Link>
        ) : (
          detail
        );
      },
    },
    ...(kind === 'in'
      ? ([
          {
            id: 'manufacturingDate',
            header: 'Mfg date',
            accessorFn: (r) => ('manufacturingDate' in r ? (r.manufacturingDate ?? '') : ''),
            cell: ({ row }) =>
              dateOrDash('manufacturingDate' in row.original ? row.original.manufacturingDate : null),
          },
          {
            id: 'expiryDate',
            header: 'Expiry',
            accessorFn: (r) => ('expiryDate' in r ? (r.expiryDate ?? '') : ''),
            cell: ({ row }) => dateOrDash('expiryDate' in row.original ? row.original.expiryDate : null),
          },
          {
            id: 'unitCost',
            header: 'Unit cost',
            accessorFn: (r) => ('unitCost' in r ? (r.unitCost ?? '') : ''),
            meta: { align: 'right' },
            cell: ({ row }) =>
              'unitCost' in row.original && row.original.unitCost ? (
                formatMoney(row.original.unitCost)
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
        ] satisfies ColumnDef<StockDocument, unknown>[])
      : ([
          {
            id: 'batches',
            header: 'Batches',
            accessorFn: (r) =>
              'batches' in r
                ? r.batches
                    .map((b) => `${b.batchNo} ${b.qty}${b.expiryDate ? ` exp ${b.expiryDate}` : ''}`)
                    .join('; ')
                : '',
            cell: ({ row }) => {
              const used = 'batches' in row.original ? row.original.batches : [];
              if (used.length === 0) return <span className="text-muted-foreground">—</span>;
              return (
                <div className="space-y-0.5 text-xs">
                  {used.map((b) => (
                    <div key={b.batchNo} className="whitespace-nowrap tabular-nums">
                      <span className="font-mono font-medium">{b.batchNo}</span> · {formatQuantity(b.qty)}
                      <span className="text-muted-foreground">
                        {b.manufacturingDate ? ` · mfg ${formatDate(b.manufacturingDate)}` : ''}
                        {b.expiryDate ? ` · exp ${formatDate(b.expiryDate)}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              );
            },
          },
        ] satisfies ColumnDef<StockDocument, unknown>[])),
    {
      id: 'party',
      header: config.partyLabel,
      accessorFn: (r) => stockParty(r)?.name ?? '',
      cell: ({ row }) =>
        isTransferIn(row.original) ? (
          <StatusBadge tone="primary">From Super Admin</StatusBadge>
        ) : (
          (stockParty(row.original)?.name ?? <span className="text-muted-foreground">—</span>)
        ),
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
              hidden: !can('stock.update') || isTransferIn(row.original),
              onSelect: () => setEditing(row.original),
            },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              separatorBefore: true,
              hidden: !can('stock.delete') || isTransferIn(row.original),
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
        description={
          kind === 'in' && !canReceive
            ? 'Stock this branch received from the Super Admin stock. Branches do not receive stock directly.'
            : config.description
        }
        actions={
          can('stock.create') && canReceive ? (
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
        onRowClick={can('stock.update') ? (r) => !isTransferIn(r) && setEditing(r) : undefined}
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
