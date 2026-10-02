import type { FieldErrors, FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { errorMessage } from '@/components/shared/error-state';
import { ApiError } from './client';

export function toastError(error: unknown, fallback = 'Something went wrong') {
  toast.error(errorMessage(error) || fallback);
}

export function applyServerErrors<T extends FieldValues>(form: UseFormReturn<T>, error: unknown) {
  if (!(error instanceof ApiError)) return toastError(error);
  const fields = error.fieldErrors;
  const known = Object.keys(form.getValues());
  let placed = false;
  for (const [path, message] of Object.entries(fields)) {
    const root = path.split('.')[0] ?? path;
    if (known.includes(root)) {
      form.setError(path as Path<T>, { type: 'server', message });
      placed = true;
    }
  }
  if (!placed || error.status !== 400) toastError(error);
}

function firstError(errors: unknown, path: string[] = []): { path: string; message: string } | null {
  if (!errors || typeof errors !== 'object') return null;
  const node = errors as { message?: unknown; ref?: unknown };
  if (typeof node.message === 'string' && node.message)
    return { path: path.join('.'), message: node.message };
  for (const [key, value] of Object.entries(errors)) {
    if (key === 'ref' || key === 'type' || key === 'message') continue;
    const found = firstError(value, [...path, key]);
    if (found) return found;
  }
  return null;
}

export function toastInvalid(errors: FieldErrors) {
  const found = firstError(errors);
  toast.error(found ? `${found.message} (${found.path})` : 'Please check the form');
}
