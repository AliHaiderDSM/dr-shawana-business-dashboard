import { baseApi, fromApi, toApi } from '@redux/api/baseApi';
import type { TagType } from '@redux/api/tagTypes';
import { store } from '@redux/store';
import { api, ApiError, unwrap } from '@/lib/api/client';
import type {
  AppointmentConsultation,
  ChangedConsultationStatus,
  ConsultationDetail,
  ConsultationHistoryResponse,
  ConsultationListPage,
  MrsHistory,
  ReferralLetter,
  SaveConsultationSectionArg,
  SavedConsultationSection,
  SetConsultationStatusArg,
  StartedConsultation,
} from './types';

export * from './types';

const LIST_TAG = { type: 'consultations', id: 'list' } as const;

export const consultationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAppointmentConsultation: build.query<AppointmentConsultation | null, string>({
      queryFn: (appointmentId) =>
        fromApi<AppointmentConsultation | null>(async () => {
          try {
            return await unwrap(
              api.GET('/branch/appointments/{id}/consultation', { params: { path: { id: appointmentId } } }),
            ).then((r) => r.data);
          } catch (error) {
            if (error instanceof ApiError && error.status === 404) return null;
            throw error;
          }
        }),
      providesTags: (_r, _e, appointmentId) => [
        'consultations',
        { type: 'consultations', id: `appointment:${appointmentId}` },
      ],
    }),
    startConsultation: build.mutation<StartedConsultation, string>({
      queryFn: async (appointmentId, { dispatch }) => {
        const outcome = await toApi<StartedConsultation>(() =>
          unwrap(
            api.POST('/branch/appointments/{id}/consultation', { params: { path: { id: appointmentId } } }),
          ).then((r) => r.data),
        );
        if ('data' in outcome)
          void dispatch(
            consultationsApi.util.upsertQueryData('getAppointmentConsultation', appointmentId, outcome.data),
          );
        return outcome;
      },
      invalidatesTags: (_r, error) => (error ? [] : [LIST_TAG]),
    }),
    saveConsultationSection: build.mutation<SavedConsultationSection, SaveConsultationSectionArg>({
      queryFn: async ({ consultation, key, data }, { dispatch }) => {
        const outcome = await toApi<SavedConsultationSection>(() =>
          unwrap(
            api.PUT('/branch/consultations/{id}/sections/{key}', {
              params: { path: { id: consultation.id, key } },
              body: data,
            }),
          ).then((r) => r.data),
        );
        if ('data' in outcome) {
          const result = outcome.data;
          dispatch(
            consultationsApi.util.updateQueryData(
              'getAppointmentConsultation',
              consultation.appointmentId,
              (current) =>
                current
                  ? {
                      ...current,
                      availableSections: result.availableSections,
                      sections: { ...current.sections, [result.key]: result.section },
                    }
                  : current,
            ),
          );
        }
        return outcome;
      },
      invalidatesTags: (result, error, { consultation }) => {
        if (error || !result) return [];
        const tags: (TagType | { type: TagType; id: string })[] = [];
        if (result.key === 'basic_info') tags.push('patients');
        if (result.key === 'clinical_assessment')
          tags.push({ type: 'consultations', id: `history:${consultation.id}` });
        if (result.key === 'mrs_scale')
          tags.push({ type: 'consultations', id: `mrs:${consultation.patientId}` });
        return tags;
      },
    }),
    setConsultationStatus: build.mutation<ChangedConsultationStatus, SetConsultationStatusArg>({
      queryFn: async ({ consultation, status }, { dispatch }) => {
        const outcome = await toApi<ChangedConsultationStatus>(() =>
          unwrap(
            api.POST('/branch/consultations/{id}/status', {
              params: { path: { id: consultation.id } },
              body: { status },
            }),
          ).then((r) => r.data),
        );
        if ('data' in outcome)
          void dispatch(
            consultationsApi.util.upsertQueryData(
              'getAppointmentConsultation',
              consultation.appointmentId,
              outcome.data,
            ),
          );
        return outcome;
      },
      invalidatesTags: (_r, error) => (error ? [] : [LIST_TAG]),
    }),
    getConsultation: build.query<ConsultationDetail, string>({
      queryFn: (id) =>
        fromApi<ConsultationDetail>(() =>
          unwrap(api.GET('/branch/consultations/{id}', { params: { path: { id } } })).then((r) => r.data),
        ),
      providesTags: ['consultations'],
    }),
    getConsultationList: build.query<ConsultationListPage, Record<string, unknown>>({
      queryFn: (query) =>
        fromApi<ConsultationListPage>(() => unwrap(api.GET('/branch/consultations', { params: { query } }))),
      providesTags: ['consultations', LIST_TAG],
    }),
    getMrsHistory: build.query<MrsHistory, string>({
      queryFn: (patientId) =>
        fromApi<MrsHistory>(() =>
          unwrap(api.GET('/branch/patients/{id}/mrs-history', { params: { path: { id: patientId } } })).then(
            (r) => r.data,
          ),
        ),
      providesTags: (_r, _e, patientId) => [
        'consultations',
        { type: 'consultations', id: `mrs:${patientId}` },
      ],
    }),
    getReferralLetter: build.query<ReferralLetter, string>({
      queryFn: (consultationId) =>
        fromApi<ReferralLetter>(() =>
          unwrap(
            api.GET('/branch/consultations/{id}/referral-letter', {
              params: { path: { id: consultationId } },
            }),
          ).then((r) => r.data),
        ),
      providesTags: ['consultations'],
    }),
    getConsultationHistory: build.query<ConsultationHistoryResponse, string>({
      queryFn: (consultationId) =>
        fromApi<ConsultationHistoryResponse>(() =>
          unwrap(
            api.GET('/branch/consultations/{id}/history', { params: { path: { id: consultationId } } }),
          ).then((r) => r.data),
        ),
      providesTags: (_r, _e, consultationId) => [
        'consultations',
        { type: 'consultations', id: `history:${consultationId}` },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAppointmentConsultationQuery,
  useStartConsultationMutation,
  useSaveConsultationSectionMutation,
  useSetConsultationStatusMutation,
  useGetConsultationQuery,
  useGetConsultationListQuery,
  useGetMrsHistoryQuery,
  useGetReferralLetterQuery,
  useGetConsultationHistoryQuery,
} = consultationsApi;

export function useAppointmentConsultation(appointmentId: string) {
  return useGetAppointmentConsultationQuery(appointmentId, { skip: !appointmentId });
}

export function useConsultation(id: string | null | undefined) {
  return useGetConsultationQuery(id ?? '', { skip: !id });
}

export function useConsultationList(query: Record<string, unknown>, enabled = true) {
  return useGetConsultationListQuery(query, { skip: !enabled });
}

export function useMrsHistory(patientId: string) {
  return useGetMrsHistoryQuery(patientId, { skip: !patientId });
}

export function useReferralLetter(consultationId: string) {
  return useGetReferralLetterQuery(consultationId, { skip: !consultationId });
}

export function useConsultationHistory(consultationId: string) {
  return useGetConsultationHistoryQuery(consultationId);
}

export function readAppointmentConsultation(appointmentId: string) {
  return consultationsApi.endpoints.getAppointmentConsultation.select(appointmentId)(store.getState()).data;
}
