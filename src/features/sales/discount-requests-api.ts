import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { Schemas } from '@/lib/api/types';

export type DiscountRequest = Schemas['DiscountRequest'];
export type DiscountRequestStatus = DiscountRequest['status'];

export const DISCOUNT_STATUS_LABELS: Record<DiscountRequestStatus, string> = {
  pending: 'Waiting',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Withdrawn',
  used: 'Used in a sale',
};

const KEY = 'discount-requests';

function useInvalidate() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: ['sidebar-badges'] }),
    ]);
}

export function useDiscountRequests(
  query: { status?: DiscountRequestStatus; ids?: string[] },
  enabled = true,
) {
  const ids = query.ids?.length ? query.ids.join(',') : undefined;
  return useQuery({
    queryKey: [KEY, 'list', query.status ?? null, ids ?? null],
    queryFn: () =>
      unwrap(
        api.GET('/branch/discount-requests', {
          params: { query: { ...(query.status ? { status: query.status } : {}), ...(ids ? { ids } : {}) } },
        }),
      ).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled,
    refetchInterval: (q) => ((q.state.data ?? []).some((r) => r.status === 'pending') ? 8_000 : false),
  });
}

export function usePendingDiscountCount(enabled: boolean) {
  return useQuery({
    queryKey: [KEY, 'pending-count'],
    queryFn: () => unwrap(api.GET('/admin/discount-requests/pending-count')).then((r) => r.data.pending),
    enabled,
    refetchInterval: 30_000,
  });
}

export function useAskDiscount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: {
      productId?: string;
      bundleId?: string;
      qty: string;
      discountPercent: string;
      note?: string | null;
      patientId?: string;
      customerName?: string;
    }) => unwrap(api.POST('/branch/discount-requests', { body })).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useWithdrawDiscount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST('/branch/discount-requests/{id}/cancel', { params: { path: { id } } })).then(
        (r) => r.data,
      ),
    onSuccess: invalidate,
  });
}

export function useDecideDiscount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, approve, note }: { id: string; approve: boolean; note?: string | null }) =>
      unwrap(
        approve
          ? api.POST('/admin/discount-requests/{id}/approve', {
              params: { path: { id } },
              body: { note: note ?? null },
            })
          : api.POST('/admin/discount-requests/{id}/reject', {
              params: { path: { id } },
              body: { note: note ?? null },
            }),
      ).then((r) => r.data),
    onSuccess: invalidate,
  });
}
