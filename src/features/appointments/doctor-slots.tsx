import { Clock } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoctorSlots } from '@/features/doctors/api';
import { formatDate } from '@/lib/format';
import { timeRange } from './api';

export function DoctorSlots({
  doctorId,
  date,
  excludeId,
}: {
  doctorId: string | null;
  date: string;
  excludeId?: string;
}) {
  const slots = useDoctorSlots(doctorId, date);
  if (!doctorId || !date) return null;
  const taken = (slots.data ?? []).filter((s) => s.appointmentId !== excludeId && s.status !== 'cancelled');

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Clock className="size-3.5" />
        Booked on {formatDate(date)}
      </div>
      {slots.isLoading ? (
        <div className="flex gap-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-7 w-32" />
        </div>
      ) : taken.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bookings yet. Every time is free.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {taken.map((slot) => (
            <span
              key={slot.appointmentId}
              className="inline-flex items-center gap-2 rounded-md border bg-card px-2 py-1 text-xs"
            >
              <span className="font-medium tabular-nums">{timeRange(slot.timeFrom, slot.timeTo)}</span>
              <StatusBadge status={slot.status} dot={false} className="h-5 px-1.5" />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
