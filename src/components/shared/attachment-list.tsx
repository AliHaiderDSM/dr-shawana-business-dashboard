import { FileImage, FileText, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toastError } from '@/lib/api/errors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface StoredFile {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes?: number;
  createdAt?: string;
}

interface AttachmentListProps {
  files: StoredFile[];
  getUrl: (file: StoredFile) => Promise<{ url: string }>;
  onRemove?: (file: StoredFile) => Promise<unknown>;
  emptyText?: string;
  className?: string;
}

const MB = 1024 * 1024;

function fileSize(bytes?: number) {
  if (!bytes) return null;
  return bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export async function openSignedUrl(getUrl: () => Promise<{ url: string }>) {
  const preview = window.open('', '_blank');
  try {
    const { url } = await getUrl();
    if (preview) preview.location.href = url;
    else window.open(url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    preview?.close();
    toastError(error);
  }
}

export function AttachmentList({ files, getUrl, onRemove, emptyText, className }: AttachmentListProps) {
  const [busy, setBusy] = useState<string | null>(null);

  if (files.length === 0) {
    return emptyText ? <p className={cn('text-sm text-muted-foreground', className)}>{emptyText}</p> : null;
  }

  return (
    <ul className={cn('divide-y rounded-lg border', className)}>
      {files.map((file) => {
        const Icon = file.contentType.startsWith('image/') ? FileImage : FileText;
        const meta = [fileSize(file.sizeBytes), file.createdAt ? formatDate(file.createdAt) : null]
          .filter(Boolean)
          .join(' · ');
        return (
          <li key={file.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left font-medium text-primary hover:underline"
              onClick={() => void openSignedUrl(() => getUrl(file))}
            >
              {file.originalName}
            </button>
            {meta ? <span className="shrink-0 text-xs text-muted-foreground">{meta}</span> : null}
            {onRemove ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${file.originalName}`}
                disabled={busy === file.id}
                onClick={async () => {
                  setBusy(file.id);
                  try {
                    await onRemove(file);
                  } catch (error) {
                    toastError(error);
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {busy === file.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
