import type { Appointment, AppointmentPayment, AppointmentStatus } from '@redux/features/appointments/types';

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  booked: 'Booked',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const MODE_LABELS: Record<Appointment['mode'], string> = { online: 'Online', physical: 'Physical' };
export const VISIT_LABELS: Record<Appointment['visitType'], string> = { new: 'New', followup: 'Follow up' };
export const METHOD_LABELS: Record<AppointmentPayment['method'], string> = { cash: 'Cash', online: 'Online' };

export function timeLabel(value: string) {
  const [hours = '0', minutes = '00'] = value.split(':');
  const h = Number(hours);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${minutes} ${suffix}`;
}

export function timeRange(from: string, to: string) {
  return `${timeLabel(from)} – ${timeLabel(to)}`;
}
