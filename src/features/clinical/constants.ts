import type { BhrtEntry, BloodTest, MedicalRecordType } from '@redux/features/clinical/types';

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
