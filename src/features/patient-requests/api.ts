import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { Schemas } from '@/lib/api/types';

export type PatientRequest = Schemas['PatientRequest'];
export type PatientRequestStatus = PatientRequest['status'];
export type PatientRequestCategory = PatientRequest['category'];
export type AppAccess = Schemas['PatientAppAccess'];

export const REQUEST_STATUS_LABELS: Record<PatientRequestStatus, string> = {
  submitted: 'Submitted',
  in_review: 'In review',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const REQUEST_CATEGORY_LABELS: Record<PatientRequestCategory, string> = {
  appointment: 'Appointment',
  prescription: 'Prescription',
  medicine_order: 'Medicine / order',
  billing: 'Billing / payment',
  profile_correction: 'Profile correction',
  general: 'General inquiry',
  other: 'Other',
};

const KEY = 'patient-requests';

export function usePatientRequests(status: PatientRequestStatus | 'open' | 'all') {
  return useQuery({
    queryKey: [KEY, 'list', status],
    queryFn: () =>
      unwrap(
        api.GET('/branch/patient-requests', {
          params: { query: status === 'all' ? {} : { status } },
        }),
      ).then((r) => r.data),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

export function usePatientRequest(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'one', id],
    queryFn: () =>
      unwrap(api.GET('/branch/patient-requests/{id}', { params: { path: { id: id! } } })).then((r) => r.data),
    enabled: Boolean(id),
  });
}

export function useUpdatePatientRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Schemas['UpdatePatientRequest'] }) =>
      unwrap(api.PATCH('/branch/patient-requests/{id}', { params: { path: { id } }, body })).then(
        (r) => r.data,
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [KEY] }),
        queryClient.invalidateQueries({ queryKey: ['sidebar-badges'] }),
      ]),
  });
}

export function useAppAccess(patientId: string, enabled = true) {
  return useQuery({
    queryKey: ['patient-app-access', patientId],
    queryFn: () =>
      unwrap(api.GET('/branch/patients/{id}/app-access', { params: { path: { id: patientId } } })).then(
        (r) => r.data,
      ),
    enabled: enabled && Boolean(patientId),
  });
}

export function useIssueAppCode(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrap(api.POST('/branch/patients/{id}/app-access/code', { params: { path: { id: patientId } } })).then(
        (r) => r.data,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patient-app-access', patientId] }),
  });
}

export function useDisableAppAccess(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/branch/patients/{id}/app-access/disable', { params: { path: { id: patientId } } }),
      ).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patient-app-access', patientId] }),
  });
}
