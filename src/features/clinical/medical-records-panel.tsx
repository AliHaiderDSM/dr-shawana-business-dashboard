import { zodResolver } from '@hookform/resolvers/zod';
import { FilePlus2, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { AttachmentList } from '@/components/shared/attachment-list';
import { ChoiceField } from '@/components/shared/choice-field';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { FilePicker } from '@/components/shared/file-upload';
import { TextField, TextareaField } from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { Panel } from '@/components/shared/panel';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Form, FormItem, FormLabel } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { patientRecordFileUrl } from '@/features/patients/api';
import { applyServerErrors, toastError } from '@/lib/api/errors';
import { formatDate, isoDate } from '@/lib/format';
import { optionalText } from '@/lib/validation';
import {
  RECORD_TYPE_LABELS,
  useAddRecordFiles,
  useCreateMedicalRecord,
  useMedicalRecords,
  useRemoveMedicalRecord,
  useRemoveRecordFile,
  type MedicalRecord,
} from './api';

const schema = z.object({
  type: z.enum(['medical_record', 'imaging']),
  date: z.string().min(1, 'Choose a date'),
  note: optionalText(20000),
});

type Values = z.input<typeof schema>;

function RecordSheet({
  patientId,
  appointmentId,
  open,
  onOpenChange,
}: {
  patientId: string;
  appointmentId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateMedicalRecord(patientId);
  const [files, setFiles] = useState<File[]>([]);
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'medical_record', date: isoDate(), note: null },
  });

  const submit = form.handleSubmit((values) => {
    if (files.length === 0 && !values.note) {
      toast.error('Add at least one file or a note');
      return;
    }
    create.mutate(
      { body: { ...values, appointmentId: appointmentId ?? null }, files },
      {
        onSuccess: () => {
          toast.success('Record saved');
          setFiles([]);
          form.reset();
          onOpenChange(false);
        },
        onError: (error) => applyServerErrors(form, error),
      },
    );
  });

  return (
    <Form {...form}>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Upload medical record"
        description="Reports and scans are private. They open through a short-lived link."
        onSubmit={submit}
        submitting={create.isPending}
        submitLabel="Save record"
      >
        <ChoiceField
          control={form.control}
          name="type"
          label="Record type"
          options={[
            { value: 'medical_record', label: 'Medical records' },
            { value: 'imaging', label: 'Imaging records' },
          ]}
        />
        <TextField control={form.control} name="date" label="Date" type="date" required />
        <FormItem>
          <FormLabel>Files</FormLabel>
          <FilePicker files={files} onChange={setFiles} maxFiles={10} />
        </FormItem>
        <TextareaField control={form.control} name="note" label="Additional notes" rows={3} />
      </FormSheet>
    </Form>
  );
}

function RecordCard({
  patientId,
  record,
  canEdit,
}: {
  patientId: string;
  record: MedicalRecord;
  canEdit: boolean;
}) {
  const addFiles = useAddRecordFiles(patientId);
  const removeFile = useRemoveRecordFile(patientId);
  const [files, setFiles] = useState<File[]>([]);
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge tone={record.type === 'imaging' ? 'info' : 'primary'} dot={false}>
          {RECORD_TYPE_LABELS[record.type]}
        </StatusBadge>
        <span className="font-medium">{formatDate(record.date)}</span>
        {record.appointmentId ? (
          <span className="text-xs text-muted-foreground">· from an appointment</span>
        ) : null}
      </div>
      {record.note ? (
        <p className="text-sm whitespace-pre-wrap text-muted-foreground">{record.note}</p>
      ) : null}
      <AttachmentList
        files={record.files}
        getUrl={(file) => patientRecordFileUrl(patientId, file.id)}
        onRemove={
          canEdit
            ? (file) =>
                removeFile
                  .mutateAsync({ recordId: record.id, fileId: file.id })
                  .then(() => toast.success('File removed'))
            : undefined
        }
      />
      {canEdit ? (
        adding ? (
          <div className="space-y-2">
            <FilePicker files={files} onChange={setFiles} maxFiles={10} />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={files.length === 0 || addFiles.isPending}
                onClick={() =>
                  addFiles
                    .mutateAsync({ recordId: record.id, files })
                    .then(() => {
                      toast.success('Files added');
                      setFiles([]);
                      setAdding(false);
                    })
                    .catch(toastError)
                }
              >
                <Upload />
                Upload
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="-ml-2" onClick={() => setAdding(true)}>
            <FilePlus2 />
            Add files
          </Button>
        )
      ) : null}
    </div>
  );
}

export function MedicalRecordsPanel({
  patientId,
  appointmentId,
  canEdit,
}: {
  patientId: string;
  appointmentId?: string;
  canEdit: boolean;
}) {
  const records = useMedicalRecords(patientId);
  const remove = useRemoveMedicalRecord(patientId);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<MedicalRecord | null>(null);

  return (
    <Panel
      title="Medical and imaging records"
      description="Newest first."
      actions={
        canEdit ? (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Upload />
            Upload
          </Button>
        ) : null
      }
    >
      {records.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : !records.data?.length ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No records uploaded yet.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {records.data.map((record) => (
            <div key={record.id} className="relative">
              <RecordCard patientId={patientId} record={record} canEdit={canEdit} />
              {canEdit ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 size-8 text-muted-foreground hover:text-destructive"
                  aria-label="Delete record"
                  onClick={() => setRemoving(record)}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {canEdit ? (
        <RecordSheet patientId={patientId} appointmentId={appointmentId} open={open} onOpenChange={setOpen} />
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Delete this record?"
        description="The record and its files are hidden from the patient history."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          removing
            ? remove
                .mutateAsync(removing.id)
                .then(() => toast.success('Record deleted'))
                .catch(toastError)
            : undefined
        }
      />
    </Panel>
  );
}
