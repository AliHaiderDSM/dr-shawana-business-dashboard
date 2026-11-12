import { useEffect } from 'react';

export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export const prescriptionFileName = (patientName: string | null | undefined) =>
  patientName?.trim() ? `${patientName.trim()} - Prescription slip` : null;
