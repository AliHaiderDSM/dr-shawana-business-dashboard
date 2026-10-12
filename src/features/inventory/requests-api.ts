import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { Schemas } from '@/lib/api/types';

export type StockRequest = Schemas['StockRequest'];
export type StockRequestStatus = StockRequest['status'];
export type IncomingStock = Schemas['IncomingStock'];
export type WriteOffRecord = Schemas['WriteOffRecord'];
export type WriteOffReason = WriteOffRecord['reason'];

export const STOCK_REQUEST_LABELS: Record<StockRequestStatus, string> = {
  pending: 'Waiting for approval',
  approved: 'Approved, to send',
  rejected: 'Rejected',
  cancelled: 'Withdrawn',
  sent: 'On the way',
  received: 'Received',
};

export const WRITE_OFF_LABELS: Record<WriteOffReason, string> = {
  expired: 'Expired',
  damaged: 'Damaged',
  lost: 'Lost',
  adjustment: 'Adjustment',
};

const KEY = 'stock-requests';

function useInvalidate() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: ['incoming-stock'] }),
      queryClient.invalidateQueries({ queryKey: ['stock'] }),
      queryClient.invalidateQueries({ queryKey: ['sidebar-badges'] }),
    ]);
}

export function useStockRequests(status?: StockRequestStatus) {
  return useQuery({
    queryKey: [KEY, 'list', status ?? null],
    queryFn: () =>
      unwrap(api.GET('/branch/stock-requests', { params: { query: status ? { status } : {} } })).then(
        (r) => r.data,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useStockRequestCatalog(search: string, enabled: boolean) {
  return useQuery({
    queryKey: [KEY, 'catalog', search],
    queryFn: () =>
      unwrap(api.GET('/branch/stock-requests/catalog', { params: { query: search ? { search } : {} } })).then(
        (r) => r.data,
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useStockRequestCounts(enabled: boolean) {
  return useQuery({
    queryKey: [KEY, 'counts'],
    queryFn: () => unwrap(api.GET('/admin/stock-requests/pending-count')).then((r) => r.data),
    enabled,
    refetchInterval: 60_000,
  });
}

export function useAskStock() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: Schemas['CreateStockRequest']) =>
      unwrap(api.POST('/branch/stock-requests', { body })).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useWithdrawStockRequest() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST('/branch/stock-requests/{id}/cancel', { params: { path: { id } } })).then(
        (r) => r.data,
      ),
    onSuccess: invalidate,
  });
}

export function useDecideStockRequest() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      approve,
      body,
    }: {
      id: string;
      approve: boolean;
      body: Schemas['DecideStockRequest'];
    }) =>
      unwrap(
        approve
          ? api.POST('/admin/stock-requests/{id}/approve', { params: { path: { id } }, body })
          : api.POST('/admin/stock-requests/{id}/reject', { params: { path: { id } }, body }),
      ).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useIncomingStock(status?: 'waiting' | 'received') {
  return useQuery({
    queryKey: ['incoming-stock', status ?? null],
    queryFn: () =>
      unwrap(api.GET('/branch/incoming-stock', { params: { query: status ? { status } : {} } })).then(
        (r) => r.data,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useReceiveStock() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ transferNo, date }: { transferNo: string; date: string }) =>
      unwrap(
        api.POST('/branch/incoming-stock/{transferNo}/receive', {
          params: { path: { transferNo } },
          body: { date },
        }),
      ).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useWriteOffs(query: {
  reason?: WriteOffReason;
  status?: WriteOffRecord['status'];
  from?: string;
  to?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['stock', 'write-offs', query],
    queryFn: () => unwrap(api.GET('/branch/inventory/write-offs', { params: { query } })).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}

export function usePendingWriteOffCount(enabled: boolean) {
  return useQuery({
    queryKey: ['stock', 'write-offs', 'pending-count'],
    queryFn: () => unwrap(api.GET('/admin/write-offs/pending-count')).then((r) => r.data.pending),
    enabled,
    refetchInterval: 60_000,
  });
}

export function useReportWriteOffs() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: Schemas['ReportWriteOffs']) =>
      unwrap(api.POST('/branch/inventory/write-offs', { body })).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useDecideWriteOff() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, approve, note }: { id: string; approve: boolean; note?: string | null }) =>
      unwrap(
        approve
          ? api.POST('/admin/write-offs/{id}/approve', {
              params: { path: { id } },
              body: { note: note ?? null },
            })
          : api.POST('/admin/write-offs/{id}/reject', {
              params: { path: { id } },
              body: { note: note ?? null },
            }),
      ).then((r) => r.data),
    onSuccess: invalidate,
  });
}
