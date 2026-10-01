import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import { createCrud } from '@/lib/api/crud';
import type { Schemas } from '@/lib/api/types';

export type Prescription = Schemas['Prescription'];
export type PrescriptionInput = Schemas['CreatePrescription'];
export type PrescriptionItem = Prescription['items'][number];
export type CatalogItem = Schemas['PrescriptionCatalogItem'];
export type CatalogCategory = CatalogItem['category'];
export type PrescriptionPrintData = Schemas['PrescriptionPrint'];

export const CATEGORY_LABELS: Record<CatalogCategory, string> = {
  lab: 'Blood work',
  imaging: 'Imaging',
  genetic: 'Genetic screening',
  supplement: 'Supplements',
  medicine: 'Medicines',
  glp: 'GLP',
  skin_care: 'Skin care',
  hair_care: 'Hair care',
  bhrt: 'Treatments (BHRT)',
  symptom: 'Symptoms',
};

export const BUILDER_SECTIONS: {
  key: string;
  title: string;
  categories: CatalogCategory[];
  note?: NoteKey;
}[] = [
  { key: 'labs', title: 'Blood work', categories: ['lab'], note: 'blood' },
  { key: 'imaging', title: 'Imaging', categories: ['imaging', 'genetic'], note: 'imaging' },
  {
    key: 'supplements',
    title: 'Supplements & medicines',
    categories: ['supplement', 'medicine', 'glp'],
    note: 'supplements',
  },
  { key: 'skin', title: 'Skin care', categories: ['skin_care'], note: 'skinCare' },
  { key: 'hair', title: 'Hair care', categories: ['hair_care'], note: 'hairCare' },
  { key: 'bhrt', title: 'Treatments (BHRT)', categories: ['bhrt'] },
];

export type NoteKey = 'blood' | 'imaging' | 'supplements' | 'skinCare' | 'hairCare';

export const NOTE_LABELS: Record<NoteKey, string> = {
  blood: 'Additional notes (blood work)',
  imaging: 'Additional notes (imaging)',
  supplements: 'Additional notes (supplements)',
  skinCare: 'Additional notes (skin care)',
  hairCare: 'Additional notes (hair care)',
};

export const prescriptionsApi = createCrud<Prescription, PrescriptionInput, Schemas['UpdatePrescription']>(
  'prescriptions',
  '/branch/prescriptions',
  { invalidates: ['clinical'] },
);

export function usePrescriptionCatalog(enabled = true) {
  return useQuery({
    queryKey: ['prescriptions', 'catalog'],
    queryFn: () => unwrap(api.GET('/branch/prescription-catalog')).then((r) => r.data),
    staleTime: 10 * 60_000,
    enabled,
  });
}

export function usePrescriptionPrint(id: string) {
  return useQuery({
    queryKey: ['prescriptions', 'print', id],
    queryFn: () =>
      unwrap(api.GET('/branch/prescriptions/{id}/print', { params: { path: { id } } })).then((r) => r.data),
    enabled: Boolean(id),
  });
}
