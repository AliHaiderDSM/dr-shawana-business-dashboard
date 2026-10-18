export type ReportValue = string | number | boolean | null;
export interface ReportData {
  title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, ReportValue>[];
  totals?: Record<string, ReportValue>;
  byBranch?: Record<string, ReportValue>[];
  summary?: Record<string, ReportValue>;
}

export interface ReportArgs {
  key: string;
  query: Record<string, string>;
}
