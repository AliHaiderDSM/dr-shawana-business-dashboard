import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { ChoiceField } from '@/components/shared/choice-field';
import { Combobox } from '@/components/shared/combobox';
import { FilePicker } from '@/components/shared/file-upload';
import {
  FieldRow,
  FormSection,
  SelectField,
  TextField,
  TextareaField,
} from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { doctorsApi, useMyDoctorProfile } from '@/features/doctors/api';
import { usePatientSearch } from '@/features/patients/api';
import {
  patientDefaults,
  PatientFields,
  patientFieldsSchema,
  type PatientFieldValues,
  toPatientInput,
} from '@/features/patients/patient-fields';
import { applyServerErrors } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { isoDate } from '@/lib/format';
import { optionalText, timeString } from '@/lib/validation';
import {
  appointmentsApi,
  MODE_LABELS,
  useBookAppointment,
  VISIT_LABELS,
  type Appointment,
  type AppointmentInput,
} from './api';
import { DoctorSlots } from './doctor-slots';
import {
  emptyPayment,
  PaymentFields,
  paymentSchema,
  ReceivingAccountsNotice,
  toPaymentBody,
  useReceivingAccounts,
} from './payment-fields';

const schema = z
  .object({
    patientMode: z.enum(['existing', 'new']),
    patientId: z.string(),
    patient: z.custom<PatientFieldValues>(),
    doctorId: z.string().min(1, 'Choose a doctor'),
    date: z.string().min(1, 'Choose a date'),
    timeFrom: timeString('Time from'),
    timeTo: timeString('Time to'),
    mode: z.enum(['online', 'physical']),
    visitType: z.enum(['new', 'followup']),
    issues: optionalText(20000),
    recordNote: optionalText(20000),
    payments: z.array(paymentSchema).max(10),
  })
  .superRefine((v, ctx) => {
    if (v.timeFrom && v.timeTo && v.timeTo <= v.timeFrom)
      ctx.addIssue({ code: 'custom', path: ['timeTo'], message: 'Time to must be after time from' });
    if (v.patientMode === 'existing') {
      if (!v.patientId) ctx.addIssue({ code: 'custom', path: ['patientId'], message: 'Choose a patient' });
      return;
    }
    const patient = patientFieldsSchema.safeParse(v.patient);
    if (!patient.success)
      for (const issue of patient.error.issues)
        ctx.addIssue({
          code: 'custom',
          path: ['patient', ...issue.path.map(String)],
          message: issue.message,
        });
  });

type Values = z.input<typeof schema>;

export interface BookingDefaults {
  patientId?: string;
  patientName?: string;
  doctorId?: string;
  date?: string;
}

interface AppointmentFormSheetProps {
  appointment?: Appointment | null;
  defaults?: BookingDefaults;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function addMinutes(time: string, minutes: number) {
  const [h = 0, m = 0] = time.split(':').map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function AppointmentFormSheet({
  appointment,
  defaults,
  open,
  onOpenChange,
}: AppointmentFormSheetProps) {
  const navigate = useNavigate();
  const { me, can } = useAuth();
  const isDoctor = me?.role === 'doctor';
  const editing = Boolean(appointment);
  const book = useBookAppointment();
  const update = appointmentsApi.useSave();
  const doctors = doctorsApi.useOptions({}, open);
  const myDoctor = useMyDoctorProfile(open && isDoctor);
  const canPay = can('appointmentPayments.create') && !editing;
  const accounts = useReceivingAccounts(open && canPay);
  const [patientSearch, setPatientSearch] = useState('');
  const patients = usePatientSearch(patientSearch, open);
  const [patientLabel, setPatientLabel] = useState<string | null>(
    appointment
      ? `${appointment.patient?.name ?? ''} · ${appointment.patient?.phone ?? ''}`
      : (defaults?.patientName ?? null),
  );
  const [recordFiles, setRecordFiles] = useState<File[]>([]);

  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    values: {
      patientMode: 'existing',
      patientId: appointment?.patientId ?? defaults?.patientId ?? '',
      patient: patientDefaults(),
      doctorId: appointment?.doctorId ?? defaults?.doctorId ?? myDoctor.data?.id ?? '',
      date: appointment?.date ?? defaults?.date ?? isoDate(),
      timeFrom: appointment?.timeFrom.slice(0, 5) ?? '',
      timeTo: appointment?.timeTo.slice(0, 5) ?? '',
      mode: appointment?.mode ?? 'physical',
      visitType: appointment?.visitType ?? 'new',
      issues: appointment?.issues ?? null,
      recordNote: null,
      payments: [],
    },
    resetOptions: { keepDirtyValues: true },
  });
  const payments = useFieldArray({ control: form.control, name: 'payments' });
  const [patientMode, doctorId, date, timeFrom] = useWatch({
    control: form.control,
    name: ['patientMode', 'doctorId', 'date', 'timeFrom'],
  });
  const doctorFee = doctors.data?.find((d) => d.id === doctorId)?.consultationFee ?? '';

