import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, FileImage, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { openSignedUrl } from '@/components/shared/attachment-list';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api, unwrap, uploadForm } from '@/lib/api/client';
import { toastError } from '@/lib/api/errors';
import type { Schemas } from '@/lib/api/types';
import { formatDate, formatSize } from '@/lib/format';

type Resource = Schemas['EducationalResource'];
type ResourceFile = Resource['files'][number];

const KEY = ['educational-resources'];
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;

function useResources() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => unwrap(api.GET('/admin/educational-resources')).then((r) => r.data),
  });
}

function fileUrl(id: string) {
  return unwrap(api.GET('/admin/educational-resources/files/{id}/url', { params: { path: { id } } })).then(
    (r) => r.data,
  );
}

function ResourceCard({
  resource,
  onRemove,
}: {
  resource: Resource;
  onRemove: (file: ResourceFile) => void;
}) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (files: File[]) => {
      const form = new FormData();
      for (const file of files) form.append('files', file);
      return uploadForm<Resource>(`/admin/educational-resources/${resource.key}/files`, form);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });

  const choose = (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (input.current) input.current.value = '';
    if (files.length === 0) return;
    if (files.length > MAX_FILES) {
      toast.error(`Choose at most ${MAX_FILES} files at a time.`);
      return;
    }
    const big = files.find((f) => f.size > MAX_BYTES);
    if (big) {
      toast.error(`${big.name} is larger than 10 MB.`);
      return;
    }
    upload
      .mutateAsync(files)
      .then(() => toast.success(`${files.length === 1 ? 'File' : 'Files'} added to ${resource.label}`))
      .catch(toastError);
  };

  return (
    <section className="flex flex-col rounded-xl border bg-card shadow-xs">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
            <BookOpen className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{resource.label}</h2>
            <p className="text-xs text-muted-foreground">
              {resource.files.length
                ? `${resource.files.length} ${resource.files.length === 1 ? 'file' : 'files'}`
                : 'No file yet: patients see "Guide coming soon"'}
            </p>
          </div>
        </div>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => choose(e.target.files)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={upload.isPending}
          onClick={() => input.current?.click()}
        >
          {upload.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
          Add files
        </Button>
      </header>
      {resource.files.length ? (
        <ul className="divide-y">
          {resource.files.map((file) => {
            const Icon = file.type.startsWith('image/') ? FileImage : FileText;
            return (
              <li key={file.id} className="flex items-center gap-3 px-4 py-2.5">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => void openSignedUrl(() => fileUrl(file.id))}
                  className="min-w-0 flex-1 truncate text-left text-sm font-medium text-primary hover:underline"
                >
                  {file.name}
                </button>
                <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
                  {formatSize(file.size)} · {formatDate(file.createdAt)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => onRemove(file)}
                >
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          Add a PDF or photos of this guide.
        </p>
      )}
    </section>
  );
}

export function EducationalResourcesPage() {
  const queryClient = useQueryClient();
  const resources = useResources();
  const [removing, setRemoving] = useState<ResourceFile | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/admin/educational-resources/files/{id}', { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });

  return (
    <>
      <PageHeader
        title="Educational resources"
        description="Upload each guide once. When a doctor marks it Yes in a consultation, the patient can open these files in the app."
      />
      {resources.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : resources.error ? (
        <ErrorState error={resources.error} onRetry={() => void resources.refetch()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(resources.data ?? []).map((resource) => (
            <ResourceCard key={resource.key} resource={resource} onRemove={setRemoving} />
          ))}
        </div>
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => (open ? undefined : setRemoving(null))}
        title="Remove this file?"
        description={removing ? `${removing.name} will no longer open for patients.` : undefined}
        confirmLabel="Remove"
        destructive
        onConfirm={() =>
          removing &&
          remove
            .mutateAsync(removing.id)
            .then(() => {
              toast.success('File removed');
              setRemoving(null);
            })
            .catch(toastError)
        }
      />
    </>
  );
}
