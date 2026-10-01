import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, unwrap } from '@/lib/api/client';
import type { Schemas } from '@/lib/api/types';

export type Consultation = Schemas['Consultation'];
export type SectionKey = Consultation['availableSections'][number];
export type SectionState = NonNullable<Consultation['sections'][SectionKey]>;
export type MrsScores = NonNullable<SectionState['scores']>;
export interface ConsultationSummary {
  id: string;
  status: Consultation['status'];
  appointmentId: string;
  appointment: Consultation['appointment'];
  patientId: string;
  patient: Consultation['patient'];
  doctorId: string;
  doctor: Consultation['doctor'];
  createdAt: string;
  updatedAt: string;
}

export const consultationKeys = {
  all: ['consultations'] as const,
  byAppointment: (appointmentId: string) => ['consultations', 'appointment', appointmentId] as const,
  list: (query: object) => ['consultations', 'list', query] as const,
  mrs: (patientId: string) => ['consultations', 'mrs', patientId] as const,
  referral: (id: string) => ['consultations', 'referral', id] as const,
};

export function useAppointmentConsultation(appointmentId: string) {
  return useQuery({
    queryKey: consultationKeys.byAppointment(appointmentId),
    queryFn: async () => {
      try {
        return await unwrap(
          api.GET('/branch/appointments/{id}/consultation', { params: { path: { id: appointmentId } } }),
        ).then((r) => r.data);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    enabled: Boolean(appointmentId),
  });
}

export function useStartConsultation(appointmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/branch/appointments/{id}/consultation', { params: { path: { id: appointmentId } } }),
      ).then((r) => r.data),
    onSuccess: (consultation) => {
      queryClient.setQueryData(consultationKeys.byAppointment(appointmentId), consultation);
      void queryClient.invalidateQueries({ queryKey: ['consultations', 'list'] });
    },
  });
}

export function useSaveSection(consultation: Pick<Consultation, 'id' | 'appointmentId' | 'patientId'>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, data }: { key: SectionKey; data: Record<string, unknown> }) =>
      unwrap(
        api.PUT('/branch/consultations/{id}/sections/{key}', {
          params: { path: { id: consultation.id, key } },
          body: data,
        }),
      ).then((r) => r.data),
    onSuccess: (result) => {
      queryClient.setQueryData<Consultation | null>(
        consultationKeys.byAppointment(consultation.appointmentId),
        (current) =>
          current
            ? {
                ...current,
                availableSections: result.availableSections,
                sections: { ...current.sections, [result.key]: result.section },
              }
            : current,
      );
      if (result.key === 'basic_info') void queryClient.invalidateQueries({ queryKey: ['patients'] });
      if (result.key === 'mrs_scale')
        void queryClient.invalidateQueries({ queryKey: consultationKeys.mrs(consultation.patientId) });
    },
  });
}

export function useConsultationStatus(consultation: Pick<Consultation, 'id' | 'appointmentId'>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: Consultation['status']) =>
      unwrap(
        api.POST('/branch/consultations/{id}/status', {
          params: { path: { id: consultation.id } },
          body: { status },
        }),
      ).then((r) => r.data),
    onSuccess: (updated) => {
      queryClient.setQueryData(consultationKeys.byAppointment(consultation.appointmentId), updated);
      void queryClient.invalidateQueries({ queryKey: ['consultations', 'list'] });
    },
  });
}

export function useConsultation(id: string | null | undefined) {
  return useQuery({
    queryKey: ['consultations', 'detail', id],
    queryFn: () =>
      unwrap(api.GET('/branch/consultations/{id}', { params: { path: { id: id ?? '' } } })).then(
        (r) => r.data,
      ),
    enabled: Boolean(id),
  });
}

export function useConsultationList(query: Record<string, unknown>, enabled = true) {
  return useQuery({
    queryKey: consultationKeys.list(query),
    queryFn: () => unwrap(api.GET('/branch/consultations', { params: { query } })),
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useMrsHistory(patientId: string) {
  return useQuery({
    queryKey: consultationKeys.mrs(patientId),
    queryFn: () =>
      unwrap(api.GET('/branch/patients/{id}/mrs-history', { params: { path: { id: patientId } } })).then(
        (r) => r.data,
      ),
    enabled: Boolean(patientId),
  });
}

export function useReferralLetter(consultationId: string) {
  return useQuery({
    queryKey: consultationKeys.referral(consultationId),
    queryFn: () =>
      unwrap(
        api.GET('/branch/consultations/{id}/referral-letter', { params: { path: { id: consultationId } } }),
      ).then((r) => r.data),
    enabled: Boolean(consultationId),
  });
}
