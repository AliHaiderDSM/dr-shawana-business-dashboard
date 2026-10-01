import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, jsonFormData, unwrap, uploadForm } from '@/lib/api/client';
import { createCrud } from '@/lib/api/crud';
import type { PageMeta, Schemas } from '@/lib/api/types';

export type Sale = Schemas['Sale'];
export type SaleListItem = Omit<Sale, 'items' | 'payments'>;
export type SaleInput = Schemas['CreateSale'];
export type SaleUpdate = Schemas['UpdateSale'];
export type SalePayment = Sale['payments'][number];
export type DeliveryStatus = NonNullable<Sale['deliveryStatus']>;

export interface SaleTotals {
  qty: string;
  subtotal: string;
  discount: string;
  total: string;
  received: string;
  remaining: string;
}

export const SALE_TYPE_LABELS: Record<Sale['saleType'], string> = {
  office: 'Office sale',
  online: 'Online sale',
};
export const PAYMENT_STATUS_LABELS: Record<Sale['paymentStatus'], string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
};
export const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
  pending: 'Pending',
  delivered: 'Delivered',
  returned: 'Returned',
};
export const SALE_CITIES = ['Lahore', 'Islamabad', 'Karachi', 'Multan'];

const DEPENDENTS = ['sales', 'stock', 'products', 'dashboard', 'returns', 'patients'];

export const salesApi = createCrud<Sale, SaleInput, SaleUpdate>('sales', '/branch/sales', {
  invalidates: DEPENDENTS.slice(1),
});

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => Promise.all(DEPENDENTS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}

export function useSales(query: Record<string, unknown>) {
  return useQuery({
    queryKey: ['sales', 'list', query],
    queryFn: () =>
      unwrap(api.GET('/branch/sales', { params: { query } })) as Promise<{
        data: SaleListItem[];
        meta: PageMeta & { totals: SaleTotals };
      }>,
    placeholderData: keepPreviousData,
  });
}

export function useCreateSale() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ body, proofs }: { body: SaleInput; proofs: File[] }) =>
      uploadForm<Sale>('/branch/sales', jsonFormData(body, { paymentProofs: proofs })),
    onSuccess: invalidate,
  });
}

export function useSetDelivery() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: DeliveryStatus }) =>
      unwrap(api.POST('/branch/sales/{id}/delivery', { params: { path: { id } }, body: { status } })).then(
        (r) => r.data,
      ),
    onSuccess: invalidate,
  });
}

export function useSaveSalePayment(saleId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      paymentId,
      body,
      proof,
    }: {
      paymentId?: string;
      body: Schemas['UpdateSalePayment'] &
        Pick<Schemas['SalePaymentInput'], 'method' | 'amount' | 'accountSheetId'>;
      proof: File | null;
    }) => {
      if (!paymentId)
        return uploadForm<Sale>(`/branch/sales/${saleId}/payments`, jsonFormData(body, { proof }));
      const updated = await unwrap(
        api.PATCH('/branch/sales/{id}/payments/{paymentId}', {
          params: { path: { id: saleId, paymentId } },
          body,
        }),
      );
      if (!proof) return updated.data;
      const form = new FormData();
      form.append('proof', proof);
      return uploadForm<Sale>(`/branch/sales/${saleId}/payments/${paymentId}/proof`, form);
    },
    onSuccess: invalidate,
  });
}

export function useRemoveSalePayment(saleId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (paymentId: string) =>
      unwrap(
        api.DELETE('/branch/sales/{id}/payments/{paymentId}', {
          params: { path: { id: saleId, paymentId } },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function salePaymentProofUrl(saleId: string, paymentId: string) {
  return unwrap(
    api.GET('/branch/sales/{id}/payments/{paymentId}/proof-url', {
      params: { path: { id: saleId, paymentId } },
    }),
  ).then((r) => r.data);
}

export interface BillData {
  company: { name: string; phone: string | null; email: string | null; address: string | null } | null;
  branch: { name: string; code: string; city: string; address: string | null; phone: string | null };
  customer: { name: string; phone: string; address: string | null; city: string } | null;
  sale: {
    invoiceNo: string;
    date: string;
    saleType: Sale['saleType'];
    city: string;
    totalQty: string;
    subtotal: string;
    discountPercent: string;
    discountAmount: string;
    total: string;
    received: string;
    remaining: string;
    paymentStatus: Sale['paymentStatus'];
    note: string | null;
  };
  items: {
    sr: number;
    product: string;
    bundle: string | null;
    qty: string;
    unitPrice: string;
    lineTotal: string;
  }[];
  payments: { cash: SalePayment[]; online: SalePayment[] };
}

export function useBill(id: string) {
  return useQuery({
    queryKey: ['sales', 'bill', id],
    queryFn: () =>
      unwrap(api.GET('/branch/sales/{id}/bill', { params: { path: { id } } })).then(
        (r) => r.data as unknown as BillData,
      ),
    enabled: Boolean(id),
  });
}

export interface DeliverySlip {
  saleId: string;
  invoiceNo: string;
  date: string;
  saleType: Sale['saleType'];
  to: { name: string; phone: string; city: string | null; address: string | null };
  items: { name: string; qty: string }[];
  from: { name: string; phone: string | null; city: string; address: string | null };
}

export interface DeliverySlipsQuery {
  from?: string;
  to?: string;
  saleType?: Sale['saleType'];
  patientId?: string;
  invoiceFrom?: number;
  invoiceTo?: number;
}

export function useDeliverySlips(query: DeliverySlipsQuery, enabled = true) {
  return useQuery({
    queryKey: ['sales', 'delivery-slips', query],
    queryFn: () =>
      unwrap(api.GET('/branch/sales/delivery-slips', { params: { query } })).then(
        (r) => r.data as unknown as { slipsPerPage: number; slips: DeliverySlip[] },
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}
