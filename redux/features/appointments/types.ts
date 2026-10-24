import type { Schemas } from '@/lib/api/types';
import type { ClinicGetResponse } from '@redux/features/patients/types';

export type Appointment = Schemas['Appointment'];
export type AppointmentDetail = Schemas['AppointmentDetail'];
export type AppointmentInput = Schemas['CreateAppointment'];
export type AppointmentUpdate = Schemas['UpdateAppointment'];
export type AppointmentPayment = Schemas['AppointmentPayment'];
export type PaymentInput = Schemas['AppointmentPaymentInput'];
export type CalendarEntry = Schemas['CalendarEntry'];
export type AppointmentStatus = Appointment['status'];

export type AppointmentListPage = ClinicGetResponse<'/branch/appointments'>;
export type AppointmentCalendar = ClinicGetResponse<'/branch/appointments/calendar'>['data'];
export type AppointmentAttachmentUrl =
  ClinicGetResponse<'/branch/appointments/{id}/attachments/{attachmentId}/url'>['data'];
export type AppointmentMedicalRecordUrl =
  ClinicGetResponse<'/branch/appointments/{id}/medical-records/files/{fileId}/url'>['data'];
export type AppointmentPaymentProofUrl =
  ClinicGetResponse<'/branch/appointments/{id}/payments/{paymentId}/proof-url'>['data'];
export type AppointmentPatientLink = ClinicGetResponse<'/branch/appointments/{id}/patient-link'>['data'];
export type AppointmentReceivingAccounts = ClinicGetResponse<'/branch/account-sheets/options'>['data'];

export interface AppointmentCalendarQuery {
  from: string;
  to: string;
  doctorId?: string;
  status?: AppointmentStatus;
}

export interface BookAppointmentArg {
  body: AppointmentInput;
  medicalRecordFiles: File[];
  paymentProofs: File[];
  idempotencyKey?: string;
}

export interface ChangeAppointmentStatusArg {
  id: string;
  status: AppointmentStatus;
  remark: string | null;
  files: File[];
}

export interface SaveAppointmentPaymentArg {
  appointmentId: string;
  paymentId?: string;
  body: Omit<PaymentInput, 'proofIndex'>;
  proof: File | null;
  idempotencyKey?: string;
}

export interface RemoveAppointmentPaymentArg {
  appointmentId: string;
  paymentId: string;
}

export interface RemoveAppointmentAttachmentArg {
  appointmentId: string;
  attachmentId: string;
}

export interface AppointmentFileArg {
  id: string;
  fileId: string;
}
