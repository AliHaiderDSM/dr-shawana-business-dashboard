import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import { createCrud } from '@/lib/api/crud';
import type { Schemas } from '@/lib/api/types';

export type Patient = Schemas['Patient'];
export type PatientInput = Schemas['CreatePatient'];
export type PatientSummary = Schemas['PatientSummary'];
export type BhrtStatus = Patient['bhrtStatus'];
export interface PatientOption {
  id: string;
  name: string;
  phone: string;
  city: string;
}

export const BHRT_LABELS: Record<BhrtStatus, string> = {
  none: 'None',
  on: 'On BHRT',
  off: 'Off BHRT',
  recommended: 'Recommended',
};

export const patientsApi = createCrud<Patient, PatientInput, Schemas['UpdatePatient'], PatientOption>(
  'patients',
  '/branch/patients',
);

export function usePatientSearch(search: string, enabled = true) {
  const term = search.trim();
  return useQuery({
    queryKey: ['patients', 'search', term],
    queryFn: () =>
      unwrap(api.GET('/branch/patients/options', { params: { query: term ? { search: term } : {} } })).then(
        (r) => r.data,
      ),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled,
  });
}

export function usePhoneCheck(phone: string, excludeId?: string) {
  const digits = phone.replace(/\D/g, '');
  return useQuery({
    queryKey: ['patients', 'check-phone', digits, excludeId],
    queryFn: () =>
      unwrap(
        api.GET('/branch/patients/check-phone', {
          params: { query: { phone, ...(excludeId ? { excludeId } : {}) } },
        }),
      ).then((r) => r.data),
    enabled: digits.length >= 10,
    staleTime: 10_000,
  });
}

export function useCities(search: string) {
  const term = search.trim();
  return useQuery({
    queryKey: ['patients', 'cities', term],
    queryFn: () =>
      unwrap(api.GET('/branch/patients/cities', { params: { query: { search: term } } })).then((r) => r.data),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    enabled: term.length > 0,
  });
}

export function usePatientSummary(id: string) {
  return useQuery({
    queryKey: ['patients', 'summary', id],
    queryFn: () =>
      unwrap(api.GET('/branch/patients/{id}/summary', { params: { path: { id } } })).then(
        (r) => r.data as PatientSummary,
      ),
    enabled: Boolean(id),
  });
}

export async function patientRecordFileUrl(patientId: string, fileId: string) {
  const result = await unwrap(
    api.GET('/branch/patients/{id}/medical-records/files/{fileId}/url', {
      params: { path: { id: patientId, fileId } },
    }),
  );
  return result.data;
}
