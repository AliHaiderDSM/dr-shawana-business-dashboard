import type { ColumnDef } from '@tanstack/react-table';

export function serialColumn<T>(
  position: { page: number; pageSize: number } = { page: 1, pageSize: 0 },
  skip?: (row: T) => boolean,
): ColumnDef<T, unknown> {
  const numberOf = (index: number) => (position.page - 1) * position.pageSize + index + 1;
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
