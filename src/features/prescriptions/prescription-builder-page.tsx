import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm, useFormContext, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { Combobox } from '@/components/shared/combobox';
import { ErrorState } from '@/components/shared/error-state';
import { FieldRow, SelectField, TextField, TextareaField } from '@/components/shared/form-fields';
import { PageHeader } from '@/components/shared/page-header';
import { Panel } from '@/components/shared/panel';
import { DetailSkeleton } from '@/components/shared/skeletons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useConsultation } from '@/features/consultations/api';
import { doctorsApi, useMyDoctorProfile } from '@/features/doctors/api';
import { patientsApi, usePatientSearch } from '@/features/patients/api';
import { applyServerErrors } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { isoDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { optionalText, requiredText } from '@/lib/validation';
import {
  BUILDER_SECTIONS,
  NOTE_LABELS,
  prescriptionsApi,
  usePrescriptionCatalog,
  type CatalogItem,
  type NoteKey,
  type Prescription,
  type PrescriptionInput,
} from './api';

interface ItemState {
  selected: boolean;
  dose: string;
  instructions: string;
}

const schema = z.object({
  patientId: z.string().min(1, 'Choose a patient'),
  doctorId: z.string().min(1, 'Choose a doctor'),
  date: z.string().min(1, 'Choose a date'),
  diagnosis: requiredText(5000, 'Diagnosis'),
  followupDate: z.string(),
  planTreatment: optionalText(50000),
  notes: z.object({
    blood: optionalText(5000),
    imaging: optionalText(5000),
    supplements: optionalText(5000),
    skinCare: optionalText(5000),
    hairCare: optionalText(5000),
  }),
  items: z.record(
    z.string(),
    z.object({ selected: z.boolean(), dose: z.string().max(2000), instructions: z.string().max(5000) }),
  ),
});

type Values = z.input<typeof schema>;

function groupCatalog(items: CatalogItem[], categories: string[]) {
  const groups = new Map<string, CatalogItem[]>();
  for (const item of items
    .filter((i) => i.isActive && categories.includes(i.category))
    .sort(
      (a, b) => categories.indexOf(a.category) - categories.indexOf(b.category) || a.sortOrder - b.sortOrder,
    )) {
    const key = item.groupName;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()];
}

function CatalogItemRow({ item }: { item: CatalogItem }) {
  const form = useFormContext<Values>();
  const state = useWatch({ control: form.control, name: `items.${item.id}` }) as ItemState | undefined;
  const selected = state?.selected ?? false;
  const detailed =
    item.category === 'bhrt' ||
    item.category === 'supplement' ||
    item.category === 'medicine' ||
    item.category === 'glp';
  return (
    <div
      className={cn(
        'rounded-md border transition-colors',
        selected && 'border-primary/50 bg-primary-soft/40',
      )}
    >
      <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) =>
            form.setValue(`items.${item.id}.selected`, checked === true, { shouldDirty: true })
          }
          className="mt-0.5"
        />
        <span className="min-w-0 flex-1">
          <span className="font-medium">{item.name}</span>
          {item.defaultDose && !selected ? (
            <span className="block text-xs text-muted-foreground">{item.defaultDose}</span>
          ) : null}
        </span>
      </label>
      {selected && detailed ? (
        <div className="space-y-2 border-t px-3 py-2.5">
          <Input
            aria-label={`${item.name} dose`}
            placeholder="Dose"
            value={state?.dose ?? ''}
            onChange={(e) => form.setValue(`items.${item.id}.dose`, e.target.value, { shouldDirty: true })}
          />
          {item.category === 'bhrt' || item.defaultInstructions ? (
            <Textarea
              aria-label={`${item.name} instructions`}
              placeholder="How to use"
              rows={2}
              value={state?.instructions ?? ''}
              onChange={(e) =>
                form.setValue(`items.${item.id}.instructions`, e.target.value, { shouldDirty: true })
              }
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function initialItems(catalog: CatalogItem[], prescription: Prescription | null) {
  const items: Record<string, ItemState> = {};
  for (const entry of catalog) {
    const used = prescription?.items.find((i) => i.catalogItemId === entry.id);
    items[entry.id] = {
      selected: Boolean(used),
      dose: used ? (used.dose ?? '') : (entry.defaultDose ?? ''),
      instructions: used ? (used.instructions ?? '') : (entry.defaultInstructions ?? ''),
    };
  }
  return items;
}

function Builder({
  prescription,
  consultationId,
  catalog,
}: {
  prescription: Prescription | null;
  consultationId: string | null;
  catalog: CatalogItem[];
}) {
  const navigate = useNavigate();
  const { me } = useAuth();
  const isDoctor = me?.role === 'doctor';
  const save = prescriptionsApi.useSave();
  const consultation = useConsultation(consultationId ?? prescription?.consultationId);
  const doctors = doctorsApi.useOptions();
  const myDoctor = useMyDoctorProfile(isDoctor);
  const [params] = useSearchParams();
  const preset = !prescription && !consultationId;
  const presetPatientId = preset ? params.get('patientId') : null;
  const presetDoctorId = preset ? params.get('doctorId') : null;
  const presetPatient = patientsApi.useDetail(presetPatientId ?? undefined);
  const [patientSearch, setPatientSearch] = useState('');
  const patients = usePatientSearch(patientSearch, !prescription && !consultationId);
  const [patientLabel, setPatientLabel] = useState<string | null>(
    prescription?.patient ? `${prescription.patient.name} · ${prescription.patient.phone}` : null,
  );
  const legacyItems = prescription?.items.filter((i) => !i.catalogItemId) ?? [];
  const notes = (prescription?.notes ?? {}) as Partial<Record<NoteKey, string | null>>;

  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    values: {
      patientId: prescription?.patientId ?? consultation.data?.patientId ?? presetPatientId ?? '',
      doctorId:
        prescription?.doctorId ?? consultation.data?.doctorId ?? myDoctor.data?.id ?? presetDoctorId ?? '',
      date: prescription?.date ?? isoDate(),
      diagnosis: prescription?.diagnosis ?? '',
      followupDate: prescription?.followupDate ?? '',
      planTreatment: prescription?.planTreatment ?? null,
      notes: {
        blood: notes.blood ?? null,
        imaging: notes.imaging ?? null,
        supplements: notes.supplements ?? null,
        skinCare: notes.skinCare ?? null,
        hairCare: notes.hairCare ?? null,
      },
      items: initialItems(catalog, prescription),
    },
    resetOptions: { keepDirtyValues: true },
  });
  const items = useWatch({ control: form.control, name: 'items' });
  const selectedCount = Object.values(items).filter((i) => i?.selected).length;

  const submit = form.handleSubmit((values) => {
    const chosen = catalog
      .filter((entry) => values.items[entry.id]?.selected)
      .map((entry) => ({
        catalogItemId: entry.id,
        dose: values.items[entry.id]?.dose.trim() || null,
        instructions: values.items[entry.id]?.instructions.trim() || null,
      }));
    const legacy = legacyItems.map((i) => ({
      category: i.category,
      groupName: i.groupName,
      name: i.name,
      dose: i.dose,
      instructions: i.instructions,
      optional: i.optional,
    }));
    const common = {
      date: values.date,
      diagnosis: values.diagnosis,
      notes: values.notes,
      planTreatment: values.planTreatment,
      followupDate: values.followupDate || null,
      items: [...chosen, ...legacy],
    };
    const body: PrescriptionInput = prescription
      ? common
      : {
          ...common,
          patientId: values.patientId,
          doctorId: values.doctorId,
          ...(consultationId ? { consultationId } : {}),
        };
    save.mutate(
      { id: prescription?.id, body },
      {
        onSuccess: ({ data }) => {
          toast.success(
            prescription ? 'Prescription updated' : `Prescription #${data.prescriptionNo} saved`,
            {
              action: { label: 'Print', onClick: () => void navigate(`/print/prescription/${data.id}`) },
            },
          );
          if (consultation.data)
            void navigate(
              `/appointments/${consultation.data.appointmentId}/consultation?section=prescriptions`,
            );
          else void navigate('/prescriptions');
        },
        onError: (error) => applyServerErrors(form, error),
      },
    );
  });

  const lockedParties = Boolean(prescription || consultationId);
  const patientName = prescription?.patient?.name ?? consultation.data?.patient?.name;

  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="space-y-6">
        <Panel title="Prescription">
          <div className="space-y-5">
            <FieldRow>
              {lockedParties ? (
                <FormItem>
                  <FormLabel>Patient</FormLabel>
                  <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">
                    {patientName ?? '…'}
                  </div>
                </FormItem>
              ) : (
                <FormField
                  control={form.control}
                  name="patientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Customer name<span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Combobox
                          value={field.value}
                          onChange={(value, option) => {
                            field.onChange(value ?? '');
                            setPatientLabel(option ? `${option.label} · ${option.hint ?? ''}` : null);
                          }}
                          selectedLabel={
                            patientLabel ??
                            (presetPatient.data && field.value === presetPatient.data.id
                              ? `${presetPatient.data.name} · ${presetPatient.data.phone}`
                              : null)
                          }
                          onSearchChange={setPatientSearch}
                          placeholder="Search by phone or name"
                          options={(patients.data ?? []).map((p) => ({
                            value: p.id,
                            label: p.name,
                            hint: p.phone,
                          }))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <SelectField
                control={form.control}
                name="doctorId"
                label="Doctor name"
                required
                disabled={lockedParties || isDoctor}
                options={(doctors.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
              />
            </FieldRow>
            <FieldRow>
              <TextField control={form.control} name="date" label="Date" type="date" required />
              <TextField control={form.control} name="followupDate" label="Follow up date" type="date" />
            </FieldRow>
            <TextareaField control={form.control} name="diagnosis" label="Diagnosis" required rows={2} />
          </div>
        </Panel>

        {BUILDER_SECTIONS.map((section) => {
          const groups = groupCatalog(catalog, section.categories);
          if (groups.length === 0) return null;
          return (
            <Panel key={section.key} title={section.title}>
              <div className="space-y-5">
                {groups.map(([groupName, entries]) => (
                  <div key={groupName} className="space-y-2">
                    <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {groupName}
                    </div>
                    <div
                      className={cn(
                        'grid gap-2',
                        section.key === 'bhrt' ? 'md:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3',
                      )}
                    >
                      {entries.map((entry) => (
                        <CatalogItemRow key={entry.id} item={entry} />
                      ))}
                    </div>
                  </div>
                ))}
                {section.note ? (
                  <TextareaField
                    control={form.control}
                    name={`notes.${section.note}`}
                    label={NOTE_LABELS[section.note]}
                    rows={2}
                  />
                ) : null}
              </div>
            </Panel>
          );
        })}

        {legacyItems.length ? (
          <Panel
            title="Items from the old template"
            description="Kept as they were; they print with this prescription."
          >
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {legacyItems.map((i) => (
                <li key={i.id}>
                  {i.name}
                  {i.dose ? ` — ${i.dose}` : ''}
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        <Panel title="Plan of treatment">
          <TextareaField control={form.control} name="planTreatment" label="Plan" rows={5} />
        </Panel>

        <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <span className="text-sm text-muted-foreground">{selectedCount} items selected</span>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            {prescription ? 'Save changes' : 'Save prescription'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export function PrescriptionBuilderPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const consultationId = params.get('consultationId');
  const catalog = usePrescriptionCatalog();
  const prescription = prescriptionsApi.useDetail(id);
  const consultation = useConsultation(consultationId ?? prescription.data?.consultationId);
  const backLink = useMemo(() => {
    if (consultation.data)
      return {
        to: `/appointments/${consultation.data.appointmentId}/consultation?section=prescriptions`,
        label: 'Consultation',
      };
    return { to: '/prescriptions', label: 'Prescriptions' };
  }, [consultation.data]);

  if (catalog.isLoading || (id && prescription.isLoading)) return <DetailSkeleton />;
  if (catalog.error) return <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />;
  if (id && (prescription.error || !prescription.data))
    return <ErrorState error={prescription.error} onRetry={() => void prescription.refetch()} />;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
        <Link to={backLink.to}>
          <ArrowLeft />
          {backLink.label}
        </Link>
      </Button>
      <PageHeader
        title={id ? `Edit prescription #${prescription.data?.prescriptionNo ?? ''}` : 'New prescription'}
        description="Tick what the patient needs. Dose and instructions start from the catalog defaults."
      />
      <Builder
        key={prescription.data?.id ?? 'new'}
        prescription={prescription.data ?? null}
        consultationId={consultationId}
        catalog={catalog.data ?? []}
      />
    </>
  );
}
