import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { Schemas } from '@/lib/api/types';

export type SaleReturn = Schemas['SaleReturn'];
export type ReturnItem = SaleReturn['items'][number];
export type ReturnReason = SaleReturn['reason'];
export type ReturnDisposition = ReturnItem['disposition'];
export type ReturnInput = Schemas['CreateSaleReturn'];
export type RefundInput = Schemas['ReturnRefundInput'];
export type Returnable = Schemas['ReturnableSale'];

export const REASON_LABELS: Record<ReturnReason, string> = {
  damaged: 'Damaged',
  expired: 'Expired',
  wrong_item: 'Wrong item',
  customer_refused: 'Customer refused',
  not_delivered: 'Not delivered',
  other: 'Other',
};

export const DISPOSITION_LABELS: Record<ReturnDisposition, string> = {
  pending: 'Awaiting inspection',
  quarantined: 'In quarantine',
  restocked: 'Back in stock',
  damaged: 'Damaged',
  expired: 'Expired',
  supplier: 'Sent to supplier',
};

const DEPENDENTS = ['returns', 'stock', 'products', 'dashboard', 'sales'];

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => Promise.all(DEPENDENTS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}

export function useReturns(query: Record<string, unknown>) {
  return useQuery({
    queryKey: ['returns', 'list', query],
    queryFn: () => unwrap(api.GET('/branch/returns', { params: { query } })),
    placeholderData: keepPreviousData,
  });
}

export function useReturn(id: string | undefined) {
  return useQuery({
    queryKey: ['returns', 'detail', id],
    queryFn: () =>
      unwrap(api.GET('/branch/returns/{id}', { params: { path: { id: id ?? '' } } })).then((r) => r.data),
    enabled: Boolean(id),
  });
}

export function useReturnable(saleId: string | null) {
  return useQuery({
    queryKey: ['returns', 'returnable', saleId],
    queryFn: () =>
      unwrap(
        api.GET('/branch/returns/sale/{saleId}/returnable', { params: { path: { saleId: saleId ?? '' } } }),
      ).then((r) => r.data),
    enabled: Boolean(saleId),
  });
}

export function useSaleSearch(search: string, enabled: boolean) {
  const term = search.trim();
  return useQuery({
    queryKey: ['sales', 'search', term],
    queryFn: () =>
      unwrap(
        api.GET('/branch/sales', {
          params: { query: { pageSize: 10, sort: '-date', ...(term ? { search: term } : {}) } },
        }),
      ).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCreateReturn() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: ReturnInput) => unwrap(api.POST('/branch/returns', { body })).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useResolveItem(returnId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      itemId,
      disposition,
      note,
    }: {
      itemId: string;
      disposition: Exclude<ReturnDisposition, 'pending'>;
      note: string | null;
    }) =>
      unwrap(
        api.POST('/branch/returns/{id}/items/{itemId}/resolve', {
          params: { path: { id: returnId, itemId } },
          body: { disposition, note },
        }),
      ).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useSetRefund(returnId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (refund: RefundInput | null) =>
      unwrap(
        api.PUT('/branch/returns/{id}/refund', { params: { path: { id: returnId } }, body: { refund } }),
      ).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useRemoveReturn() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/branch/returns/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
  });
}
