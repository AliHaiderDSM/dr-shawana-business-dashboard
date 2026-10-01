import { Check, Copy, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const SYMBOLS = '!@#$%*';

export function generatePassword(length = 12) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length]).join('');
  const symbol = SYMBOLS[(bytes[0] ?? 0) % SYMBOLS.length];
  return `${body.slice(0, length - 2)}${symbol}${(bytes[1] ?? 7) % 10}`;
}

export async function copyText(text: string, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error('Copy failed. Select the text and copy it manually.');
  }
}

interface SecretRevealProps {
  value: string;
  onRegenerate?: () => void;
  className?: string;
}

export function SecretReveal({ value, onRegenerate, className }: SecretRevealProps) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={cn('flex items-center gap-2 rounded-lg border bg-muted/50 p-1.5 pl-3', className)}>
      <code className="flex-1 truncate font-mono text-sm tracking-wide select-all">{value}</code>
      {onRegenerate ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onRegenerate}
          aria-label="Generate another"
        >
          <RefreshCw />
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={async () => {
          await copyText(value, 'Password copied');
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check /> : <Copy />}
        Copy
      </Button>
    </div>
  );
}
