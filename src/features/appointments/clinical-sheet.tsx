import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BhrtPanel } from '@/features/clinical/bhrt-panel';
import { MedicalRecordsPanel } from '@/features/clinical/medical-records-panel';
import { useAuth } from '@/lib/auth/auth-context';
import type { Appointment } from './api';

export type ClinicalView = 'bhrt' | 'records';

export interface ClinicalTarget {
  appointment: Pick<Appointment, 'id' | 'appointmentNo' | 'patientId' | 'patient'>;
  view: ClinicalView;
}

const TITLES: Record<ClinicalView, string> = { bhrt: 'BHRT', records: 'Medical record' };

export function ClinicalSheet({ target, onClose }: { target: ClinicalTarget | null; onClose: () => void }) {
  const { can } = useAuth();
  const canEdit = can('consultations.create') || can('consultations.update');
  const a = target?.appointment;

  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-3xl">
        {target && a ? (
          <>
            <SheetHeader className="border-b px-6 py-5">
              <SheetTitle>{TITLES[target.view]}</SheetTitle>
              <SheetDescription>
                {[a.patient?.name, a.patient?.phone, `Appointment #${a.appointmentNo}`]
                  .filter(Boolean)
                  .join(' · ')}
              </SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto px-6 py-6">
              {target.view === 'bhrt' ? (
                <BhrtPanel patientId={a.patientId} appointmentId={a.id} canEdit={canEdit} />
              ) : (
                <MedicalRecordsPanel patientId={a.patientId} appointmentId={a.id} canEdit={canEdit} />
              )}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
