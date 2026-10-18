import { baseApi, fromApi, toApi } from '@redux/api/baseApi';
import { api, unwrap } from '@/lib/api/client';
import type {
  DisabledAppAccess,
  IssuedAppCode,
  PatientAppAccess,
  PatientRequestDetail,
  PatientRequestFilter,
  PatientRequestList,
  UpdatedPatientRequest,
  UpdatePatientRequestArg,
} from './types';

export * from './types';

const accessTag = (patientId: string) => ({ type: 'patient-app-access' as const, id: patientId });

export const patientRequestsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPatientRequests: build.query<PatientRequestList, PatientRequestFilter>({
      queryFn: (status) =>
        fromApi<PatientRequestList>(() =>
          unwrap(
            api.GET('/branch/patient-requests', {
              params: { query: status === 'all' ? {} : { status } },
            }),
          ).then((r) => r.data),
        ),
      providesTags: ['patient-requests'],
    }),
    getPatientRequest: build.query<PatientRequestDetail, string>({
      queryFn: (id) =>
        fromApi<PatientRequestDetail>(() =>
          unwrap(api.GET('/branch/patient-requests/{id}', { params: { path: { id } } })).then((r) => r.data),
        ),
      providesTags: ['patient-requests'],
    }),
    updatePatientRequest: build.mutation<UpdatedPatientRequest, UpdatePatientRequestArg>({
      queryFn: ({ id, body }) =>
        toApi<UpdatedPatientRequest>(() =>
          unwrap(api.PATCH('/branch/patient-requests/{id}', { params: { path: { id } }, body })).then(
            (r) => r.data,
          ),
        ),
      invalidatesTags: (_r, error) => (error ? [] : ['patient-requests', 'sidebar-badges']),
    }),
    getPatientAppAccess: build.query<PatientAppAccess, string>({
      queryFn: (patientId) =>
        fromApi<PatientAppAccess>(() =>
          unwrap(api.GET('/branch/patients/{id}/app-access', { params: { path: { id: patientId } } })).then(
            (r) => r.data,
          ),
        ),
      providesTags: (_r, _e, patientId) => ['patient-app-access', accessTag(patientId)],
    }),
    issuePatientAppCode: build.mutation<IssuedAppCode, string>({
      queryFn: (patientId) =>
        toApi<IssuedAppCode>(() =>
          unwrap(
            api.POST('/branch/patients/{id}/app-access/code', { params: { path: { id: patientId } } }),
          ).then((r) => r.data),
        ),
      invalidatesTags: (_r, error, patientId) => (error ? [] : [accessTag(patientId)]),
    }),
    disablePatientAppAccess: build.mutation<DisabledAppAccess, string>({
      queryFn: (patientId) =>
        toApi<DisabledAppAccess>(() =>
          unwrap(
            api.POST('/branch/patients/{id}/app-access/disable', { params: { path: { id: patientId } } }),
          ).then((r) => r.data),
        ),
      invalidatesTags: (_r, error, patientId) => (error ? [] : [accessTag(patientId)]),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetPatientRequestsQuery,
  useGetPatientRequestQuery,
  useUpdatePatientRequestMutation,
  useGetPatientAppAccessQuery,
  useIssuePatientAppCodeMutation,
  useDisablePatientAppAccessMutation,
} = patientRequestsApi;

export function usePatientRequests(status: PatientRequestFilter) {
  return useGetPatientRequestsQuery(status);
}

export function usePatientRequest(id: string | null) {
  return useGetPatientRequestQuery(id ?? '', { skip: !id });
}

export function useAppAccess(patientId: string, enabled = true) {
  return useGetPatientAppAccessQuery(patientId, { skip: !(enabled && patientId) });
}
