import { Loader2 } from 'lucide-react';
import type { FormEventHandler, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface FormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  onSubmit: FormEventHandler<HTMLFormElement>;
  submitting?: boolean;
  submitLabel?: string;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  submitting,
  submitLabel = 'Save',
  children,
  size = 'md',
}: FormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <SheetContent
        className={cn(
          'flex w-full flex-col gap-0 p-0',
          { md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-5xl' }[size],
        )}
      >
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle className="text-base">{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">{children}</div>
          <SheetFooter className="flex-row justify-end gap-2 border-t bg-muted/30 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              {submitLabel}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
