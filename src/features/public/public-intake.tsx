import { Download, FileHeart, Loader2, Save, Upload } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SECTIONS, type FormValues, type SectionDef } from '@/features/consultations/clinical-fields';
import { sectionResolver, toApiData, toFormValues } from '@/features/consultations/clinical-form';
import { VisibleFields } from '@/features/consultations/section-form';
import { ApiError } from '@/lib/api/client';
import type { Schemas } from '@/lib/api/types';
import { env } from '@/lib/env';
import { formatDate } from '@/lib/format';

type History = Schemas['PublicPatientHistory'];

export const RESOURCES: Record<string, { label: string; file: string }> = {
  glpDietPlan: { label: 'GLP Diet Plan', file: '/resources/glp-diet-plan.pdf' },
  generalDietPlan: { label: 'General Diet Plan', file: '/resources/general-diet-plan.pdf' },
  liverDetox: { label: 'Liver Detox', file: '/resources/liver-detox.jpeg' },
  skinCareRoutine: { label: 'Skin Care Routine', file: '/resources/skin-care-routine.jpeg' },
  hairCareRoutine: { label: 'Hair Care Routine', file: '/resources/hair-care-routine.jpeg' },
};

const PUBLIC_SECTIONS: { key: 'basic_info' | 'medical_history' | 'additional_symptoms'; title: string }[] = [
  { key: 'basic_info', title: 'Basic information' },
  { key: 'medical_history', title: 'Have you ever been diagnosed with?' },
  { key: 'additional_symptoms', title: 'Other symptoms you are experiencing' },
];

async function send<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${env.VITE_API_BASE_URL}${path}`, init);
  const body = (await response.json().catch(() => null)) as {
    data?: T;
    error?: { code?: string; message?: string; details?: unknown };
  } | null;
  if (!response.ok || !body?.data)
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'ERROR',
      body?.error?.message ?? 'Something went wrong',
      body?.error?.details,
    );
  return body.data;
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <header className="bg-primary px-5 py-3 text-center text-primary-foreground">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="mt-0.5 text-xs opacity-90">{description}</p> : null}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function IntakeSection({
  token,
  section,
  title,
  data,
  defaults,
  onSaved,
}: {
  token: string;
  section: SectionDef;
  title: string;
  data: Record<string, unknown> | null;
  defaults?: FormValues;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const form = useForm<FormValues>({
    resolver: sectionResolver(section),
    defaultValues: toFormValues(section, data ?? undefined, defaults),
  });
  const submit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      await send(`/public/patient-history/${encodeURIComponent(token)}/sections/${section.key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toApiData(section, values)),
      });
      form.reset(values);
      toast.success(`${title} saved`);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  });
  return (
    <Card title={title}>
      <Form {...form}>
        <form onSubmit={submit} noValidate className="space-y-5">
          <VisibleFields section={section} />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              Save {title.toLowerCase()}
            </Button>
          </div>
        </form>
      </Form>
    </Card>
  );
}

function UploadBlock({
  token,
  type,
  label,
  onUploaded,
}: {
  token: string;
  type: 'medical_record' | 'imaging';
  label: string;
  onUploaded: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const upload = async () => {
    setBusy(true);
    try {
      const body = new FormData();
      body.append('data', JSON.stringify({ type, note: note.trim() || null }));
      for (const file of files) body.append('files', file);
      await send(`/public/patient-history/${encodeURIComponent(token)}/medical-records`, {
        method: 'POST',
        body,
      });
      toast.success(`${label} uploaded`);
      setFiles([]);
      setNote('');
      setInputKey((k) => k + 1);
      onUploaded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not upload');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`files-${type}`}>
          {label} <span className="text-xs text-muted-foreground">(you can choose several files)</span>
        </Label>
        <Input
          key={inputKey}
          id={`files-${type}`}
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`note-${type}`}>Any note</Label>
        <Textarea id={`note-${type}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex justify-end md:col-span-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy || files.length === 0}
          onClick={() => void upload()}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Upload />}
          Upload {files.length ? `${files.length} ${files.length === 1 ? 'file' : 'files'}` : ''}
        </Button>
      </div>
    </div>
  );
}

export function Downloads({ token, data }: { token: string; data: History }) {
  const resources = (data.resources ?? []).filter((key) => RESOURCES[key]);
  if (data.prescriptions.length === 0 && resources.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {data.prescriptions.map((p) => (
        <Button key={p.id} asChild>
          <a href={`/p/${encodeURIComponent(token)}/rx/${p.id}`} target="_blank" rel="noopener">
            <FileHeart />
            Prescription slip ({formatDate(p.date, 'dd-MM-yyyy')})
          </a>
        </Button>
      ))}
      {resources.map((key) => {
        const resource = RESOURCES[key];
        if (!resource) return null;
        return (
          <Button key={key} asChild variant="outline">
            <a href={resource.file} download>
              <Download />
              {resource.label}
            </a>
          </Button>
        );
      })}
    </div>
  );
}

export function IntakeForms({
  token,
  data,
  onChanged,
}: {
  token: string;
  data: History;
  onChanged: () => void;
}) {
  const form = data.form;
  if (!form) return null;
  return (
    <div className="space-y-6">
      {PUBLIC_SECTIONS.map(({ key, title }) => (
        <IntakeSection
          key={key}
          token={token}
          section={SECTIONS[key]}
          title={title}
          data={form.sections[key] ?? null}
          defaults={key === 'basic_info' ? (form.defaults as FormValues) : undefined}
          onSaved={onChanged}
        />
      ))}
      <Card title="Upload medical records" description="Reports, lab results and scans for your doctor">
        <div className="space-y-6">
          <UploadBlock token={token} type="medical_record" label="Medical records" onUploaded={onChanged} />
          <div className="border-t" />
          <UploadBlock token={token} type="imaging" label="Imaging" onUploaded={onChanged} />
        </div>
      </Card>
    </div>
  );
}
