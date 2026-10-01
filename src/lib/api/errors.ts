import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
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
