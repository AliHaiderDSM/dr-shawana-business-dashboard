import {
  PackageX,
  BadgePercent,
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
  MessageSquareText,
  MessagesSquare,
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
  doctorOnly?: boolean;
  warehouseOnly?: boolean;
  showInWarehouse?: boolean;
  dispatchOnly?: boolean;
  notInDispatch?: boolean;
  roleLabels?: Partial<Record<Role, string>>;
  badge?:
    | 'stockRequests'
    | 'incomingStock'
    | 'writeOffs'
    | 'discountRequests'
    | 'returns'
    | 'stockReceipts'
    | 'patientRequests'
    | 'patientMessages';
}

export interface MenuGroup {
  label: string;
  items: MenuItem[];
  notInWarehouse?: boolean;
  notInDispatch?: boolean;
}

const LAB_OFFICER_KEYS = new Set(['dashboard', 'stock-in', 'store-receipts', 'labels', 'inventory-report']);

const WAREHOUSE_KEEPER_KEYS = new Set([
  'dashboard',
  'store-receipts',
  'stock-requests',
  'stock-out',
  'stock-out-report',
  'inventory-report',
  'incoming-stock',
  'stock',
  'batches',
  'labels',
]);

const DISPATCHER_KEYS = new Set([
  'dashboard',
  'deliveries',
  'delivery',
  'returns',
  'write-offs',
  'stock',
  'labels',
]);

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
        scope: 'any',
      },
    ],
  },
  {
    label: 'Patients & Care',
    notInWarehouse: true,
    notInDispatch: true,
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
        key: 'messages',
        badge: 'patientMessages',
        label: 'Patient Messages',
        path: '/messages',
        icon: MessagesSquare,
        anyOf: ['consultations.view'],
        scope: 'any',
        doctorOnly: true,
      },
      {
        key: 'patient-requests',
        badge: 'patientRequests',
        label: 'Patient Requests',
        path: '/patient-requests',
        icon: MessageSquareText,
        anyOf: ['patients.view'],
        scope: 'any',
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
        notInDispatch: true,
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
        showInWarehouse: true,
        notInDispatch: true,
      },
      {
        key: 'discount-requests',
        badge: 'discountRequests',
        label: 'Discount Requests',
        path: '/discount-requests',
        icon: BadgePercent,
        anyOf: ['sales.view'],
        scope: 'any',
        notInDispatch: true,
        showInWarehouse: true,
      },
      {
        key: 'deliveries',
        label: 'Deliveries',
        path: '/deliveries',
        icon: CalendarClock,
        anyOf: ['sales.view'],
        scope: 'branch',
        dispatchOnly: true,
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
        badge: 'returns',
        label: 'Returns',
        path: '/returns',
        icon: Undo2,
        anyOf: ['returns.view'],
        scope: 'any',
        showInWarehouse: true,
      },
    ],
  },
  {
    label: 'Catalog',
    notInDispatch: true,
    items: [
      {
        key: 'categories',
        label: 'Categories',
        path: '/categories',
        icon: FolderTree,
        anyOf: ['categories.view'],
        scope: 'branch',
        superAdminOnly: true,
      },
      {
        key: 'products',
        label: 'Products',
        path: '/products',
        icon: Package,
        anyOf: ['products.view'],
        scope: 'branch',
        superAdminOnly: true,
      },
      {
        key: 'bundles',
        label: 'Bundles',
        path: '/bundles',
        icon: Gift,
        anyOf: ['bundles.view'],
        scope: 'branch',
        superAdminOnly: true,
      },
      {
        key: 'supply-chain',
        label: 'Supply Chain',
        path: '/supply-chain',
        icon: Truck,
        anyOf: ['suppliers.view'],
        scope: 'branch',
        superAdminOnly: true,
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
        key: 'store-receipts',
        badge: 'stockReceipts',
        label: 'Store Receipts',
        path: '/store-receipts',
        icon: PackageCheck,
        anyOf: ['stock.view'],
        scope: 'branch',
        warehouseOnly: true,
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
        key: 'stock-out-report',
        label: 'Stock Out Report',
        path: '/stock-out-report',
        icon: ScrollText,
        anyOf: ['stock.view', 'inventoryReport.view'],
        scope: 'any',
        warehouseOnly: true,
      },
      {
        key: 'stock-requests',
        badge: 'stockRequests',
        label: 'Stock Requests',
        path: '/stock-requests',
        icon: ClipboardList,
        anyOf: ['stock.view', 'inventoryReport.view'],
        scope: 'any',
      },
      {
        key: 'incoming-stock',
        badge: 'incomingStock',
        label: 'Incoming Stock',
        roleLabels: { warehouse_keeper: 'Outgoing Stock', super_admin: 'Outgoing Stock' },
        path: '/incoming-stock',
        icon: PackageCheck,
        anyOf: ['stock.view', 'inventoryReport.view'],
        scope: 'any',
      },
      {
        key: 'write-offs',
        badge: 'writeOffs',
        label: 'Write-offs',
        path: '/write-offs',
        icon: PackageX,
        anyOf: ['stock.view', 'inventoryReport.view'],
        scope: 'any',
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
    notInDispatch: true,
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
    notInDispatch: true,
    items: [
      {
        key: 'account-sheets',
        label: 'Bank & Cash Accounts',
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
  dispatch: { inDispatch: boolean; hasDispatch: boolean } = { inDispatch: false, hasDispatch: false },
): MenuGroup[] {
  const keeperOnly = role === 'warehouse_keeper';
  const labOnly = role === 'lab_officer';
  const dispatcherOnly = role === 'dispatcher';
  return MENU.map((group) => ({
    ...group,
    items: group.items
      .filter(
        (item) =>
          (!keeperOnly || WAREHOUSE_KEEPER_KEYS.has(item.key)) &&
          (!labOnly || LAB_OFFICER_KEYS.has(item.key)) &&
          (!dispatcherOnly || DISPATCHER_KEYS.has(item.key)) &&
          !((dispatch.inDispatch || role === 'dispatcher') && (group.notInDispatch || item.notInDispatch)) &&
          (!item.dispatchOnly || dispatch.inDispatch || !dispatch.hasDispatch) &&
          (!item.superAdminOnly || isSuperAdmin) &&
          (!item.doctorOnly || role === 'doctor') &&
          (!item.warehouseOnly || inWarehouse) &&
          (!(inWarehouse && group.notInWarehouse) || item.showInWarehouse) &&
          item.anyOf.some((p) => can(p)),
      )
      .map((item) => ({ ...item, label: (role && item.roleLabels?.[role]) ?? item.label })),
  })).filter((group) => group.items.length > 0);
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
