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

export type AppointmentMoneyState = 'unpaid' | 'advance' | 'paid' | 'cancelled' | 'held' | 'refunded';
export type AppointmentMoneyKind = 'booked' | 'advance' | 'balance' | 'refund';

export interface AppointmentMoneyEntry {
  sr: number;
  id: string;
  kind: AppointmentMoneyKind;
  date: string;
  amount: string;
  method: string | null;
  account: string | null;
  appointment: {
    id: string;
    appointmentNo: number;
    visitDate: string;
    bookedOn: string;
    status: string;
    fee: string;
  };
  patient: { name: string | null; phone: string | null };
  doctor: string | null;
  branch: { code: string; name: string };
  paidAfter: string;
  refundedAfter: string;
  remainingAfter: string;
  stateAfter: AppointmentMoneyState;
  fullyPaidHere: boolean;
}

export interface AppointmentMoneyLedger {
  from: string;
  to: string;
  branchId: string | null;
  summary: {
    bookings: number;
    advance: number;
    advanceAmount: string;
    balance: number;
    balanceAmount: string;
    refunds: number;
    refundAmount: string;
    collected: string;
    net: string;
    fullyPaid: number;
  };
  rows: AppointmentMoneyEntry[];
}
