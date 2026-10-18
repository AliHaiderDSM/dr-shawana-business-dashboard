import { store } from '@redux/store';
import { baseApi, toApi } from '@redux/api/baseApi';
import { ApiError } from '@/lib/api/client';
import { env } from '@/lib/env';
import type {
  PublicPatientHistory,
  SavePublicIntakeSectionArg,
  UploadPublicMedicalRecordsArg,
} from './types';

export * from './types';

async function publicGet<T>(path: string): Promise<T> {
  const response = await fetch(`${env.VITE_API_BASE_URL}${path}`);
  const body = (await response.json().catch(() => null)) as {
    data?: T;
    error?: { code?: string; message?: string };
  } | null;
  if (!response.ok || !body?.data)
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'NOT_FOUND',
      body?.error?.message ?? 'This link is invalid or has expired',
    );
  return body.data;
}

async function send<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${env.VITE_API_BASE_URL}${path}`, init);
  const body = (await response.json().catch(() => null)) as {
    data?: T;
    error?: { code?: string; message?: string; details?: unknown };
  } | null;
  if (!response.ok || !body?.data)
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'ERROR',
      body?.error?.message ?? 'Something went wrong',
      body?.error?.details,
    );
  return body.data;
}

export const publicApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPublicPatientHistory: build.query<PublicPatientHistory, string>({
      queryFn: (token) =>
        toApi<PublicPatientHistory>(() =>
          publicGet<PublicPatientHistory>(`/public/patient-history/${encodeURIComponent(token)}`),
        ),
      providesTags: ['public-history'],
    }),
    getPublicPatientFileUrl: build.query<{ url: string }, { token: string; fileId: string }>({
      queryFn: ({ token, fileId }) =>
        toApi<{ url: string }>(() =>
          publicGet<{ url: string }>(`/public/patient-history/${token}/files/${fileId}`),
        ),
    }),
    savePublicIntakeSection: build.mutation<unknown, SavePublicIntakeSectionArg>({
      queryFn: ({ token, key, data }) =>
        toApi<unknown>(() =>
          send(`/public/patient-history/${encodeURIComponent(token)}/sections/${key}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          }),
        ),
    }),
    uploadPublicMedicalRecords: build.mutation<unknown, UploadPublicMedicalRecordsArg>({
      queryFn: ({ token, type, note, files }) =>
        toApi<unknown>(() => {
          const body = new FormData();
          body.append('data', JSON.stringify({ type, note: note.trim() || null }));
          for (const file of files) body.append('files', file);
          return send(`/public/patient-history/${encodeURIComponent(token)}/medical-records`, {
            method: 'POST',
            body,
          });
        }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetPublicPatientHistoryQuery,
  useSavePublicIntakeSectionMutation,
  useUploadPublicMedicalRecordsMutation,
} = publicApi;

export function publicPatientFileUrl(token: string, fileId: string): Promise<{ url: string }> {
  return store
    .dispatch(
      publicApi.endpoints.getPublicPatientFileUrl.initiate(
        { token, fileId },
        { subscribe: false, forceRefetch: true },
      ),
    )
    .unwrap();
}

export function usePublicPatientHistory(token: string) {
  return useGetPublicPatientHistoryQuery(token);
}
