import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Factory,
  FileHeart,
  FlaskConical,
  FolderTree,
  Gift,
  History,
  Landmark,
  LayoutDashboard,
  Package,
  PackageCheck,
  PackageSearch,
  Receipt,
  Scale,
  ScrollText,
  Shapes,
  ShoppingCart,
  Stethoscope,
  Tags,
  TestTubes,
  Truck,
  type LucideIcon,
  Undo2,
  UserCog,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react';
import type { Role } from '@/lib/api/types';

export type BranchScope = 'branch' | 'platform' | 'any';

export interface MenuItem {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  anyOf: string[];
  scope: BranchScope;
  phase?: string;
  superAdminOnly?: boolean;
  warehouseOnly?: boolean;
  roleLabels?: Partial<Record<Role, string>>;
}

export interface MenuGroup {
  label: string;
  items: MenuItem[];
  notInWarehouse?: boolean;
}

export const MENU: MenuGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        path: '/',
        icon: LayoutDashboard,
        anyOf: ['dashboard.view', 'branches.view'],
        scope: 'any',
      },
    ],
  },
  {
    label: 'Organization',
    items: [
      {
        key: 'branches',
        label: 'Branches',
        path: '/admin/branches',
        icon: Building2,
        anyOf: ['branches.view'],
        scope: 'platform',
        superAdminOnly: true,
      },
      {
        key: 'company',
        label: 'Company Info',
        path: '/admin/company',
        icon: Landmark,
        anyOf: ['company.view'],
        scope: 'platform',
        superAdminOnly: true,
      },
      {
        key: 'staff',
        label: 'Employees',
        path: '/staff',
        icon: UserCog,
        anyOf: ['staff.view'],
        scope: 'branch',
      },
    ],
  },
  {
    label: 'Patients & Care',
    notInWarehouse: true,
    items: [
      {
        key: 'patients',
        label: 'Customers',
        path: '/patients',
        icon: Users,
        anyOf: ['patients.view'],
        scope: 'branch',
      },
      {
        key: 'appointments',
        label: 'Appointments',
        path: '/appointments',
        icon: CalendarDays,
        anyOf: ['appointments.view'],
        scope: 'branch',
        roleLabels: { doctor: 'My Appointments' },
      },
      {
        key: 'doctors',
        label: 'Doctors',
        path: '/doctors',
        icon: Stethoscope,
        anyOf: ['doctors.view'],
        scope: 'branch',
      },
      {
        key: 'prescriptions',
        label: 'Prescriptions',
        path: '/prescriptions',
        icon: FileHeart,
        anyOf: ['prescriptions.view'],
        scope: 'branch',
      },
      {
        key: 'patient-history',
        label: 'Patient History',
        path: '/patient-history',
        icon: History,
        anyOf: ['consultations.view'],
        scope: 'branch',
      },
    ],
  },
  {
    label: 'Sales',
    notInWarehouse: true,
    items: [
      {
        key: 'sales-new',
        label: 'Add Sale',
        path: '/sales/new',
        icon: ShoppingCart,
        anyOf: ['sales.create'],
        scope: 'branch',
      },
      {
        key: 'sales',
        label: 'View Sales',
        path: '/sales',
        icon: Receipt,
        anyOf: ['sales.view'],
        scope: 'branch',
      },
      {
        key: 'delivery',
        label: 'Delivery Report',
        path: '/delivery-report',
        icon: Truck,
        anyOf: ['deliveryReport.view'],
        scope: 'branch',
      },
      {
        key: 'returns',
        label: 'Returns',
        path: '/returns',
        icon: Undo2,
        anyOf: ['returns.view'],
        scope: 'branch',
      },
    ],
  },
  {
    label: 'Catalog',
    items: [
      {
        key: 'categories',
        label: 'Categories',
        path: '/categories',
        icon: FolderTree,
        anyOf: ['categories.view'],
        scope: 'branch',
      },
      {
        key: 'products',
        label: 'Products',
        path: '/products',
        icon: Package,
        anyOf: ['products.view'],
        scope: 'branch',
      },
      {
        key: 'bundles',
        label: 'Bundles',
        path: '/bundles',
        icon: Gift,
        anyOf: ['bundles.view'],
        scope: 'branch',
      },
      {
        key: 'supply-chain',
        label: 'Supply Chain',
        path: '/supply-chain',
        icon: Truck,
        anyOf: ['suppliers.view'],
        scope: 'branch',
      },
    ],
  },
  {
    label: 'Inventory',
    items: [
      {
        key: 'stock',
        label: 'Stock',
        path: '/stock',
        icon: Warehouse,
        anyOf: ['stock.view'],
        scope: 'branch',
      },
      {
        key: 'labels',
        label: 'Labels',
        path: '/inventory/labels',
        icon: Tags,
        anyOf: ['stock.view', 'inventoryReport.view'],
        scope: 'branch',
      },
      {
        key: 'batches',
        label: 'Batches & Expiry',
        path: '/inventory/batches',
        icon: CalendarClock,
        anyOf: ['stock.view', 'inventoryReport.view'],
        scope: 'branch',
      },
      {
        key: 'stock-in',
        label: 'Stock In',
        path: '/stock-in',
        icon: ArrowDownToLine,
        anyOf: ['stock.view'],
        scope: 'branch',
      },
      {
        key: 'stock-out',
        label: 'Stock Out',
        path: '/stock-out',
        icon: ArrowUpFromLine,
        anyOf: ['stock.view'],
        scope: 'branch',
        warehouseOnly: true,
      },
      {
        key: 'inventory-report',
        label: 'Inventory Report',
        path: '/inventory-report',
        icon: PackageSearch,
        anyOf: ['inventoryReport.view'],
        scope: 'branch',
      },
    ],
  },
  {
    label: 'Manufacturing',
    items: [
      {
        key: 'materials',
        label: 'Materials',
        path: '/materials',
        icon: FlaskConical,
        anyOf: ['materials.view'],
        scope: 'branch',
      },
      {
        key: 'material-categories',
        label: 'Material Categories',
        path: '/material-categories',
        icon: Shapes,
        anyOf: ['materialCategories.view'],
        scope: 'branch',
      },
      {
        key: 'recipes',
        label: 'Product Recipes',
        path: '/recipes',
        icon: BookOpen,
        anyOf: ['recipes.view'],
        scope: 'branch',
      },
      {
        key: 'lab-transfers',
        label: 'Material Out to Lab',
        path: '/lab-transfers',
        icon: TestTubes,
        anyOf: ['labTransfers.view'],
        scope: 'branch',
      },
      {
        key: 'productions',
        label: 'Production',
        path: '/productions',
        icon: Factory,
        anyOf: ['production.view'],
        scope: 'branch',
      },
      {
        key: 'finished-goods',
        label: 'Finished Goods',
        path: '/finished-goods',
        icon: PackageCheck,
        anyOf: ['finishedGoods.view'],
        scope: 'branch',
      },
      {
        key: 'material-report',
        label: 'Material Report',
        path: '/material-report',
        icon: ClipboardList,
        anyOf: ['materialReport.view'],
        scope: 'branch',
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        key: 'banks',
        label: 'Banks',
        path: '/banks',
        icon: Landmark,
        anyOf: ['banks.view'],
        scope: 'branch',
      },
      {
        key: 'account-sheets',
        label: 'Account Sheets',
        path: '/account-sheets',
        icon: Wallet,
        anyOf: ['accounts.view'],
        scope: 'branch',
      },
      {
        key: 'accounts-balance',
        label: 'Accounts Balance',
        path: '/reports/accounts-balance',
        icon: Scale,
        anyOf: ['accounts.view'],
        scope: 'any',
      },
      {
        key: 'finance-report',
        label: 'Finance Report',
        path: '/reports/finance',
        icon: Landmark,
        anyOf: ['accounts.view'],
        scope: 'any',
      },
      {
        key: 'journal',
        label: 'General Entries',
        path: '/journal',
        icon: ScrollText,
        anyOf: ['journal.view'],
        scope: 'branch',
      },
      {
        key: 'expenses',
        label: 'Expenses',
        path: '/expenses',
        icon: Banknote,
        anyOf: ['expenses.view'],
        scope: 'branch',
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        key: 'reports',
        label: 'Reports',
        path: '/reports',
        icon: BarChart3,
        anyOf: ['reports.view'],
        scope: 'any',
      },
    ],
  },
];

export function visibleMenu(
  can: (permission: string) => boolean,
  isSuperAdmin: boolean,
  role?: Role,
  inWarehouse = false,
): MenuGroup[] {
  return MENU.filter((group) => !(inWarehouse && group.notInWarehouse))
    .map((group) => ({
      ...group,
      items: group.items
        .filter(
          (item) =>
            (!item.superAdminOnly || isSuperAdmin) &&
            (!item.warehouseOnly || inWarehouse) &&
            item.anyOf.some((p) => can(p)),
        )
        .map((item) => ({ ...item, label: (role && item.roleLabels?.[role]) ?? item.label })),
    }))
    .filter((group) => group.items.length > 0);
}

export function findMenuItem(pathname: string): MenuItem | undefined {
  const items = MENU.flatMap((g) => g.items);
  return (
    items.find((i) => i.path === pathname) ??
    items
      .filter((i) => i.path !== '/' && pathname.startsWith(`${i.path}/`))
      .sort((a, b) => b.path.length - a.path.length)[0]
  );
}
