import type { CatalogCategory, NoteKey } from '@redux/features/prescriptions/types';

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

export const NOTE_LABELS: Record<NoteKey, string> = {
  blood: 'Additional notes (blood work)',
  imaging: 'Additional notes (imaging)',
  supplements: 'Additional notes (supplements)',
  skinCare: 'Additional notes (skin care)',
  hairCare: 'Additional notes (hair care)',
};
