import { Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '@/components/ui/input';
import { isSerial, normalizeSerial } from '@/features/inventory/constants';

export function LabelSearch() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  return (
    <form
      className="relative hidden md:block"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const code = value.trim();
        if (!code) return;
        void navigate(
          isSerial(code)
            ? `/inventory/labels/${normalizeSerial(code)}`
            : `/trace/${encodeURIComponent(code.toUpperCase())}`,
        );
        setValue('');
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Find a number or label"
        aria-label="Find an invoice, request, transfer, return, write-off number or a DSM label"
        title="Invoice, return, stock request, transfer, discount request, write-off number, or a DSM label"
        className="h-9 w-54 pl-8 placeholder:text-sm lg:w-64"
      />
    </form>
  );
}
