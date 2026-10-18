import { baseApi, fromApi, toApi } from '@redux/api/baseApi';
import { store } from '@redux/store';
import { api, jsonFormData, unwrap, uploadForm } from '@/lib/api/client';
import type {
  AddBhrtArg,
  AddBloodWorkArg,
  AddMedicalRecordFilesArg,
  BhrtLog,
  BloodWorkResponse,
  CreateMedicalRecordArg,
  MedicalRecord,
  MedicalRecordList,
  MedicalRecordsArg,
  MedicalRecordType,
  PatientTimeline,
  ReadBloodReport,
  ReadBloodReportArg,
  RemoveBloodWorkArg,
  RemoveMedicalRecordArg,
  RemoveMedicalRecordFileArg,
  RemoveReportSummaryArg,
  ReportSummaries,
  ReportSummaryFileArg,
  ReportSummaryFileUrl,
  UpdateBloodWorkArg,
} from './types';

export * from './types';

const patientTags = (patientId: string) => [
  'clinical' as const,
  { type: 'patients' as const, id: `summary:${patientId}` },
  { type: 'patients' as const, id: `detail:${patientId}` },
];

const summariesTag = (patientId: string) => ({
  type: 'clinical' as const,
  id: `report-summaries:${patientId}`,
});

export const clinicalApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getBloodWork: build.query<BloodWorkResponse, string>({
      queryFn: (patientId) =>
        fromApi<BloodWorkResponse>(() =>
          unwrap(api.GET('/branch/patients/{id}/blood-work', { params: { path: { id: patientId } } })).then(
            (r) => r.data,
          ),
        ),
      providesTags: ['clinical'],
    }),
    addBloodWork: build.mutation<unknown, AddBloodWorkArg>({
      queryFn: ({ patientId, body }) =>
        toApi<unknown>(() =>
          unwrap(api.POST('/branch/patients/{id}/blood-work', { params: { path: { id: patientId } }, body })),
        ),
      invalidatesTags: (_r, error, { patientId }) => (error ? [] : patientTags(patientId)),
    }),
    updateBloodWork: build.mutation<unknown, UpdateBloodWorkArg>({
      queryFn: ({ patientId, resultId, body }) =>
        toApi<unknown>(() =>
          unwrap(
            api.PATCH('/branch/patients/{id}/blood-work/{resultId}', {
              params: { path: { id: patientId, resultId } },
              body,
            }),
          ),
        ),
      invalidatesTags: (_r, error, { patientId }) => (error ? [] : patientTags(patientId)),
    }),
    removeBloodWork: build.mutation<unknown, RemoveBloodWorkArg>({
      queryFn: ({ patientId, resultId }) =>
        toApi<unknown>(() =>
          unwrap(
            api.DELETE('/branch/patients/{id}/blood-work/{resultId}', {
              params: { path: { id: patientId, resultId } },
            }),
          ),
        ),
      invalidatesTags: (_r, error, { patientId }) => (error ? [] : patientTags(patientId)),
    }),
    getBhrtLog: build.query<BhrtLog, string>({
      queryFn: (patientId) =>
        fromApi<BhrtLog>(() =>
          unwrap(api.GET('/branch/patients/{id}/bhrt', { params: { path: { id: patientId } } })).then(
            (r) => r.data,
          ),
        ),
      providesTags: ['clinical'],
    }),
    addBhrt: build.mutation<unknown, AddBhrtArg>({
      queryFn: ({ patientId, body }) =>
        toApi<unknown>(() =>
          unwrap(api.POST('/branch/patients/{id}/bhrt', { params: { path: { id: patientId } }, body })),
        ),
      invalidatesTags: (_r, error, { patientId }) =>
        error ? [] : [...patientTags(patientId), 'patients', 'consultations', 'appointments'],
    }),
    getMedicalRecords: build.query<MedicalRecordList, MedicalRecordsArg>({
      queryFn: ({ patientId, type }) =>
        fromApi<MedicalRecordList>(() =>
          unwrap(
            api.GET('/branch/patients/{id}/medical-records', {
              params: { path: { id: patientId }, query: type ? { type } : {} },
            }),
          ).then((r) => r.data),
        ),
      providesTags: ['clinical'],
    }),
    createMedicalRecord: build.mutation<MedicalRecord, CreateMedicalRecordArg>({
      queryFn: ({ patientId, body, files }) =>
        toApi<MedicalRecord>(() =>
          uploadForm<MedicalRecord>(
            `/branch/patients/${patientId}/medical-records`,
            jsonFormData(body, { files }),
          ),
        ),
      invalidatesTags: (_r, error, { patientId }) => (error ? [] : patientTags(patientId)),
    }),
    removeMedicalRecord: build.mutation<unknown, RemoveMedicalRecordArg>({
      queryFn: ({ patientId, recordId }) =>
        toApi<unknown>(() =>
          unwrap(
            api.DELETE('/branch/patients/{id}/medical-records/{recordId}', {
              params: { path: { id: patientId, recordId } },
            }),
          ),
        ),
      invalidatesTags: (_r, error, { patientId }) => (error ? [] : patientTags(patientId)),
    }),
    addMedicalRecordFiles: build.mutation<MedicalRecord, AddMedicalRecordFilesArg>({
      queryFn: ({ patientId, recordId, files }) =>
        toApi<MedicalRecord>(() => {
          const form = new FormData();
          for (const file of files) form.append('files', file);
          return uploadForm<MedicalRecord>(
            `/branch/patients/${patientId}/medical-records/${recordId}/files`,
            form,
          );
        }),
      invalidatesTags: (_r, error, { patientId }) => (error ? [] : patientTags(patientId)),
    }),
    removeMedicalRecordFile: build.mutation<unknown, RemoveMedicalRecordFileArg>({
      queryFn: ({ patientId, recordId, fileId }) =>
        toApi<unknown>(() =>
          unwrap(
            api.DELETE('/branch/patients/{id}/medical-records/{recordId}/files/{fileId}', {
              params: { path: { id: patientId, recordId, fileId } },
            }),
          ),
        ),
      invalidatesTags: (_r, error, { patientId }) => (error ? [] : patientTags(patientId)),
    }),
    getPatientTimeline: build.query<PatientTimeline, string>({
      queryFn: (patientId) =>
        fromApi<PatientTimeline>(() =>
          unwrap(api.GET('/branch/patients/{id}/timeline', { params: { path: { id: patientId } } })).then(
            (r) => r.data as unknown as PatientTimeline,
          ),
        ),
      providesTags: ['clinical'],
    }),
    readBloodReport: build.mutation<ReadBloodReport, ReadBloodReportArg>({
      queryFn: ({ patientId, files, recordFileIds }) =>
        toApi<ReadBloodReport>(() => {
          const form = new FormData();
          for (const id of recordFileIds) form.append('recordFileIds', id);
          for (const file of files) form.append('files', file);
          return uploadForm<ReadBloodReport>(`/branch/patients/${patientId}/blood-work/read-report`, form);
        }),
      invalidatesTags: (_r, error, { patientId }) => (error ? [] : [summariesTag(patientId)]),
    }),
    getReportSummaries: build.query<ReportSummaries, string>({
      queryFn: (patientId) =>
        fromApi<ReportSummaries>(() =>
          unwrap(
            api.GET('/branch/patients/{id}/report-summaries', { params: { path: { id: patientId } } }),
          ).then((r) => r.data),
        ),
      providesTags: (_r, _e, patientId) => ['clinical', summariesTag(patientId)],
    }),
    getReportSummaryFileUrl: build.query<ReportSummaryFileUrl, ReportSummaryFileArg>({
      queryFn: ({ patientId, summaryId, index }) =>
        toApi<ReportSummaryFileUrl>(() =>
          unwrap(
            api.GET('/branch/patients/{id}/report-summaries/{summaryId}/files/{index}/url', {
              params: { path: { id: patientId, summaryId, index } },
            }),
          ).then((r) => r.data),
        ),
      providesTags: ['clinical'],
    }),
    removeReportSummary: build.mutation<unknown, RemoveReportSummaryArg>({
      queryFn: ({ patientId, summaryId }) =>
        toApi<unknown>(() =>
          unwrap(
            api.DELETE('/branch/patients/{id}/report-summaries/{summaryId}', {
              params: { path: { id: patientId, summaryId } },
            }),
          ),
        ),
      invalidatesTags: (_r, error, { patientId }) => (error ? [] : [summariesTag(patientId)]),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetBloodWorkQuery,
  useAddBloodWorkMutation,
  useUpdateBloodWorkMutation,
  useRemoveBloodWorkMutation,
  useGetBhrtLogQuery,
  useAddBhrtMutation,
  useGetMedicalRecordsQuery,
  useCreateMedicalRecordMutation,
  useRemoveMedicalRecordMutation,
  useAddMedicalRecordFilesMutation,
  useRemoveMedicalRecordFileMutation,
  useGetPatientTimelineQuery,
  useReadBloodReportMutation,
  useGetReportSummariesQuery,
  useRemoveReportSummaryMutation,
} = clinicalApi;

export function useBloodWork(patientId: string) {
  return useGetBloodWorkQuery(patientId, { skip: !patientId });
}

export function useBhrtLog(patientId: string) {
  return useGetBhrtLogQuery(patientId, { skip: !patientId });
}

export function useMedicalRecords(patientId: string, type?: MedicalRecordType) {
  return useGetMedicalRecordsQuery({ patientId, type }, { skip: !patientId });
}

export function usePatientTimeline(patientId: string) {
  return useGetPatientTimelineQuery(patientId, { skip: !patientId });
}

export function useReportSummaries(patientId: string) {
  return useGetReportSummariesQuery(patientId, { skip: !patientId });
}

export async function reportSummaryFileUrl(
  patientId: string,
  summaryId: string,
  index: number,
): Promise<(typeof clinicalApi.endpoints.getReportSummaryFileUrl)['Types']['ResultType']> {
  return store
    .dispatch(
      clinicalApi.endpoints.getReportSummaryFileUrl.initiate(
        { patientId, summaryId, index },
        { subscribe: false, forceRefetch: true },
      ),
    )
    .unwrap();
}
