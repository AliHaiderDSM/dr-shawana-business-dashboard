import { api, unwrap } from '@/lib/api/client';
import type { Schemas } from '@/lib/api/types';
import { baseApi, fromApi, toApi } from '@redux/api/baseApi';
import { createCrud } from '@redux/api/crud';
import { store } from '@redux/store';
import type {
  Bundle,
  BundleInput,
  Category,
  Product,
  ProductInput,
  PurchaseInput,
  Supplier,
  SupplierInput,
} from './types';

export type * from './types';

export const categoriesApi = createCrud<Category, Schemas['CreateCategory']>(
  'categories',
  '/branch/categories',
);
export const productsApi = createCrud<
  Product,
  ProductInput,
  Schemas['UpdateProduct'],
  { id: string; name: string; salePrice?: string; trackSerials?: boolean }
>('products', '/branch/products');
export const bundlesApi = createCrud<Bundle, BundleInput>('bundles', '/branch/bundles');
export const suppliersApi = createCrud<
  Supplier,
  SupplierInput,
  Partial<SupplierInput>,
  { id: string; name: string; type: string }
>('suppliers', '/branch/suppliers');

export interface SavePurchaseArgs {
  productId: string;
  entryId?: string;
  body: PurchaseInput;
}

export interface RemovePurchaseArgs {
  productId: string;
  entryId: string;
}

const requestPurchases = (productId: string) =>
  unwrap(api.GET('/branch/products/{id}/purchases', { params: { path: { id: productId } } })).then(
    (r) => r.data,
  );

const requestSavePurchase = ({ productId, entryId, body }: SavePurchaseArgs) =>
  entryId
    ? unwrap(
        api.PATCH('/branch/products/{id}/purchases/{entryId}', {
          params: { path: { id: productId, entryId } },
          body,
        }),
      )
    : unwrap(api.POST('/branch/products/{id}/purchases', { params: { path: { id: productId } }, body }));

const requestProductStock = (productId: string) =>
  unwrap(api.GET('/branch/inventory/products/{productId}/ledger', { params: { path: { productId } } })).then(
    (r) => r.data,
  );

const requestProductByBarcode = (code: string) =>
  unwrap(api.GET('/branch/products/barcode/{code}', { params: { path: { code } } })).then((r) => r.data);

export type ProductPurchases = Awaited<ReturnType<typeof requestPurchases>>;
export type SavePurchaseResult = Awaited<ReturnType<typeof requestSavePurchase>>;
export type ProductStockLedger = Awaited<ReturnType<typeof requestProductStock>>;
export type ProductByBarcode = Awaited<ReturnType<typeof requestProductByBarcode>>;

export const catalogApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getProductPurchases: build.query<ProductPurchases, string>({
      queryFn: (productId) => fromApi(() => requestPurchases(productId)),
      providesTags: ['products'],
    }),
    saveProductPurchase: build.mutation<SavePurchaseResult, SavePurchaseArgs>({
      queryFn: (args) => toApi(() => requestSavePurchase(args)),
      invalidatesTags: (_r, error) => (error ? [] : ['products', 'stock']),
    }),
    removeProductPurchase: build.mutation<unknown, RemovePurchaseArgs>({
      queryFn: ({ productId, entryId }) =>
        toApi(() =>
          unwrap(
            api.DELETE('/branch/products/{id}/purchases/{entryId}', {
              params: { path: { id: productId, entryId } },
            }),
          ),
        ),
      invalidatesTags: (_r, error) => (error ? [] : ['products', 'stock']),
    }),
    getProductStockLedger: build.query<ProductStockLedger, string>({
      queryFn: (productId) => fromApi(() => requestProductStock(productId)),
      providesTags: ['stock'],
    }),
    getProductByBarcode: build.query<ProductByBarcode, string>({
      queryFn: (code) => fromApi(() => requestProductByBarcode(code)),
      providesTags: ['products'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetProductPurchasesQuery,
  useLazyGetProductPurchasesQuery,
  useSaveProductPurchaseMutation,
  useRemoveProductPurchaseMutation,
  useGetProductStockLedgerQuery,
  useLazyGetProductStockLedgerQuery,
  useGetProductByBarcodeQuery,
  useLazyGetProductByBarcodeQuery,
} = catalogApi;

export function usePurchases(productId: string) {
  return useGetProductPurchasesQuery(productId);
}

export function useProductStock(productId: string, enabled: boolean) {
  return useGetProductStockLedgerQuery(productId, { skip: !enabled });
}

export function findProductByBarcode(
  code: string,
): Promise<(typeof catalogApi.endpoints.getProductByBarcode)['Types']['ResultType']> {
  return store
    .dispatch(
      catalogApi.endpoints.getProductByBarcode.initiate(code, { subscribe: false, forceRefetch: true }),
    )
    .unwrap();
}