  const submit = form.handleSubmit((values) => {
    const visit = {
      doctorId: values.doctorId,
      date: values.date,
      timeFrom: values.timeFrom,
      timeTo: values.timeTo,
      mode: values.mode,
      visitType: values.visitType,
      issues: values.issues,
    };
    if (appointment) {
      update.mutate(
        { id: appointment.id, body: { ...visit, patientId: values.patientId } },
        {
          onSuccess: () => {
            toast.success('Appointment updated');
            onOpenChange(false);
          },
          onError: (error) => applyServerErrors(form, error),
        },
      );
      return;
    }
    const proofs: File[] = [];
    const body: AppointmentInput = {
      ...visit,
      ...(values.patientMode === 'existing'
        ? { patientId: values.patientId }
        : { patient: toPatientInput(patientFieldsSchema.parse(values.patient)) }),
      ...(values.recordNote || recordFiles.length ? { medicalRecord: { note: values.recordNote } } : {}),
      payments: values.payments.map((payment) => {
        const proofIndex = payment.proof ? proofs.push(payment.proof) - 1 : undefined;
        return { ...toPaymentBody(payment), ...(proofIndex === undefined ? {} : { proofIndex }) };
      }),
    };
    book.mutate(
      { body, medicalRecordFiles: recordFiles, paymentProofs: proofs },
      {
        onSuccess: (created) => {
          toast.success(`Appointment #${created.appointmentNo} booked`, {
            action: { label: 'Print slip', onClick: () => void navigate(`/print/appointment/${created.id}`) },
          });
          setRecordFiles([]);
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
        title={editing ? `Edit appointment #${appointment?.appointmentNo}` : 'Book appointment'}
        description="Patient, doctor and time first, then payments, as in posSoft."
        onSubmit={submit}
        submitting={book.isPending || update.isPending}
        submitLabel={editing ? 'Save changes' : 'Book appointment'}
        size="lg"
      >
        <FormSection title="Patient">
          {patientMode === 'existing' ? (
            <FormField
              control={form.control}
              name="patientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Patient<span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value}
                      onChange={(value, option) => {
                        field.onChange(value ?? '');
                        setPatientLabel(option ? `${option.label} · ${option.hint ?? ''}` : null);
                      }}
                      selectedLabel={patientLabel}
                      onSearchChange={setPatientSearch}
                      loading={patients.isFetching && !patients.data}
                      placeholder="Search by phone or name"
                      searchPlaceholder="Phone or name…"
                      emptyText="No patient found. Add a new one."
                      options={(patients.data ?? []).map((p) => ({
                        value: p.id,
                        label: p.name,
                        hint: `${p.phone} · ${p.city}`,
                      }))}
                      footer={
                        editing || !can('patients.create')
                          ? undefined
                          : (close) => (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start"
                                onClick={() => {
                                  close();
                                  form.setValue('patientMode', 'new');
                                  if (/\d{4,}/.test(patientSearch))
                                    form.setValue('patient.phone', patientSearch.trim());
                                  else if (patientSearch.trim())
                                    form.setValue('patient.name', patientSearch.trim());
                                }}
                              >
                                <UserPlus />
                                Add a new patient
                              </Button>
                            )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">New patient</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => form.setValue('patientMode', 'existing')}
                >
                  <X />
                  Pick existing instead
                </Button>
              </div>
              <PatientFields
                prefix="patient."
                onUseExisting={(existing) => {
                  form.setValue('patientMode', 'existing');
                  form.setValue('patientId', existing.id);
                  setPatientLabel(`${existing.name} · ${existing.phone}`);
                }}
              />
            </div>
          )}
        </FormSection>

        <FormSection title="Visit">
          <FieldRow>
            <SelectField
              control={form.control}
              name="doctorId"
              label="Doctor"
              required
              disabled={isDoctor}
              placeholder="Choose a doctor"
              options={(doctors.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
            />
            <TextField control={form.control} name="date" label="Date" type="date" required />
          </FieldRow>
          <DoctorSlots doctorId={doctorId || null} date={date} excludeId={appointment?.id} />
          <FieldRow>
            <FormField
              control={form.control}
              name="timeFrom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Time from<span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        if (e.target.value && !form.getValues('timeTo'))
                          form.setValue('timeTo', addMinutes(e.target.value, 30));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timeTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Time to<span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="time" min={timeFrom || undefined} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FieldRow>
          <FieldRow>
            <ChoiceField
              control={form.control}
              name="mode"
              label="Online / physical"
              options={(['physical', 'online'] as const).map((m) => ({ value: m, label: MODE_LABELS[m] }))}
            />
            <ChoiceField
              control={form.control}
              name="visitType"
              label="Type"
              options={(['new', 'followup'] as const).map((v) => ({ value: v, label: VISIT_LABELS[v] }))}
            />
          </FieldRow>
          <TextareaField control={form.control} name="issues" label="Issues" rows={3} />
        </FormSection>

        {editing ? null : (
          <FormSection title="Medical record" description="Optional reports the patient brought.">
            <FilePicker files={recordFiles} onChange={setRecordFiles} />
            <TextareaField control={form.control} name="recordNote" label="Additional notes" rows={2} />
          </FormSection>
        )}

        {canPay ? (
          <FormSection title="Payments" description="Add one line per payment received.">
            <ReceivingAccountsNotice error={accounts.error} />
            {payments.fields.map((field, index) => (
              <div key={field.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Payment {index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    aria-label="Remove payment"
                    onClick={() => payments.remove(index)}
                  >
                    <X />
                  </Button>
                </div>
                <PaymentFields prefix={`payments.${index}.`} accounts={accounts.data ?? []} />
              </div>
            ))}
            {accounts.data ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={payments.fields.length >= 10}
                onClick={() => payments.append(emptyPayment(payments.fields.length === 0 ? doctorFee : ''))}
              >
                <Plus />
                Add payment
              </Button>
            ) : null}
          </FormSection>
        ) : null}
      </FormSheet>
    </Form>
  );
}
