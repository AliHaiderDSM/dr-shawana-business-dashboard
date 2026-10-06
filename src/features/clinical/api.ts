import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, jsonFormData, unwrap, uploadForm } from '@/lib/api/client';
import type { Schemas } from '@/lib/api/types';
import type { Patient } from '@/features/patients/api';
import type { Prescription } from '@/features/prescriptions/api';
import type { ConsultationSummary, SectionKey, SectionState } from '@/features/consultations/api';

export type BloodWorkResult = Schemas['BloodWork']['results'][number];
export type BloodTest = BloodWorkResult['test'];
export type BhrtEntry = Schemas['BhrtStatusEntry'];
export type MedicalRecord = Schemas['MedicalRecord'];
export type MedicalRecordType = MedicalRecord['type'];

export const BLOOD_TESTS: { test: BloodTest; label: string; unit: string }[] = [
  { test: 'fsh', label: 'FSH', unit: 'mIU/mL' },
  { test: 'estradiol', label: 'Estradiol', unit: 'pg/mL' },
  { test: 'testosterone_free', label: 'Testosterone (Free)', unit: 'pg/mL' },
  { test: 'testosterone_total', label: 'Testosterone (Total)', unit: 'ng/dL' },
  { test: 'dhea_s', label: 'DHEA-Sulphate', unit: 'µg/dL' },
  { test: 'vit_d3', label: 'Vit D3', unit: 'µg/dL' },
  { test: 'tsh', label: 'TSH', unit: 'µIU/mL' },
  { test: 'ferritin', label: 'Ferritin', unit: 'ng/mL' },
  { test: 'b12', label: 'B12', unit: 'pg/mL' },
];

export const BLOOD_TEST_LABELS = Object.fromEntries(BLOOD_TESTS.map((t) => [t.test, t.label])) as Record<
  BloodTest,
  string
>;

export const BHRT_STATUS_LABELS: Record<BhrtEntry['status'], string> = {
  on: 'On',
  off: 'Off',
  recommended: 'Recommended',
  other: 'Other',
};

export const RECORD_TYPE_LABELS: Record<MedicalRecordType, string> = {
  medical_record: 'Medical record',
  imaging: 'Imaging',
};

const keys = {
  blood: (patientId: string) => ['clinical', 'blood-work', patientId] as const,
  bhrt: (patientId: string) => ['clinical', 'bhrt', patientId] as const,
  records: (patientId: string) => ['clinical', 'records', patientId] as const,
  timeline: (patientId: string) => ['clinical', 'timeline', patientId] as const,
};

function useInvalidatePatient(patientId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['clinical'] }),
      queryClient.invalidateQueries({ queryKey: ['patients', 'summary', patientId] }),
      queryClient.invalidateQueries({ queryKey: ['patients', 'detail', patientId] }),
    ]);
}

export function useBloodWork(patientId: string) {
  return useQuery({
    queryKey: keys.blood(patientId),
    queryFn: () =>
      unwrap(api.GET('/branch/patients/{id}/blood-work', { params: { path: { id: patientId } } })).then(
        (r) => r.data,
      ),
    enabled: Boolean(patientId),
  });
}

export function useAddBloodWork(patientId: string) {
  const invalidate = useInvalidatePatient(patientId);
  return useMutation({
    mutationFn: (body: Schemas['AddBloodWork']) =>
      unwrap(api.POST('/branch/patients/{id}/blood-work', { params: { path: { id: patientId } }, body })),
    onSuccess: invalidate,
  });
}

