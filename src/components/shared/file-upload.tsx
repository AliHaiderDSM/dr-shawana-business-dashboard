import { ClipboardPaste, FileText, ImagePlus, Loader2, Upload, X } from 'lucide-react';
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

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
let pasted = 0;

function named(file: File) {
  pasted += 1;
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  return new File([file], `pasted-${stamp}-${pasted}.${EXTENSIONS[file.type] ?? 'png'}`, { type: file.type });
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
  const full = disabled || files.length >= maxFiles;
  const latest = useRef({ files, full, add });

  function add(list: FileList | File[] | null) {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      const problem = validate(file, accept, maxBytes);
      if (problem) toast.error(problem);
      else if (next.length < maxFiles) next.push(file);
    }
    onChange(next);
  }

  useEffect(() => {
    latest.current = { files, full, add };
  });

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (latest.current.full) return;
      const images = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (images.length === 0) return;
      event.preventDefault();
      latest.current.add(images.map(named));
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  async function pasteFromClipboard() {
    if (!navigator.clipboard?.read) {
      toast.error('Press Ctrl+V to paste the copied image');
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      const images: File[] = [];
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) {
          const blob = await item.getType(type);
          images.push(named(new File([blob], 'image', { type: blob.type || type })));
        }
      }
      if (images.length === 0) toast.error('No image in the clipboard. Copy an image first.');
      else add(images);
    } catch {
      toast.error('Clipboard access was blocked. Press Ctrl+V to paste the image.');
    }
  }

  return (
    <div className="min-w-0 space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!full) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!full) add(e.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-5 text-center transition-colors',
          dragging && 'border-primary bg-primary-soft',
          full && 'opacity-60',
        )}
      >
        <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Upload className="size-5" />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">
            Drop files, choose them, or paste a copied image
          </p>
          <p className="text-xs text-muted-foreground">
            {accept.includes('application/pdf') ? 'Images or PDF' : 'Images'}, up to{' '}
            {Math.round(maxBytes / MB)} MB each, max {maxFiles}. Ctrl+V works too.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={full}
            onClick={() => inputRef.current?.click()}
          >
            <Upload />
            Choose files
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={full}
            onClick={() => void pasteFromClipboard()}
          >
            <ClipboardPaste />
            Paste image
          </Button>
        </div>
      </div>
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
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="group relative overflow-hidden rounded-lg border bg-muted"
            >
              {file.type.startsWith('image/') ? (
                <img
                  ref={(el) => previewInto(el, file)}
                  alt={file.name}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center text-muted-foreground">
                  <FileText className="size-8" />
                </div>
              )}
              <div className="border-t bg-card px-2 py-1 text-left">
                <p className="truncate text-xs font-medium text-foreground" title={file.name}>
                  {file.name}
                </p>
                <p className="text-[11px] text-muted-foreground">{sizeOf(file.size)}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-1 right-1 size-6 rounded-full shadow-sm"
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

function previewInto(el: HTMLImageElement | null, file: File) {
  if (!el) return;
  const url = URL.createObjectURL(file);
  el.src = url;
  return () => URL.revokeObjectURL(url);
}

function sizeOf(bytes: number) {
  return bytes < MB ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / MB).toFixed(1)} MB`;
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
