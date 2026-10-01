import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, jsonFormData, unwrap, uploadForm } from '@/lib/api/client';
import { createCrud } from '@/lib/api/crud';
import type { Schemas } from '@/lib/api/types';

export type Appointment = Schemas['Appointment'];
export type AppointmentDetail = Schemas['AppointmentDetail'];
export type AppointmentInput = Schemas['CreateAppointment'];
export type AppointmentUpdate = Schemas['UpdateAppointment'];
export type AppointmentPayment = Schemas['AppointmentPayment'];
export type PaymentInput = Schemas['AppointmentPaymentInput'];
export type CalendarEntry = Schemas['CalendarEntry'];
export type AppointmentStatus = Appointment['status'];

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  booked: 'Booked',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const MODE_LABELS: Record<Appointment['mode'], string> = { online: 'Online', physical: 'Physical' };
export const VISIT_LABELS: Record<Appointment['visitType'], string> = { new: 'New', followup: 'Follow up' };
export const METHOD_LABELS: Record<AppointmentPayment['method'], string> = { cash: 'Cash', online: 'Online' };

const DEPENDENTS = ['appointments', 'patients', 'consultations'];

export const appointmentsApi = createCrud<AppointmentDetail, AppointmentInput, AppointmentUpdate>(
  'appointments',
  '/branch/appointments',
  { invalidates: DEPENDENTS.slice(1) },
);

function useInvalidateAppointments() {
  const queryClient = useQueryClient();
  return () => Promise.all(DEPENDENTS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}

export function useAppointmentList(query: Record<string, unknown>) {
  return useQuery({
    queryKey: ['appointments', 'list', query],
    queryFn: () => unwrap(api.GET('/branch/appointments', { params: { query } })),
    placeholderData: (previous) => previous,
  });
}

export function useAppointmentCalendar(query: {
  from: string;
  to: string;
  doctorId?: string;
  status?: AppointmentStatus;
}) {
  return useQuery({
    queryKey: ['appointments', 'calendar', query],
    queryFn: () =>
      unwrap(api.GET('/branch/appointments/calendar', { params: { query } })).then((r) => r.data),
    placeholderData: (previous) => previous,
  });
}

export function useBookAppointment() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: ({
      body,
      medicalRecordFiles,
      paymentProofs,
    }: {
      body: AppointmentInput;
      medicalRecordFiles: File[];
      paymentProofs: File[];
    }) =>
      uploadForm<AppointmentDetail>(
        '/branch/appointments',
        jsonFormData(body, { medicalRecordFiles, paymentProofs }),
      ),
    onSuccess: invalidate,
  });
}

export function useChangeAppointmentStatus(id: string) {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: ({
      status,
      remark,
      files,
    }: {
      status: AppointmentStatus;
      remark: string | null;
      files: File[];
    }) =>
      uploadForm<AppointmentDetail>(
        `/branch/appointments/${id}/status`,
        jsonFormData({ status, remark }, { files }),
      ),
    onSuccess: invalidate,
  });
}

export function useSavePayment(appointmentId: string) {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: async ({
      paymentId,
      body,
      proof,
    }: {
      paymentId?: string;
      body: Omit<PaymentInput, 'proofIndex'>;
      proof: File | null;
    }) => {
      if (!paymentId)
        return uploadForm<AppointmentPayment>(
          `/branch/appointments/${appointmentId}/payments`,
          jsonFormData(body, { proof }),
        );
      const updated = await unwrap(
        api.PATCH('/branch/appointments/{id}/payments/{paymentId}', {
          params: { path: { id: appointmentId, paymentId } },
          body,
        }),
      );
      if (!proof) return updated.data;
      const form = new FormData();
      form.append('proof', proof);
      return uploadForm<AppointmentPayment>(
        `/branch/appointments/${appointmentId}/payments/${paymentId}/proof`,
        form,
      );
    },
    onSuccess: invalidate,
  });
}

export function useRemovePayment(appointmentId: string) {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: (paymentId: string) =>
      unwrap(
        api.DELETE('/branch/appointments/{id}/payments/{paymentId}', {
          params: { path: { id: appointmentId, paymentId } },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useRemoveAppointmentAttachment(appointmentId: string) {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      unwrap(
        api.DELETE('/branch/appointments/{id}/attachments/{attachmentId}', {
          params: { path: { id: appointmentId, attachmentId } },
        }),
      ),
    onSuccess: invalidate,
  });
}

export const appointmentFiles = {
  attachment: (id: string, attachmentId: string) =>
    unwrap(
      api.GET('/branch/appointments/{id}/attachments/{attachmentId}/url', {
        params: { path: { id, attachmentId } },
      }),
    ).then((r) => r.data),
  medicalRecord: (id: string, fileId: string) =>
    unwrap(
      api.GET('/branch/appointments/{id}/medical-records/files/{fileId}/url', {
        params: { path: { id, fileId } },
      }),
    ).then((r) => r.data),
  paymentProof: (id: string, paymentId: string) =>
    unwrap(
      api.GET('/branch/appointments/{id}/payments/{paymentId}/proof-url', {
        params: { path: { id, paymentId } },
      }),
    ).then((r) => r.data),
};

export function timeLabel(value: string) {
  const [hours = '0', minutes = '00'] = value.split(':');
  const h = Number(hours);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${minutes} ${suffix}`;
}

export function timeRange(from: string, to: string) {
  return `${timeLabel(from)} – ${timeLabel(to)}`;
}
