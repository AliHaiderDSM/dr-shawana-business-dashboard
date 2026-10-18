import { baseApi, fromApi, toApi } from '@redux/api/baseApi';
import { createCrud } from '@redux/api/crud';
import { store } from '@redux/store';
import { api, unwrap } from '@/lib/api/client';
import type {
  Patient,
  PatientCity,
  PatientInput,
  PatientOption,
  PatientPhoneCheck,
  PatientPhoneCheckArg,
  PatientRecordFileArg,
  PatientRecordFileUrl,
  PatientSummary,
  PatientUpdate,
} from './types';

export * from './types';

const patientsCrud = createCrud<Patient, PatientInput, PatientUpdate, PatientOption>(
  'patients',
  '/branch/patients',
);

export const patientsQueryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    searchPatientOptions: build.query<PatientOption[], string>({
      queryFn: (term) =>
        fromApi<PatientOption[]>(() =>
          unwrap(
            api.GET('/branch/patients/options', { params: { query: term ? { search: term } : {} } }),
          ).then((r) => r.data),
        ),
      providesTags: ['patients'],
    }),
    checkPatientPhone: build.query<PatientPhoneCheck, PatientPhoneCheckArg>({
      queryFn: ({ phone, excludeId }) =>
        fromApi<PatientPhoneCheck>(() =>
          unwrap(
            api.GET('/branch/patients/check-phone', {
              params: { query: { phone, ...(excludeId ? { excludeId } : {}) } },
            }),
          ).then((r) => r.data),
        ),
      serializeQueryArgs: ({ endpointName, queryArgs }) =>
        `${endpointName}(${JSON.stringify([queryArgs.phone.replace(/\D/g, ''), queryArgs.excludeId])})`,
      providesTags: ['patients'],
    }),
    getPatientCities: build.query<PatientCity, string>({
      queryFn: (term) =>
        fromApi<PatientCity>(() =>
          unwrap(api.GET('/branch/patients/cities', { params: { query: { search: term } } })).then(
            (r) => r.data,
          ),
        ),
      providesTags: ['patients'],
    }),
    getPatientSummary: build.query<PatientSummary, string>({
      queryFn: (id) =>
        fromApi<PatientSummary>(() =>
          unwrap(api.GET('/branch/patients/{id}/summary', { params: { path: { id } } })).then(
            (r) => r.data as PatientSummary,
          ),
        ),
      providesTags: (_r, _e, id) => ['patients', { type: 'patients', id: `summary:${id}` }],
    }),
    getPatientDetail: build.query<Patient, string>({
      queryFn: (id) =>
        fromApi<Patient>(() =>
          unwrap(api.GET('/branch/patients/{id}', { params: { path: { id } } })).then(
            (r) => r.data as Patient,
          ),
        ),
      providesTags: (_r, _e, id) => ['patients', { type: 'patients', id: `detail:${id}` }],
    }),
    getPatientRecordFileUrl: build.query<PatientRecordFileUrl, PatientRecordFileArg>({
      queryFn: ({ patientId, fileId }) =>
        toApi<PatientRecordFileUrl>(() =>
          unwrap(
            api.GET('/branch/patients/{id}/medical-records/files/{fileId}/url', {
              params: { path: { id: patientId, fileId } },
            }),
          ).then((r) => r.data),
        ),
      providesTags: ['patients'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useSearchPatientOptionsQuery,
  useLazySearchPatientOptionsQuery,
  useCheckPatientPhoneQuery,
  useGetPatientCitiesQuery,
  useGetPatientSummaryQuery,
  useGetPatientDetailQuery,
  useLazyGetPatientRecordFileUrlQuery,
} = patientsQueryApi;

export const patientsApi = {
  ...patientsCrud,
  useDetail: (id: string | undefined) => useGetPatientDetailQuery(id ?? '', { skip: !id }),
};

export function usePatientSearch(search: string, enabled = true) {
  return useSearchPatientOptionsQuery(search.trim(), { skip: !enabled, refetchOnMountOrArgChange: 30 });
}

export function usePhoneCheck(phone: string, excludeId?: string) {
  const digits = phone.replace(/\D/g, '');
  return useCheckPatientPhoneQuery(
    { phone, excludeId },
    { skip: digits.length < 10, refetchOnMountOrArgChange: 10 },
  );
}

export function useCities(search: string) {
  const term = search.trim();
  return useGetPatientCitiesQuery(term, { skip: term.length === 0, refetchOnMountOrArgChange: 300 });
}

export function usePatientSummary(id: string) {
  return useGetPatientSummaryQuery(id, { skip: !id });
}

export async function patientRecordFileUrl(
  patientId: string,
  fileId: string,
): Promise<(typeof patientsQueryApi.endpoints.getPatientRecordFileUrl)['Types']['ResultType']> {
  return store
    .dispatch(
      patientsQueryApi.endpoints.getPatientRecordFileUrl.initiate(
        { patientId, fileId },
        { subscribe: false, forceRefetch: true },
      ),
    )
    .unwrap();
}
