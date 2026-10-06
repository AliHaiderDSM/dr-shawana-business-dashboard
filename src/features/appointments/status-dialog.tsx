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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toastError } from '@/lib/api/errors';
import { STATUS_LABELS, useChangeAppointmentStatus, type Appointment, type AppointmentStatus } from './api';

export interface StatusChange {
  appointment: Pick<Appointment, 'id' | 'appointmentNo' | 'remark'>;
  status: AppointmentStatus;
  remarks?: boolean;
}

const STATUSES: AppointmentStatus[] = ['booked', 'completed', 'cancelled'];

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

const REMARKS_COPY = {
  title: 'Remarks',
  description: 'Set the status, write the remark and attach screenshots.',
  action: 'Save remark',
};

export function StatusDialog({ change, onClose }: { change: StatusChange | null; onClose: () => void }) {
  if (!change) return null;
  return (
    <StatusDialogBody
      key={`${change.appointment.id}-${change.status}-${change.remarks ? 'remarks' : 'status'}`}
      change={change}
      onClose={onClose}
    />
  );
}

function StatusDialogBody({ change, onClose }: { change: StatusChange; onClose: () => void }) {
  const mutation = useChangeAppointmentStatus(change.appointment.id);
  const [status, setStatus] = useState<AppointmentStatus>(change.status);
  const [remark, setRemark] = useState(change.appointment.remark ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const copy = change.remarks ? REMARKS_COPY : COPY[change.status];
  const withFiles = change.remarks || status === 'completed';

  const submit = () =>
    mutation.mutate(
      { status, remark: remark.trim() || null, files: withFiles ? files : [] },
      {
        onSuccess: () => {
          toast.success(
            change.remarks
              ? `Remark saved for appointment #${change.appointment.appointmentNo}`
              : `Appointment #${change.appointment.appointmentNo} ${STATUS_LABELS[status].toLowerCase()}`,
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
          {change.remarks ? (
            <div className="space-y-2">
              <Label htmlFor="status-value">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as AppointmentStatus)}>
                <SelectTrigger id="status-value" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="status-remark">Remark</Label>
            <Textarea
              id="status-remark"
              rows={4}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />
          </div>
          {withFiles ? (
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
            variant={!change.remarks && status === 'cancelled' ? 'destructive' : 'default'}
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
