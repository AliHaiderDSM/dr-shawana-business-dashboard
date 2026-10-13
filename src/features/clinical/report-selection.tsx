import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { MAX_REPORT_FILES } from './prepare-report-files';

export const READABLE_RECORD_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

interface ReportSelection {
  selected: string[];
  toggle: (fileId: string, checked: boolean) => void;
  clear: () => void;
}

const Context = createContext<ReportSelection | null>(null);

export function ReportSelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = useCallback((fileId: string, checked: boolean) => {
    setSelected((current) => {
      if (!checked) return current.filter((id) => id !== fileId);
      if (current.includes(fileId)) return current;
      if (current.length >= MAX_REPORT_FILES) {
        toast.error(`Choose up to ${MAX_REPORT_FILES} reports at a time.`);
        return current;
      }
      return [...current, fileId];
    });
  }, []);
  const clear = useCallback(() => setSelected([]), []);
  const value = useMemo(() => ({ selected, toggle, clear }), [selected, toggle, clear]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useReportSelection() {
  return useContext(Context);
}
