import { FileText, ImagePlus, Loader2, Upload, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { toastError } from '@/lib/api/errors';
import { cn } from '@/lib/utils';

const MB = 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const DOCUMENT_TYPES = [...IMAGE_TYPES, 'application/pdf'];

function validate(file: File, accept: string[], maxBytes: number) {
  if (!accept.includes(file.type)) return `${file.name}: this file type is not allowed`;
  if (file.size > maxBytes) return `${file.name}: larger than ${Math.round(maxBytes / MB)} MB`;
  return null;
}

interface ImageUploadProps {
  value?: string | null;
  onUpload: (file: File) => Promise<unknown>;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function ImageUpload({ value, onUpload, disabled, label = 'Image', className }: ImageUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function handle(file: File | undefined) {
    if (!file) return;
    const problem = validate(file, IMAGE_TYPES, 5 * MB);
    if (problem) {
      toast.error(problem);
      return;
    }
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      await onUpload(file);
      toast.success(`${label} updated`);
    } catch (error) {
      setPreview(null);
      toastError(error);
    } finally {
      setBusy(false);
    }
  }

  const shown = preview ?? value;

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div
        className={cn(
          'relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted text-muted-foreground transition-colors',
          dragging && 'border-primary bg-primary-soft',
        )}
        onDragOver={(e: DragEvent) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e: DragEvent) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) void handle(e.dataTransfer.files[0]);
        }}
      >
        {shown ? (
          <img src={shown} alt="" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-6" />
        )}
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={IMAGE_TYPES.join(',')}
          className="sr-only"
          onChange={(e) => {
            void handle(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload />
          {shown ? 'Replace' : 'Upload'} {label.toLowerCase()}
        </Button>
        <p className="text-xs text-muted-foreground">
          JPG, PNG or WebP, up to 5 MB. You can also drop a file.
        </p>
      </div>
    </div>
  );
}

interface FilePickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string[];
  maxFiles?: number;
  maxBytes?: number;
  disabled?: boolean;
}

export function FilePicker({
  files,
  onChange,
  accept = DOCUMENT_TYPES,
  maxFiles = 5,
  maxBytes = 10 * MB,
  disabled,
}: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function add(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      const problem = validate(file, accept, maxBytes);
      if (problem) toast.error(problem);
      else if (next.length < maxFiles) next.push(file);
    }
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled || files.length >= maxFiles}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          'flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-border-strong hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60',
          dragging && 'border-primary bg-primary-soft',
        )}
      >
        <Upload className="size-5" />
        <span className="font-medium text-foreground">Click or drop files</span>
        <span className="text-xs">
          Images or PDF, up to {Math.round(maxBytes / MB)} MB each, max {maxFiles}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept.join(',')}
        className="sr-only"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = '';
        }}
      />
      {files.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center gap-3 px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="text-xs text-muted-foreground">{(file.size / MB).toFixed(1)} MB</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`Remove ${file.name}`}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

interface SignedFileButtonProps {
  name: string;
  getUrl: () => Promise<{ url: string }>;
}

export function SignedFileButton({ name, getUrl }: SignedFileButtonProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto gap-1.5 p-0"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { url } = await getUrl();
          window.open(url, '_blank', 'noopener,noreferrer');
        } catch (error) {
          toastError(error);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <FileText />}
      {name}
    </Button>
  );
}
