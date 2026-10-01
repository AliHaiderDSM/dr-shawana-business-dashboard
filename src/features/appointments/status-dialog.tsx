import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { FilePicker } from '@/components/shared/file-upload';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toastError } from '@/lib/api/errors';
import { STATUS_LABELS, useChangeAppointmentStatus, type Appointment, type AppointmentStatus } from './api';

export interface StatusChange {
  appointment: Pick<Appointment, 'id' | 'appointmentNo' | 'remark'>;
  status: AppointmentStatus;
}

const COPY: Record<AppointmentStatus, { title: string; description: string; action: string }> = {
  completed: {
    title: 'Mark as completed',
    description: 'The visit took place. Add the clinical remark and any screenshots.',
    action: 'Complete appointment',
  },
  cancelled: {
    title: 'Cancel appointment',
    description: 'The slot is freed for other bookings. Payments stay recorded.',
    action: 'Cancel appointment',
  },
  booked: {
    title: 'Reopen appointment',
    description: 'The appointment goes back to booked.',
    action: 'Reopen',
  },
};

export function StatusDialog({ change, onClose }: { change: StatusChange | null; onClose: () => void }) {
  if (!change) return null;
  return (
    <StatusDialogBody key={`${change.appointment.id}-${change.status}`} change={change} onClose={onClose} />
  );
}

function StatusDialogBody({ change, onClose }: { change: StatusChange; onClose: () => void }) {
  const mutation = useChangeAppointmentStatus(change.appointment.id);
  const [remark, setRemark] = useState(change.appointment.remark ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const copy = COPY[change.status];

  const submit = () =>
    mutation.mutate(
      { status: change.status, remark: remark.trim() || null, files },
      {
        onSuccess: () => {
          toast.success(
            `Appointment #${change.appointment.appointmentNo} ${STATUS_LABELS[change.status].toLowerCase()}`,
          );
          onClose();
        },
        onError: (error) => toastError(error),
      },
    );

  return (
    <Dialog open onOpenChange={(open) => !open && !mutation.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {copy.title} #{change.appointment.appointmentNo}
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status-remark">Remark</Label>
            <Textarea
              id="status-remark"
              rows={4}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />
          </div>
          {change.status === 'completed' ? (
            <div className="space-y-2">
              <Label>Remark screenshots</Label>
              <FilePicker files={files} onChange={setFiles} />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Close
          </Button>
          <Button
            variant={change.status === 'cancelled' ? 'destructive' : 'default'}
            onClick={submit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {copy.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
