import type { ColumnDef } from '@tanstack/react-table';

interface SerialOrder {
  page: number;
  pageSize: number;
  total: number | undefined;
  newestFirst: boolean;
}

export function serialColumn<T>(order: SerialOrder, skip?: (row: T) => boolean): ColumnDef<T, unknown> {
  const numberOf = (index: number) => {
    const position = (order.page - 1) * order.pageSize + index;
    return order.newestFirst && order.total !== undefined ? order.total - position : position + 1;
  };
  return {
    id: 'sr',
    header: 'Sr No.',
    accessorFn: (_row, index) => numberOf(index),
    meta: { hideable: false },
    cell: ({ row }) =>
      skip?.(row.original) ? null : (
        <span className="text-muted-foreground tabular-nums">{numberOf(row.index)}</span>
      ),
  };
}
