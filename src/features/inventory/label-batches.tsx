import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Printer, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ErrorState } from '@/components/shared/error-state';
import { FilterSelect } from '@/components/shared/list-filters';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { productsApi } from '@/features/catalog/api';
import { useListState } from '@/hooks/use-list-state';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useBatches, useItems, useLabelBatches, type ItemStatus, type LabelBatch } from './api';
import { ITEM_STATUS, ItemStatusBadge } from './item-status';

const PIECES_PER_PAGE = 50;

function piecesQuery(group: LabelBatch) {
  return group.batchId ? { batchId: group.batchId } : { productId: group.productId, withoutBatch: 'true' };
}

function BatchPieces({ group, status }: { group: LabelBatch; status?: string }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const query = useItems({
    ...piecesQuery(group),
    ...(status ? { status } : {}),
    page,
    pageSize: PIECES_PER_PAGE,
  });
  const meta = query.data?.meta;
  if (query.isLoading) return <Skeleton className="m-4 h-24" />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <div className="border-t bg-muted/20">
      <div className="grid grid-cols-[9rem_10rem_minmax(0,1fr)_7rem] gap-3 border-b px-12 py-2 text-xs font-medium text-muted-foreground">
        <span>Label</span>
        <span>Status</span>
        <span>Sale</span>
        <span className="text-right">Received</span>
      </div>
      <ul className="divide-y">
        {(query.data?.data ?? []).map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => void navigate(`/inventory/labels/${item.serial}`)}
              className="grid w-full grid-cols-[9rem_10rem_minmax(0,1fr)_7rem] items-center gap-3 px-12 py-2 text-left text-sm hover:bg-muted/60"
            >
              <span className="font-mono font-medium">{item.serial}</span>
              <span>
                <ItemStatusBadge status={item.status} />
              </span>
              <span className="truncate text-muted-foreground">
                {item.invoiceNo ? `${item.invoiceNo} · ${formatDate(item.soldOn)}` : '—'}
              </span>
              <span className="text-right text-muted-foreground">{formatDate(item.receivedOn)}</span>
            </button>
          </li>
        ))}
      </ul>
      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
          {query.isFetching ? <Loader2 className="size-3 animate-spin" /> : null}
          <span>
            {(page - 1) * PIECES_PER_PAGE + 1}–{Math.min(page * PIECES_PER_PAGE, meta.total)} of {meta.total}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Previous pieces"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next pieces"
          >
            <ChevronRight />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function printLink(group: LabelBatch) {
  const params = new URLSearchParams(
    group.batchId ? { batchId: group.batchId } : { productId: group.productId, withoutBatch: 'true' },
  );
  return `/print/labels?${params.toString()}`;
}

export function LabelBatchesView() {
  const list = useListState({ prefix: 'b', pageSize: 20 });
  const query = useLabelBatches(list.query);
  const products = productsApi.useOptions();
  const productId = list.filters.productId;
  const batches = useBatches({ productId, pageSize: 100 }, Boolean(productId));
  const [open, setOpen] = useState<Set<string>>(new Set());
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="rounded-xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            placeholder="Batch, product or label"
            value={list.searchInput}
            onChange={(e) => list.setSearchInput(e.target.value)}
          />
        </div>
        <FilterSelect
          list={list}
          name="productId"
          allLabel="All products"
          className="w-48"
          options={(products.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
        />
        {productId ? (
          <FilterSelect
            list={list}
            name="batchId"
            allLabel="All batches"
            className="w-44"
            options={(batches.data?.data ?? []).map((b) => ({ value: b.id, label: b.batchNo }))}
          />
        ) : null}
        <FilterSelect
          list={list}
          name="status"
          allLabel="Any status"
          className="w-44"
          options={(Object.keys(ITEM_STATUS) as ItemStatus[]).map((s) => ({
            value: s,
            label: ITEM_STATUS[s].label,
          }))}
        />
        {query.isFetching && !query.isLoading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {query.isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : rows.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">No labelled batches match.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((group) => {
            const expanded = open.has(group.key);
            const expired =
              group.expiryDate !== null && group.expiryDate < new Date().toISOString().slice(0, 10);
            return (
              <li key={group.key}>
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                  <button
                    type="button"
                    onClick={() => toggle(group.key)}
                    aria-expanded={expanded}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <ChevronDown
                      className={cn(
                        'size-4 shrink-0 text-muted-foreground transition-transform',
                        !expanded && '-rotate-90',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{group.productName}</span>
                        <span className="rounded border px-1.5 py-0.5 font-mono text-xs">
                          {group.batchNo ?? 'No batch'}
                        </span>
                        {group.expiryDate ? (
                          <span
                            className={cn('text-xs', expired ? 'text-destructive' : 'text-muted-foreground')}
                          >
                            exp {formatDate(group.expiryDate)}
                          </span>
                        ) : null}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {group.firstSerial} – {group.lastSerial}
                      </div>
                    </div>
                    <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                      <StatusBadge tone="neutral">{group.total} labels</StatusBadge>
                      <StatusBadge tone="success">In stock {group.inStock}</StatusBadge>
                      <StatusBadge tone="info">Sold {group.sold}</StatusBadge>
                      {group.other ? <StatusBadge tone="warning">Other {group.other}</StatusBadge> : null}
                    </div>
                  </button>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Print these labels"
                  >
                    <Link to={printLink(group)}>
                      <Printer />
                    </Link>
                  </Button>
                </div>
                {expanded ? <BatchPieces group={group} status={list.filters.status} /> : null}
              </li>
            );
          })}
        </ul>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-between border-t px-4 py-2 text-sm text-muted-foreground">
          <span>
            Page {meta.page} of {meta.totalPages} · {meta.total} batches
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={meta.page <= 1}
              onClick={() => list.setPage(meta.page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={meta.page >= meta.totalPages}
              onClick={() => list.setPage(meta.page + 1)}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
