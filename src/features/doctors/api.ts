import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap, uploadForm } from '@/lib/api/client';
import { createCrud } from '@/lib/api/crud';
import type { Schemas } from '@/lib/api/types';

export type Doctor = Schemas['Doctor'];
export type DoctorInput = Schemas['CreateDoctor'];
export interface DoctorOption {
  id: string;
  name: string;
  phone: string | null;
  consultationFee: string;
}

export const doctorsApi = createCrud<Doctor, DoctorInput, Schemas['UpdateDoctor'], DoctorOption>(
  'doctors',
  '/branch/doctors',
  { invalidates: ['staff'] },
);

export function useMyDoctorProfile(enabled: boolean) {
  return useQuery({
    queryKey: ['doctors', 'me'],
    queryFn: () => unwrap(api.GET('/branch/doctors/me')).then((r) => r.data),
    enabled,
    retry: false,
  });
}

export function useDoctorSlots(doctorId: string | null | undefined, date: string) {
  return useQuery({
    queryKey: ['appointments', 'slots', doctorId, date],
    queryFn: () =>
      unwrap(
        api.GET('/branch/doctors/{id}/slots', { params: { path: { id: doctorId ?? '' }, query: { date } } }),
      ).then((r) => r.data),
    enabled: Boolean(doctorId && date),
  });
}

export function useDoctorStaff(enabled: boolean) {
  return useQuery({
    queryKey: ['staff', 'doctors'],
    queryFn: () =>
      unwrap(api.GET('/branch/staff', { params: { query: { role: 'doctor', pageSize: 100 } } })).then(
        (r) => r.data,
      ),
    enabled,
  });
}

export function useUploadSignature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const form = new FormData();
      form.append('image', file);
      return uploadForm<Doctor>(`/branch/doctors/${id}/signature`, form);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doctors'] }),
  });
}

export async function doctorSignatureUrl(id: string) {
  return unwrap(api.GET('/branch/doctors/{id}/signature-url', { params: { path: { id } } })).then(
    (r) => r.data,
  );
}
