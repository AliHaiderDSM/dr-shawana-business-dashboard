import { Loader2, ScanLine } from 'lucide-react';
import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface BarcodeScanInputProps {
  onScan: (code: string) => Promise<unknown>;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function BarcodeScanInput({
  onScan,
  placeholder = 'Scan a barcode or type it and press Enter',
  className,
  autoFocus,
}: BarcodeScanInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const code = value.trim();
    if (!code || busy) return;
    setBusy(true);
    try {
      await onScan(code);
    } finally {
      setValue('');
      setBusy(false);
      ref.current?.focus();
    }
  };

  return (
    <div className={cn('relative', className)}>
      {busy ? (
        <Loader2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <ScanLine className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary" />
      )}
      <Input
        ref={ref}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        aria-label="Scan barcode"
        placeholder={placeholder}
        className="h-10 border-primary/40 pl-9 font-mono tracking-wide"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void submit();
          }
        }}
      />
    </div>
  );
}
