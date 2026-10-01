import { useParams } from 'react-router';
import { Letterhead, PrintField, PrintPage, PrintTable } from '@/components/shared/print-document';
import { doctorsApi } from '@/features/doctors/api';
import { formatDate, formatMoney } from '@/lib/format';
import { appointmentsApi, METHOD_LABELS, MODE_LABELS, timeRange, VISIT_LABELS } from './api';

export function AppointmentPrint() {
  const { id = '' } = useParams();
  const appointment = appointmentsApi.useDetail(id);
  const doctors = doctorsApi.useOptions();

  return (
    <PrintPage
      paper="a5"
      isLoading={appointment.isLoading}
      error={appointment.error}
      onRetry={() => void appointment.refetch()}
    >
      {() => {
        const a = appointment.data;
        if (!a) return null;
        const doctor = doctors.data?.find((d) => d.id === a.doctorId);
        const total = a.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        return (
          <div className="space-y-6">
            <Letterhead
              title="Appointment Slip"
              subtitle={`Printed ${formatDate(new Date(), 'dd-MM-yyyy')}`}
            />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <PrintField label="Doctor" value={a.doctor?.name} />
              <PrintField label="Phone" value={doctor?.phone} />
            </div>
            <h2 className="text-center text-xl font-semibold">Appointment No #{a.appointmentNo}</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <PrintField label="Name" value={a.patient?.name} />
              <PrintField label="Phone" value={a.patient?.phone} />
            </div>
            <div className="grid grid-cols-3 gap-x-6 gap-y-3">
              <PrintField label="Date" value={formatDate(a.date, 'dd-MM-yyyy')} />
              <PrintField label="Time" value={timeRange(a.timeFrom, a.timeTo)} />
              <PrintField label="Status" value={`${MODE_LABELS[a.mode]} · ${VISIT_LABELS[a.visitType]}`} />
            </div>
            <PrintField label="Issues" value={a.issues} />
            {a.payments.length ? (
              <div className="space-y-2 border-t-2 border-double border-primary pt-4">
                <PrintTable
                  head={['Method', 'Date', 'Received in', 'Amount']}
                  rows={a.payments.map((p) => [
                    METHOD_LABELS[p.method],
                    formatDate(p.date, 'dd-MM-yyyy'),
                    p.accountSheet?.accountName ?? '—',
                    formatMoney(p.amount),
                  ])}
                  foot={['Total', '', '', formatMoney(total)]}
                />
              </div>
            ) : null}
          </div>
        );
      }}
    </PrintPage>
  );
}
