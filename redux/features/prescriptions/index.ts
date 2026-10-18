import { baseApi, fromApi } from '@redux/api/baseApi';
import { createCrud } from '@redux/api/crud';
import { api, unwrap } from '@/lib/api/client';
import type {
  Prescription,
  PrescriptionCatalog,
  PrescriptionInput,
  PrescriptionPrintResponse,
  PrescriptionUpdate,
} from './types';

export * from './types';

export const prescriptionsApi = createCrud<Prescription, PrescriptionInput, PrescriptionUpdate>(
  'prescriptions',
  '/branch/prescriptions',
  { invalidates: ['clinical'] },
);

export const prescriptionsQueryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPrescriptionCatalog: build.query<PrescriptionCatalog, void>({
      queryFn: () =>
        fromApi<PrescriptionCatalog>(() =>
          unwrap(api.GET('/branch/prescription-catalog')).then((r) => r.data),
        ),
      providesTags: ['prescriptions'],
    }),
    getPrescriptionPrint: build.query<PrescriptionPrintResponse, string>({
      queryFn: (id) =>
        fromApi<PrescriptionPrintResponse>(() =>
          unwrap(api.GET('/branch/prescriptions/{id}/print', { params: { path: { id } } })).then(
            (r) => r.data,
          ),
        ),
      providesTags: ['prescriptions'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetPrescriptionCatalogQuery, useGetPrescriptionPrintQuery } = prescriptionsQueryApi;

export function usePrescriptionCatalog(enabled = true) {
  return useGetPrescriptionCatalogQuery(undefined, { skip: !enabled, refetchOnMountOrArgChange: 600 });
}

export function usePrescriptionPrint(id: string) {
  return useGetPrescriptionPrintQuery(id, { skip: !id });
}
