import { AlertTriangle, Lock, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError && /fetch|network/i.test(error.message))
    return 'Could not reach the server. Check your connection and that the API is running, then try again.';
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}

export function ForbiddenState({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-warning-soft text-warning-soft-foreground">
        <Lock className="size-5" />
      </div>
      <h3 className="text-sm font-semibold">You don't have access to this</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Your role does not include this screen or action. Ask your branch admin if you need it.
      </p>
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: ErrorStateProps) {
  if (error instanceof ApiError && error.status === 403) return <ForbiddenState className={className} />;
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-destructive-soft text-destructive-soft-foreground">
        <AlertTriangle className="size-5" />
      </div>
      <h3 className="text-sm font-semibold">Couldn't load this</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{errorMessage(error)}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          <RotateCw />
          Try again
        </Button>
      ) : null}
    </div>
  );
}
