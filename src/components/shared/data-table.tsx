import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ListState } from '@/hooks/use-list-state';
import type { PageMeta } from '@/lib/api/types';
import { formatCount } from '@/lib/format';
import { cn } from '@/lib/utils';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';

export interface ColumnMeta {
  sortKey?: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
  exportValue?: (row: unknown) => string | number | null | undefined;
  hideable?: boolean;
}

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[] | undefined;
  meta?: PageMeta;
  list?: ListState;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: unknown;
  onRetry?: () => void;
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  actions?: ReactNode;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  exportFileName?: string;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
  rowClassName?: (row: T) => string | undefined;
  footer?: ReactNode;
}

const PAGE_SIZES = [10, 20, 50, 100];

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function DataTable<T>({
  columns,
  data,
  meta,
  list,
  isLoading,
  isFetching,
  error,
  onRetry,
  searchPlaceholder = 'Search…',
  toolbar,
  actions,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  exportFileName,
  onRowClick,
  getRowId,
  rowClassName,
  footer,
}: DataTableProps<T>) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
  });

  const hideable = table
    .getAllLeafColumns()
    .filter((c) => (c.columnDef.meta as ColumnMeta | undefined)?.hideable !== false && c.id !== 'actions');

  function exportCsv() {
    const visible = table.getVisibleLeafColumns().filter((c) => c.id !== 'actions');
    const header = visible.map((c) =>
      csvCell(typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id),
    );
    const rows = table.getRowModel().rows.map((row) =>
      visible.map((c) => {
        const exportValue = (c.columnDef.meta as ColumnMeta | undefined)?.exportValue;
        return csvCell(exportValue ? exportValue(row.original) : row.getValue(c.id));
      }),
    );
    const blob = new Blob([`\uFEFF${[header, ...rows].map((r) => r.join(',')).join('\r\n')}`], {
      type: 'text/csv;charset=utf-8',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${exportFileName ?? 'export'}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function toggleSort(sortKey: string) {
    if (!list) return;
    if (list.sort === sortKey) list.setSort(`-${sortKey}`);
    else if (list.sort === `-${sortKey}`) list.setSort(undefined);
    else list.setSort(sortKey);
  }

  const rows = table.getRowModel().rows;
  const colCount = table.getVisibleLeafColumns().length;
  const from = meta && meta.total > 0 ? (meta.page - 1) * meta.pageSize + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.pageSize, meta.total) : 0;
  const hasFilters = list && (Object.keys(list.filters).length > 0 || list.search);

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      {list || toolbar || actions || exportFileName ? (
        <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {list ? (
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={list.searchInput}
                  onChange={(e) => list.setSearchInput(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-9 pl-9"
                  aria-label="Search"
                />
              </div>
            ) : null}
            {toolbar}
            {hasFilters ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  list.setSearchInput('');
                  list.resetFilters();
                }}
              >
                <X />
                Reset
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            {exportFileName ? (
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
                <Download />
                Export
              </Button>
            ) : null}
            {hideable.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" aria-label="Choose columns">
                    <Settings2 />
                    <span className="hidden sm:inline">Columns</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {hideable.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          'relative overflow-x-auto transition-opacity',
          isFetching && !isLoading && 'opacity-70',
        )}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="bg-muted/50 hover:bg-muted/50">
                {group.headers.map((header) => {
                  const columnMeta = header.column.columnDef.meta as ColumnMeta | undefined;
                  const sortKey = columnMeta?.sortKey;
                  const direction =
                    list && sortKey
                      ? list.sort === sortKey
                        ? 'asc'
                        : list.sort === `-${sortKey}`
                          ? 'desc'
                          : null
                      : null;
                  const content = header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext());
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        'h-10 text-xs font-medium text-muted-foreground',
                        columnMeta?.align === 'right' && 'text-right',
                        columnMeta?.align === 'center' && 'text-center',
                        columnMeta?.className,
                      )}
                      aria-sort={
                        direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : undefined
                      }
                    >
                      {sortKey && list ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(sortKey)}
                          className={cn(
                            '-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground',
                            columnMeta?.align === 'right' && 'flex-row-reverse',
                          )}
                        >
                          {content}
                          {direction === 'asc' ? (
                            <ArrowUp className="size-3.5" />
                          ) : direction === 'desc' ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <ChevronsUpDown className="size-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        content
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }, (_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  {Array.from({ length: colCount }, (_, j) => (
                    <TableCell key={j} className="py-3.5">
                      <Skeleton className={cn('h-4', j === 0 ? 'w-40' : 'w-20')} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colCount}>
                  <ErrorState error={error} onRetry={onRetry} />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colCount}>
                  <EmptyState
                    title={hasFilters ? 'No matching results' : emptyTitle}
                    description={
                      hasFilters ? 'Try a different search or clear the filters.' : emptyDescription
                    }
                    action={hasFilters ? undefined : emptyAction}
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(onRowClick && 'cursor-pointer', rowClassName?.(row.original))}
                >
                  {row.getVisibleCells().map((cell) => {
                    const columnMeta = cell.column.columnDef.meta as ColumnMeta | undefined;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          'py-3',
                          columnMeta?.align === 'right' && 'text-right tabular-nums',
                          columnMeta?.align === 'center' && 'text-center',
                          columnMeta?.className,
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {footer}

      {meta && list ? (
        <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground tabular-nums">
            {meta.total === 0
              ? 'No results'
              : `Showing ${formatCount(from)}–${formatCount(to)} of ${formatCount(meta.total)}`}
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Rows</span>
              <Select value={String(list.pageSize)} onValueChange={(v) => list.setPageSize(Number(v))}>
                <SelectTrigger size="sm" className="w-[4.5rem]" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => list.setPage(meta.page - 1)}
                disabled={meta.page <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft />
              </Button>
              <span className="min-w-16 text-center text-muted-foreground tabular-nums">
                {meta.page} / {Math.max(1, meta.totalPages)}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => list.setPage(meta.page + 1)}
                disabled={meta.page >= meta.totalPages}
                aria-label="Next page"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
