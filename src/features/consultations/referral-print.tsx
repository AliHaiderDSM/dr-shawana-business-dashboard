import { useParams } from 'react-router';
import { Letterhead, PrintField, PrintPage, SignatureLine } from '@/components/shared/print-document';
import { formatDate } from '@/lib/format';
import { useReferralLetter } from './api';

interface ReferralData {
  referredTo?: string;
  specialty?: string;
  date?: string;
  referringDoctorName?: string;
  referringDoctorPhone?: string;
  referringDoctorAddress?: string;
  reason?: string;
}

export function ReferralPrint() {
  const { id = '' } = useParams();
  const letter = useReferralLetter(id);

  return (
    <PrintPage isLoading={letter.isLoading} error={letter.error} onRetry={() => void letter.refetch()}>
      {() => {
        const data = letter.data;
        if (!data) return null;
        const referral = data.referral as ReferralData;
        return (
          <div className="space-y-6 text-sm">
            <Letterhead
              title="DSM Referral Form"
              subtitle="Clinical Referral Slip"
              organization={
                data.company
                  ? { name: data.company.name, lines: [data.company.phone, data.company.email] }
                  : undefined
              }
            />
            <PrintField
              label="Date"
              value={referral.date ? formatDate(referral.date, 'dd-MM-yyyy') : null}
              className="w-64"
            />
            <section className="space-y-3">
              <h3 className="border-b pb-1 font-semibold tracking-wide text-primary uppercase">
                Referral information
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <PrintField label="Referred to" value={referral.referredTo} />
                <PrintField label="Specialty" value={referral.specialty} />
                <PrintField label="Referring doctor" value={referral.referringDoctorName} />
                <PrintField label="Doctor number" value={referral.referringDoctorPhone} />
              </div>
              <PrintField label="Doctor address" value={referral.referringDoctorAddress} />
            </section>
            <section className="space-y-3">
              <h3 className="border-b pb-1 font-semibold tracking-wide text-primary uppercase">
                Patient details
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <PrintField label="Name" value={data.patient.name} />
                <PrintField label="Contact number" value={data.patient.phone} />
                <PrintField
                  label="Date of birth"
                  value={data.patient.dateOfBirth ? formatDate(data.patient.dateOfBirth, 'dd-MM-yyyy') : null}
                />
                <PrintField
                  label="Date"
                  value={referral.date ? formatDate(referral.date, 'dd-MM-yyyy') : null}
                />
              </div>
            </section>
            <section className="space-y-2">
              <h3 className="border-b pb-1 font-semibold tracking-wide text-primary uppercase">
                Reason for referral
              </h3>
              <p className="min-h-24 whitespace-pre-wrap">{referral.reason}</p>
            </section>
            <div className="flex pt-10">
              <SignatureLine label={`Doctor's signature${data.doctor ? ` — ${data.doctor.name}` : ''}`} />
            </div>
          </div>
        );
      }}
    </PrintPage>
  );
}
