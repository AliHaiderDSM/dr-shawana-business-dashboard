import { Printer } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PrintLayoutProps {
  children: ReactNode;
  toolbar?: ReactNode;
  paper?: 'a4' | 'a5' | 'receipt';
  className?: string;
}

const widths = { a4: 'max-w-[210mm]', a5: 'max-w-[148mm]', receipt: 'max-w-[80mm]' };

export function PrintLayout({ children, toolbar, paper = 'a4', className }: PrintLayoutProps) {
  return (
    <div className="min-h-screen bg-muted/40 py-8 print:bg-background print:py-0">
      <div className={cn('no-print mx-auto mb-4 flex items-center justify-end gap-2 px-4', widths[paper])}>
        {toolbar}
        <Button onClick={() => window.print()}>
          <Printer />
          Print
        </Button>
      </div>
      <div
        className={cn(
          'print-area mx-auto rounded-lg border bg-card p-10 text-card-foreground shadow-sm print:rounded-none print:p-0',
          widths[paper],
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
