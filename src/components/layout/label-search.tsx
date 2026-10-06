import { Tag } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '@/components/ui/input';
import { normalizeSerial } from '@/features/inventory/api';

export function LabelSearch() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  return (
    <form
      className="relative hidden md:block"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        if (!value.trim()) return;
        void navigate(`/inventory/labels/${normalizeSerial(value)}`);
        setValue('');
      }}
    >
      <Tag className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Find label, e.g. DSM-000060"
        aria-label="Find a piece by its DSM label"
        className="h-9 w-54 pl-8 placeholder:text-sm lg:w-64"
      />
    </form>
  );
}
