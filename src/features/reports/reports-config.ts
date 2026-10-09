import {
  BarChart3,
  CalendarCheck,
  ClipboardList,
  HandCoins,
  History,
  Landmark,
  type LucideIcon,
  Package,
  Receipt,
  Scale,
  Stethoscope,
  Truck,
  Wallet,
} from 'lucide-react';
import type { Role } from '@/lib/api/types';

export type OptionSource =
  'doctors' | 'products' | 'categories' | 'suppliers' | 'accounts' | 'staff' | 'expenseCategories';

export type ReportFilter =
  | { kind: 'enum'; key: string; label: string; options: readonly { value: string; label: string }[] }
  | { kind: 'source'; key: string; label: string; source: OptionSource }
  | { kind: 'text'; key: string; label: string }
  | { kind: 'date'; key: string; label: string }
  | { kind: 'patient'; key: string; label: string };

export interface ReportDef {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  group: 'Sales' | 'Clinic' | 'Inventory' | 'Finance';
  allowed: (can: (permission: string) => boolean, role: Role | undefined) => boolean;
  filters: ReportFilter[];
  path?: string;
  columnsMenu?: boolean;
}

const roles =
  (...list: Role[]) =>
  (_can: (p: string) => boolean, role: Role | undefined) =>
    role === 'super_admin' || (role !== undefined && list.includes(role));
const permission = (name: string) => (can: (p: string) => boolean) => can(name);

