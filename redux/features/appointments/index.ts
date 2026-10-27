import { baseApi, fromApi, toApi } from '@redux/api/baseApi';
import { idempotencyHeaders } from '@/lib/api/idempotency';
import { createCrud } from '@redux/api/crud';
import type { TagType } from '@redux/api/tagTypes';
import { store } from '@redux/store';
import { api, jsonFormData, unwrap, uploadForm } from '@/lib/api/client';
import type {
  AddAppointmentRefundArg,
  AppointmentRefund,
  RemoveAppointmentRefundArg,
  AppointmentAttachmentUrl,
  AppointmentCalendar,
  AppointmentCalendarQuery,
  AppointmentDetail,
  AppointmentFileArg,
  AppointmentInput,
  AppointmentListPage,
  AppointmentMedicalRecordUrl,
  AppointmentPatientLink,
  AppointmentPayment,
  AppointmentPaymentProofUrl,
  AppointmentReceivingAccounts,
  AppointmentUpdate,
  BookAppointmentArg,
  ChangeAppointmentStatusArg,
  RemoveAppointmentAttachmentArg,
  RemoveAppointmentPaymentArg,
  SaveAppointmentPaymentArg,
} from './types';

export * from './types';

const DEPENDENTS: TagType[] = ['appointments', 'patients', 'consultations'];

export const appointmentsApi = createCrud<AppointmentDetail, AppointmentInput, AppointmentUpdate>(
  'appointments',
  '/branch/appointments',
  { invalidates: DEPENDENTS.slice(1) },
);