export function useUpdateBloodWork(patientId: string) {
  const invalidate = useInvalidatePatient(patientId);
  return useMutation({
    mutationFn: ({ resultId, body }: { resultId: string; body: Schemas['UpdateBloodWork'] }) =>
      unwrap(
        api.PATCH('/branch/patients/{id}/blood-work/{resultId}', {
          params: { path: { id: patientId, resultId } },
          body,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useRemoveBloodWork(patientId: string) {
  const invalidate = useInvalidatePatient(patientId);
  return useMutation({
    mutationFn: (resultId: string) =>
      unwrap(
        api.DELETE('/branch/patients/{id}/blood-work/{resultId}', {
          params: { path: { id: patientId, resultId } },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useBhrtLog(patientId: string) {
  return useQuery({
    queryKey: keys.bhrt(patientId),
    queryFn: () =>
      unwrap(api.GET('/branch/patients/{id}/bhrt', { params: { path: { id: patientId } } })).then(
        (r) => r.data,
      ),
    enabled: Boolean(patientId),
  });
}

export function useAddBhrt(patientId: string) {
  const invalidate = useInvalidatePatient(patientId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas['AddBhrtStatus']) =>
      unwrap(api.POST('/branch/patients/{id}/bhrt', { params: { path: { id: patientId } }, body })),
    onSuccess: async () => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ['patients'] });
      await queryClient.invalidateQueries({ queryKey: ['consultations'] });
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useMedicalRecords(patientId: string, type?: MedicalRecordType) {
  return useQuery({
    queryKey: [...keys.records(patientId), type ?? 'all'],
    queryFn: () =>
      unwrap(
        api.GET('/branch/patients/{id}/medical-records', {
          params: { path: { id: patientId }, query: type ? { type } : {} },
        }),
      ).then((r) => r.data),
    enabled: Boolean(patientId),
  });
}

export function useCreateMedicalRecord(patientId: string) {
  const invalidate = useInvalidatePatient(patientId);
  return useMutation({
    mutationFn: ({ body, files }: { body: Schemas['CreateMedicalRecord']; files: File[] }) =>
      uploadForm<MedicalRecord>(
        `/branch/patients/${patientId}/medical-records`,
        jsonFormData(body, { files }),
      ),
    onSuccess: invalidate,
  });
}

export function useRemoveMedicalRecord(patientId: string) {
  const invalidate = useInvalidatePatient(patientId);
  return useMutation({
    mutationFn: (recordId: string) =>
      unwrap(
        api.DELETE('/branch/patients/{id}/medical-records/{recordId}', {
          params: { path: { id: patientId, recordId } },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useAddRecordFiles(patientId: string) {
  const invalidate = useInvalidatePatient(patientId);
  return useMutation({
    mutationFn: ({ recordId, files }: { recordId: string; files: File[] }) => {
      const form = new FormData();
      for (const file of files) form.append('files', file);
      return uploadForm<MedicalRecord>(
        `/branch/patients/${patientId}/medical-records/${recordId}/files`,
        form,
      );
    },
    onSuccess: invalidate,
  });
}

export function useRemoveRecordFile(patientId: string) {
  const invalidate = useInvalidatePatient(patientId);
  return useMutation({
    mutationFn: ({ recordId, fileId }: { recordId: string; fileId: string }) =>
      unwrap(
        api.DELETE('/branch/patients/{id}/medical-records/{recordId}/files/{fileId}', {
          params: { path: { id: patientId, recordId, fileId } },
        }),
      ),
    onSuccess: invalidate,
  });
}

export interface TimelineConsultation extends ConsultationSummary {
  sections: Partial<Record<SectionKey, SectionState | null>>;
}

export interface PatientTimeline {
  patient: Patient;
  scope: 'branch' | 'all_branches';
  consultations: TimelineConsultation[];
  prescriptions: Prescription[];
  bloodWork: (BloodWorkResult & { branchId: string })[];
  bhrt: (BhrtEntry & { branchId: string })[];
  medicalRecords: (MedicalRecord & { branchId: string })[];
}

export function usePatientTimeline(patientId: string) {
  return useQuery({
    queryKey: keys.timeline(patientId),
    queryFn: () =>
      unwrap(api.GET('/branch/patients/{id}/timeline', { params: { path: { id: patientId } } })).then(
        (r) => r.data as unknown as PatientTimeline,
      ),
    enabled: Boolean(patientId),
  });
}