const SALE_TYPE = {
  kind: 'enum',
  key: 'saleType',
  label: 'Sale type',
  options: [
    { value: 'office', label: 'Office' },
    { value: 'online', label: 'Online' },
  ],
} as const;
const METHOD = {
  kind: 'enum',
  key: 'method',
  label: 'Method',
  options: [
    { value: 'cash', label: 'Cash' },
    { value: 'online', label: 'Online' },
  ],
} as const;
const STATUS = {
  kind: 'enum',
  key: 'status',
  label: 'Status',
  options: [
    { value: 'booked', label: 'Booked' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ],
} as const;
const MODE = {
  kind: 'enum',
  key: 'mode',
  label: 'Online / physical',
  options: [
    { value: 'online', label: 'Online' },
    { value: 'physical', label: 'Physical' },
  ],
} as const;
const VISIT = {
  kind: 'enum',
  key: 'visitType',
  label: 'Type',
  options: [
    { value: 'new', label: 'New' },
    { value: 'followup', label: 'Follow up' },
  ],
} as const;
const BHRT = {
  kind: 'enum',
  key: 'bhrtStatus',
  label: 'BHRT',
  options: [
    { value: 'on', label: 'On' },
    { value: 'off', label: 'Off' },
    { value: 'recommended', label: 'Recommended' },
    { value: 'none', label: 'None' },
  ],
} as const;
const source = (key: string, label: string, from: OptionSource): ReportFilter => ({
  kind: 'source',
  key,
  label,
  source: from,
});

export const REPORTS: ReportDef[] = [
  {
    key: 'delivery-report',
    title: 'Print delivery report',
    description: 'Monthly delivery report',
    icon: Truck,
    group: 'Sales',
    allowed: permission('deliveryReport.view'),
    filters: [],
    path: '/delivery-report',
  },
  {
    key: 'sale-products',
    title: 'Sale products',
    description: 'Monthly sale report of completed sales only.',
    icon: Receipt,
    group: 'Sales',
    allowed: permission('sales.view'),
    filters: [
      { kind: 'text', key: 'customer', label: 'Customer or phone' },
      { kind: 'text', key: 'patientCity', label: 'Customer city' },
      source('productId', 'Product', 'products'),
      SALE_TYPE,
      { kind: 'text', key: 'city', label: 'Sale city' },
      METHOD,
      source('accountSheetId', 'Account', 'accounts'),
      source('createdBy', 'Staff', 'staff'),
      { kind: 'date', key: 'createdFrom', label: 'Entry date from' },
      { kind: 'date', key: 'createdTo', label: 'Entry date to' },
    ],
  },
  {
    key: 'doctor-sales',
    title: 'Doctor sales',
    description: 'Sales credited to each doctor with their commission.',
    icon: Stethoscope,
    group: 'Sales',
    allowed: roles('branch_admin', 'accountant', 'doctor'),
    filters: [source('doctorId', 'Doctor', 'doctors'), source('productId', 'Product', 'products')],
  },
  {
    key: 'appointments',
    title: 'Appointments',
    description: 'Bookings by doctor, status, mode and BHRT.',
    icon: CalendarCheck,
    group: 'Clinic',
    allowed: permission('appointments.view'),
    filters: [source('doctorId', 'Doctor', 'doctors'), STATUS, MODE, VISIT, BHRT, METHOD],
  },
  {
    key: 'appointment-payments',
    title: 'Appointment payments',
    description: 'Money received for appointments.',
    icon: HandCoins,
    group: 'Clinic',
    allowed: permission('appointmentPayments.view'),
    filters: [
      source('doctorId', 'Doctor', 'doctors'),
      STATUS,
      MODE,
      METHOD,
      source('accountSheetId', 'Account', 'accounts'),
    ],
  },
  {
    key: 'patient-history',
    title: 'Patient history',
    description:
      'posSoft patient history: every visit with BMI, menopause status, each MRS answer and score, labs and treatments.',
    icon: History,
    group: 'Clinic',
    allowed: permission('consultations.view'),
    filters: [{ kind: 'patient', key: 'patientId', label: 'Patient' }],
    columnsMenu: false,
  },
  {
    key: 'purchases',
    title: 'Purchases',
    description: 'Products bought in, by supplier and category.',
    icon: Package,
    group: 'Inventory',
    allowed: roles('branch_admin', 'accountant'),
    filters: [
      source('supplierId', 'Supplier', 'suppliers'),
      source('categoryId', 'Category', 'categories'),
      source('productId', 'Product', 'products'),
    ],
  },
  {
    key: 'stock',
    title: 'Stock',
    description: 'Opening, in, out and closing stock per product.',
    icon: ClipboardList,
    group: 'Inventory',
    allowed: roles('branch_admin', 'accountant'),
    filters: [source('categoryId', 'Category', 'categories'), source('productId', 'Product', 'products')],
  },
  {
    key: 'branch-stock',
    title: 'Branch stock',
    description: 'Per branch and product: stock received, sold, returned and now in the branch.',
    icon: Package,
    group: 'Inventory',
    allowed: roles('branch_admin', 'accountant'),
    filters: [source('productId', 'Product', 'products')],
  },
  {
    key: 'finance',
    title: 'Finance',
    description: 'Every movement in and out of the accounts.',
    icon: Landmark,
    group: 'Finance',
    allowed: permission('accounts.view'),
    filters: [
      source('accountSheetId', 'Account', 'accounts'),
      {
        kind: 'enum',
        key: 'source',
        label: 'Journal source',
        options: [
          { value: 'manual', label: 'Manual' },
          { value: 'expense', label: 'Expense' },
        ],
      },
    ],
  },
  {
    key: 'accounts-balance',
    title: 'Accounts balance',
    description: 'Opening, in, out and closing balance of every account.',
    icon: Scale,
    group: 'Finance',
    allowed: permission('accounts.view'),
    filters: [source('accountSheetId', 'Account', 'accounts')],
  },
  {
    key: 'expenses',
    title: 'Expenses',
    description: 'Spending by category and account.',
    icon: Wallet,
    group: 'Finance',
    allowed: permission('expenses.view'),
    filters: [
      source('categoryId', 'Category', 'expenseCategories'),
      source('accountSheetId', 'Account', 'accounts'),
    ],
  },
];

export const REPORT_ICON = BarChart3;

export function findReport(key: string | undefined) {
  return REPORTS.find((r) => r.key === key);
}
