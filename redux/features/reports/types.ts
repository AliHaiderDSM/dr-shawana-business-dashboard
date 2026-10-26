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

export interface ProfitFigures {
  invoiced: string;
  received: string;
  notReceived: string;
  refunds: string;
  revenue: string;
  cost: string;
  profit: string;
  margin: string | null;
}

export interface ProfitLossArgs {
  year: number;
  month: number | null;
  branchId: string | null;
}

export interface ProfitLossData {
  year: number;
  month: number | null;
  period: { from: string; to: string };
  branchId: string | null;
  summary: ProfitFigures & { sales: number; estimatedCostUnits: string; unknownCostUnits: string };
  months: (ProfitFigures & { month: string; label: string })[];
  products: (ProfitFigures & {
    product: string;
    qtySold: string;
    qtyReturned: string;
    listPrice: string | null;
    lastCost: string | null;
    avgSalePrice: string | null;
    avgCost: string | null;
    estimatedQty: string;
    unknownQty: string;
  })[];
  branches: (ProfitFigures & { code: string; name: string })[];
}
