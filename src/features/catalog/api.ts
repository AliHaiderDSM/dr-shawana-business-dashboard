import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import { createCrud } from '@/lib/api/crud';
import type { Schemas } from '@/lib/api/types';

export type Category = Schemas['Category'];
export type Product = Schemas['Product'];
export type ProductInput = Schemas['CreateProduct'];
export type PurchaseEntry = Schemas['PurchaseEntry'];
export type PurchaseInput = Schemas['CreatePurchaseEntry'];
export type Bundle = Schemas['Bundle'];
export type BundleInput = Schemas['CreateBundle'];
export type Supplier = Schemas['Supplier'];
export type SupplierInput = Schemas['CreateSupplier'];

export const categoriesApi = createCrud<Category, Schemas['CreateCategory']>(
  'categories',
  '/branch/categories',
);
export const productsApi = createCrud<
  Product,
  ProductInput,
  Schemas['UpdateProduct'],
  { id: string; name: string; salePrice?: string }
>('products', '/branch/products');
export const bundlesApi = createCrud<Bundle, BundleInput>('bundles', '/branch/bundles');
export const suppliersApi = createCrud<
  Supplier,
  SupplierInput,
  Partial<SupplierInput>,
  { id: string; name: string; type: string }
>('suppliers', '/branch/suppliers');

export function usePurchases(productId: string) {
  return useQuery({
    queryKey: ['products', 'purchases', productId],
    queryFn: () =>
      unwrap(api.GET('/branch/products/{id}/purchases', { params: { path: { id: productId } } })).then(
        (r) => r.data,
      ),
  });
}

export function useSavePurchase(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, body }: { entryId?: string; body: PurchaseInput }) =>
      entryId
        ? unwrap(
            api.PATCH('/branch/products/{id}/purchases/{entryId}', {
              params: { path: { id: productId, entryId } },
              body,
            }),
          )
        : unwrap(api.POST('/branch/products/{id}/purchases', { params: { path: { id: productId } }, body })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}

export function useRemovePurchase(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) =>
      unwrap(
        api.DELETE('/branch/products/{id}/purchases/{entryId}', {
          params: { path: { id: productId, entryId } },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}

export function useProductStock(productId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['stock', 'ledger', productId],
    queryFn: () =>
      unwrap(
        api.GET('/branch/inventory/products/{productId}/ledger', { params: { path: { productId } } }),
      ).then((r) => r.data),
    enabled,
  });
}

export function findProductByBarcode(code: string) {
  return unwrap(api.GET('/branch/products/barcode/{code}', { params: { path: { code } } })).then(
    (r) => r.data,
  );
}
