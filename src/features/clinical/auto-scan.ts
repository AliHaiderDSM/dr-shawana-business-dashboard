import { toast } from 'sonner';
import { errorMessage } from '@/components/shared/error-state';
import { formatDate } from '@/lib/format';
import { useScanMedicalRecordMutation, type MedicalRecord } from '@redux/features/clinical';
import { READABLE_RECORD_TYPES } from './report-selection';

export function useAutoScan(patientId: string) {
  const [scanRecord] = useScanMedicalRecordMutation();
  return async (record: MedicalRecord, fileIds?: string[]) => {
    const readable = record.files.filter(
      (f) => READABLE_RECORD_TYPES.includes(f.contentType) && (!fileIds || fileIds.includes(f.id)),
    );
    if (record.type !== 'medical_record' || readable.length === 0) return;
    const id = toast.loading('AI is reading the report…');
    try {
      const scan = await scanRecord({
        patientId,
        recordId: record.id,
        fileIds: readable.map((f) => f.id),
      }).unwrap();
      if (scan.saved > 0)
        toast.success(
          `AI saved ${scan.saved} value${scan.saved === 1 ? '' : 's'} to Blood work for ${scan.dates.map((d) => formatDate(d)).join(', ')}`,
          { id },
        );
      else toast.message(scan.reason ?? 'No blood work value was found on this report.', { id });
    } catch (error) {
      toast.error(`The record is saved, but AI could not read it: ${errorMessage(error)}`, {
        id,
        duration: 10000,
      });
    }
  };
}
