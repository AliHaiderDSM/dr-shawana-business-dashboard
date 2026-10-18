import type { PatientRequestCategory, PatientRequestStatus } from '@redux/features/patient-requests/types';

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