export const appointmentsQueryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAppointmentList: build.query<AppointmentListPage, Record<string, unknown>>({
      queryFn: (query) =>
        fromApi<AppointmentListPage>(() => unwrap(api.GET('/branch/appointments', { params: { query } }))),
      providesTags: ['appointments'],
    }),
    getAppointmentCalendar: build.query<AppointmentCalendar, AppointmentCalendarQuery>({
      queryFn: (query) =>
        fromApi<AppointmentCalendar>(() =>
          unwrap(api.GET('/branch/appointments/calendar', { params: { query } })).then((r) => r.data),
        ),
      providesTags: ['appointments'],
    }),
    bookAppointment: build.mutation<AppointmentDetail, BookAppointmentArg>({
      queryFn: ({ body, medicalRecordFiles, paymentProofs, idempotencyKey }) =>
        toApi<AppointmentDetail>(() =>
          uploadForm<AppointmentDetail>(
            '/branch/appointments',
            jsonFormData(body, { medicalRecordFiles, paymentProofs }),
            'POST',
            idempotencyHeaders(idempotencyKey),
          ),
        ),
      invalidatesTags: (_r, error) => (error ? [] : DEPENDENTS),
    }),
    changeAppointmentStatus: build.mutation<AppointmentDetail, ChangeAppointmentStatusArg>({
      queryFn: ({ id, status, remark, files }) =>
        toApi<AppointmentDetail>(() =>
          uploadForm<AppointmentDetail>(
            `/branch/appointments/${id}/status`,
            jsonFormData({ status, remark }, { files }),
          ),
        ),
      invalidatesTags: (_r, error) => (error ? [] : DEPENDENTS),
    }),
    saveAppointmentPayment: build.mutation<AppointmentPayment, SaveAppointmentPaymentArg>({
      queryFn: ({ appointmentId, paymentId, body, proof, idempotencyKey }) =>
        toApi<AppointmentPayment>(async () => {
          if (!paymentId)
            return uploadForm<AppointmentPayment>(
              `/branch/appointments/${appointmentId}/payments`,
              jsonFormData(body, { proof }),
              'POST',
              idempotencyHeaders(idempotencyKey),
            );
          const updated = await unwrap(
            api.PATCH('/branch/appointments/{id}/payments/{paymentId}', {
              params: { path: { id: appointmentId, paymentId } },
              body,
            }),
          );
          if (!proof) return updated.data as AppointmentPayment;
          const form = new FormData();
          form.append('proof', proof);
          return uploadForm<AppointmentPayment>(
            `/branch/appointments/${appointmentId}/payments/${paymentId}/proof`,
            form,
          );
        }),
      invalidatesTags: (_r, error) => (error ? [] : DEPENDENTS),
    }),
    removeAppointmentPayment: build.mutation<unknown, RemoveAppointmentPaymentArg>({
      queryFn: ({ appointmentId, paymentId }) =>
        toApi<unknown>(() =>
          unwrap(
            api.DELETE('/branch/appointments/{id}/payments/{paymentId}', {
              params: { path: { id: appointmentId, paymentId } },
            }),
          ),
        ),
      invalidatesTags: (_r, error) => (error ? [] : DEPENDENTS),
    }),
    addAppointmentRefund: build.mutation<AppointmentRefund, AddAppointmentRefundArg>({
      queryFn: ({ appointmentId, body, idempotencyKey }) =>
        toApi<AppointmentRefund>(() =>
          unwrap(
            api.POST('/branch/appointments/{id}/refunds', {
              params: { path: { id: appointmentId } },
              body,
              headers: idempotencyHeaders(idempotencyKey),
            }),
          ).then((r) => r.data as AppointmentRefund),
        ),
      invalidatesTags: (_r, error) => (error ? [] : [...DEPENDENTS, 'account-sheets', 'reports']),
    }),
    removeAppointmentRefund: build.mutation<unknown, RemoveAppointmentRefundArg>({
      queryFn: ({ appointmentId, refundId }) =>
        toApi<unknown>(() =>
          unwrap(
            api.DELETE('/branch/appointments/{id}/refunds/{refundId}', {
              params: { path: { id: appointmentId, refundId } },
            }),
          ),
        ),
      invalidatesTags: (_r, error) => (error ? [] : [...DEPENDENTS, 'account-sheets', 'reports']),
    }),
    removeAppointmentAttachment: build.mutation<unknown, RemoveAppointmentAttachmentArg>({
      queryFn: ({ appointmentId, attachmentId }) =>
        toApi<unknown>(() =>
          unwrap(
            api.DELETE('/branch/appointments/{id}/attachments/{attachmentId}', {
              params: { path: { id: appointmentId, attachmentId } },
            }),
          ),
        ),
      invalidatesTags: (_r, error) => (error ? [] : DEPENDENTS),
    }),
    getAppointmentAttachmentUrl: build.query<AppointmentAttachmentUrl, AppointmentFileArg>({
      queryFn: ({ id, fileId }) =>
        toApi<AppointmentAttachmentUrl>(() =>
          unwrap(
            api.GET('/branch/appointments/{id}/attachments/{attachmentId}/url', {
              params: { path: { id, attachmentId: fileId } },
            }),
          ).then((r) => r.data),
        ),
      providesTags: ['appointments'],
    }),
    getAppointmentMedicalRecordUrl: build.query<AppointmentMedicalRecordUrl, AppointmentFileArg>({
      queryFn: ({ id, fileId }) =>
        toApi<AppointmentMedicalRecordUrl>(() =>
          unwrap(
            api.GET('/branch/appointments/{id}/medical-records/files/{fileId}/url', {
              params: { path: { id, fileId } },
            }),
          ).then((r) => r.data),
        ),
      providesTags: ['appointments'],
    }),
    getAppointmentPaymentProofUrl: build.query<AppointmentPaymentProofUrl, AppointmentFileArg>({
      queryFn: ({ id, fileId }) =>
        toApi<AppointmentPaymentProofUrl>(() =>
          unwrap(
            api.GET('/branch/appointments/{id}/payments/{paymentId}/proof-url', {
              params: { path: { id, paymentId: fileId } },
            }),
          ).then((r) => r.data),
        ),
      providesTags: ['appointments'],
    }),
    getAppointmentPatientLink: build.query<AppointmentPatientLink, string>({
      queryFn: (appointmentId) =>
        toApi<AppointmentPatientLink>(() =>
          unwrap(
            api.GET('/branch/appointments/{id}/patient-link', { params: { path: { id: appointmentId } } }),
          ).then((r) => r.data),
        ),
      providesTags: ['appointments'],
    }),
    getAppointmentReceivingAccounts: build.query<AppointmentReceivingAccounts, void>({
      queryFn: () =>
        toApi<AppointmentReceivingAccounts>(() =>
          unwrap(api.GET('/branch/account-sheets/options')).then((r) => r.data),
        ),
      providesTags: ['account-sheets'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAppointmentListQuery,
  useGetAppointmentCalendarQuery,
  useBookAppointmentMutation,
  useChangeAppointmentStatusMutation,
  useSaveAppointmentPaymentMutation,
  useRemoveAppointmentPaymentMutation,
  useRemoveAppointmentAttachmentMutation,
  useGetAppointmentReceivingAccountsQuery,
  useAddAppointmentRefundMutation,
  useRemoveAppointmentRefundMutation,
} = appointmentsQueryApi;

export function useAppointmentList(query: Record<string, unknown>) {
  return useGetAppointmentListQuery(query);
}

export function useAppointmentCalendar(query: AppointmentCalendarQuery) {
  return useGetAppointmentCalendarQuery(query);
}

export function useReceivingAccounts(enabled = true) {
  return useGetAppointmentReceivingAccountsQuery(undefined, {
    skip: !enabled,
    refetchOnMountOrArgChange: 60,
  });
}

const once = { subscribe: false, forceRefetch: true } as const;

export const appointmentFiles = {
  attachment: (
    id: string,
    attachmentId: string,
  ): Promise<(typeof appointmentsQueryApi.endpoints.getAppointmentAttachmentUrl)['Types']['ResultType']> =>
    store
      .dispatch(
        appointmentsQueryApi.endpoints.getAppointmentAttachmentUrl.initiate(
          { id, fileId: attachmentId },
          once,
        ),
      )
      .unwrap(),
  medicalRecord: (
    id: string,
    fileId: string,
  ): Promise<(typeof appointmentsQueryApi.endpoints.getAppointmentMedicalRecordUrl)['Types']['ResultType']> =>
    store
      .dispatch(appointmentsQueryApi.endpoints.getAppointmentMedicalRecordUrl.initiate({ id, fileId }, once))
      .unwrap(),
  paymentProof: (
    id: string,
    paymentId: string,
  ): Promise<(typeof appointmentsQueryApi.endpoints.getAppointmentPaymentProofUrl)['Types']['ResultType']> =>
    store
      .dispatch(
        appointmentsQueryApi.endpoints.getAppointmentPaymentProofUrl.initiate(
          { id, fileId: paymentId },
          once,
        ),
      )
      .unwrap(),
};

export async function patientLink(appointmentId: string) {
  const data = await store
    .dispatch(appointmentsQueryApi.endpoints.getAppointmentPatientLink.initiate(appointmentId, once))
    .unwrap();
  return `${window.location.origin}/p/${data.token}`;
}
