interface PeriodAmount {
  count?: number;
  amount?: string;
  bills?: number;
  qty?: string;
  revenue?: string;
}

export interface DashboardData {
  date: string;
  month: string;
  period: { from: string; to: string };
  scope: 'branch' | 'all_branches';
  counts: { patients: number; products: number };
  sales?: { today: PeriodAmount; month: PeriodAmount };
  pendingDeliveries?: number;
  appointments?: { today: PeriodAmount; month: PeriodAmount };
  revenueSplit?: { month: string; sales: string; consultations: string };
  stock?: {
    today: { stockIn: string; stockOut: string };
    month: { stockIn: string; stockOut: string };
    lowStockCount: number;
  };
  charts: {
    year: number;
    months: string[];
    salesAmount?: string[];
    appointmentAmount?: string[];
    productSales?: { product: string; qty: string[] }[];
  };
  byBranch?: { branch: string; name: string; salesMonth: string; appointmentsMonth: string }[];
}

export type TopProductsRange = 'today' | 'month' | 'year';

export interface TopProductsData {
  range: TopProductsRange;
  from: string;
  to: string;
  items: { product: string; qty: string }[];
}

export interface DashboardPeriod {
  from?: string;
  to?: string;
}

export interface DashboardArgs {
  year: number;
  from: string | null;
  to: string | null;
}
