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
  Wallet,
} from 'lucide-react';
import type { Role } from '@/lib/api/types';

export type OptionSource =
  'doctors' | 'products' | 'categories' | 'suppliers' | 'accounts' | 'staff' | 'expenseCategories';

export type ReportFilter =
  | { kind: 'enum'; key: string; label: string; options: readonly { value: string; label: string }[] }
  | { kind: 'source'; key: string; label: string; source: OptionSource }
  | { kind: 'text'; key: string; label: string };

export interface ReportDef {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  group: 'Sales' | 'Clinic' | 'Inventory' | 'Finance';
  allowed: (can: (permission: string) => boolean, role: Role | undefined) => boolean;
  filters: ReportFilter[];
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
    key: 'sale-products',
    title: 'Sale products',
    description: 'Every product sold, with quantity, price and customer.',
    icon: Receipt,
    group: 'Sales',
    allowed: permission('sales.view'),
    filters: [
      SALE_TYPE,
      METHOD,
      source('productId', 'Product', 'products'),
      source('accountSheetId', 'Account', 'accounts'),
      source('createdBy', 'Staff', 'staff'),
      { kind: 'text', key: 'city', label: 'City' },
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
    description: 'Visits with BMI, menopause stage, MRS and key labs.',
    icon: History,
    group: 'Clinic',
    allowed: roles('branch_admin', 'accountant'),
    filters: [source('doctorId', 'Doctor', 'doctors')],
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
