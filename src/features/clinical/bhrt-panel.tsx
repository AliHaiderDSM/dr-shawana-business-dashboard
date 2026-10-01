import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ChoiceField } from '@/components/shared/choice-field';
import { TextField, TextareaField } from '@/components/shared/form-fields';
import { Panel } from '@/components/shared/panel';
import { StatusBadge, type Tone } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { applyServerErrors } from '@/lib/api/errors';
import { formatDate, isoDate } from '@/lib/format';
import { optionalText } from '@/lib/validation';
import { BHRT_STATUS_LABELS, useAddBhrt, useBhrtLog, type BhrtEntry } from './api';

const TONES: Record<BhrtEntry['status'], Tone> = {
  on: 'success',
  off: 'neutral',
  recommended: 'info',
  other: 'neutral',
};

const schema = z.object({
  status: z.enum(['on', 'off', 'recommended', 'other'], 'Choose a status'),
  date: z.string().min(1, 'Choose a date'),
  note: optionalText(20000),
});

type Values = z.input<typeof schema>;

export function BhrtPanel({
  patientId,
  appointmentId,
  canEdit,
}: {
  patientId: string;
  appointmentId?: string;
  canEdit: boolean;
}) {
  const log = useBhrtLog(patientId);
  const add = useAddBhrt(patientId);
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { status: undefined, date: isoDate(), note: null },
  });

  const submit = form.handleSubmit((values) =>
    add.mutate(
      { ...values, appointmentId: appointmentId ?? null },
      {
        onSuccess: () => {
          toast.success('BHRT status saved');
          form.reset({ status: undefined, date: isoDate(), note: null });
        },
        onError: (error) => applyServerErrors(form, error),
      },
    ),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Panel
        title="BHRT history"
        description="The newest entry sets the patient's BHRT status."
        bodyClassName="p-0"
      >
        {log.isLoading ? (
          <div className="p-5">
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !log.data?.length ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No BHRT entries yet.</p>
        ) : (
          <ol className="divide-y">
            {log.data.map((entry) => (
              <li key={entry.id} className="flex gap-4 px-5 py-3 text-sm">
                <div className="w-24 shrink-0 text-muted-foreground">{formatDate(entry.date)}</div>
                <div className="min-w-0 flex-1 space-y-1">
                  <StatusBadge tone={TONES[entry.status]}>{BHRT_STATUS_LABELS[entry.status]}</StatusBadge>
                  {entry.note ? (
                    <p className="whitespace-pre-wrap text-muted-foreground">{entry.note}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
      {canEdit ? (
        <Panel title="Update BHRT status">
          <Form {...form}>
            <form onSubmit={submit} noValidate className="space-y-4">
              <ChoiceField
                control={form.control}
                name="status"
                label="BHRT status"
                required
                options={(['on', 'off', 'recommended', 'other'] as const).map((s) => ({
                  value: s,
                  label: BHRT_STATUS_LABELS[s],
                }))}
              />
              <TextField control={form.control} name="date" label="Date" type="date" required />
              <TextareaField control={form.control} name="note" label="BHRT note" rows={3} />
              <Button type="submit" className="w-full" disabled={add.isPending}>
                {add.isPending ? <Loader2 className="animate-spin" /> : null}
                Save status
              </Button>
            </form>
          </Form>
        </Panel>
      ) : null}
    </div>
  );
}
