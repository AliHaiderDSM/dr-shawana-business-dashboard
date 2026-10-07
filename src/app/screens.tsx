import { lazy, type ComponentType, type ReactNode } from 'react';

export interface ScreenRoute {
  path: string;
  element: ReactNode;
  anyOf: string[];
  scope: 'branch' | 'platform' | 'any';
}

function page<K extends string, T extends Record<K, ComponentType>>(loader: () => Promise<T>, name: K) {
  const Component = lazy(() => loader().then((module) => ({ default: module[name] as ComponentType })));
  return <Component />;
}

const anyStaff = ['dashboard.view', 'branches.view', 'deliveryReport.view'];

export const screenRoutes: ScreenRoute[] = [
  {
    path: 'profile',
    element: page(() => import('@/features/profile/profile-page'), 'ProfilePage'),
    anyOf: anyStaff,
    scope: 'any',
  },
  {
    path: 'admin/branches',
    element: page(() => import('@/features/branches/branches-page'), 'BranchesPage'),
    anyOf: ['branches.view'],
    scope: 'platform',
  },
  {
    path: 'admin/branches/:id',
    element: page(() => import('@/features/branches/branch-detail-page'), 'BranchDetailPage'),
    anyOf: ['branches.view'],
    scope: 'platform',
  },
  {
    path: 'admin/company',
    element: page(() => import('@/features/company/company-page'), 'CompanyPage'),
    anyOf: ['company.view'],
    scope: 'platform',
  },
  {
    path: 'staff',
    element: page(() => import('@/features/staff/staff-page'), 'StaffPage'),
    anyOf: ['staff.view'],
    scope: 'branch',
  },
  {
    path: 'categories',
    element: page(() => import('@/features/catalog/categories-page'), 'CategoriesPage'),
    anyOf: ['categories.view'],
    scope: 'branch',
  },
  {
    path: 'products',
    element: page(() => import('@/features/catalog/products-page'), 'ProductsPage'),
    anyOf: ['products.view'],
    scope: 'branch',
  },
  {
    path: 'products/:id',
    element: page(() => import('@/features/catalog/product-detail-page'), 'ProductDetailPage'),
    anyOf: ['products.view'],
    scope: 'branch',
  },
  {
    path: 'bundles',
    element: page(() => import('@/features/catalog/bundles-page'), 'BundlesPage'),
    anyOf: ['bundles.view'],
    scope: 'branch',
  },
  {
    path: 'supply-chain',
    element: page(() => import('@/features/catalog/supply-chain-page'), 'SupplyChainPage'),
    anyOf: ['suppliers.view'],
    scope: 'branch',
  },
  {
    path: 'banks',
    element: page(() => import('@/features/finance/banks-page'), 'BanksPage'),
    anyOf: ['banks.view'],
    scope: 'branch',
  },
  {
    path: 'account-sheets',
    element: page(() => import('@/features/finance/account-sheets-page'), 'AccountSheetsPage'),
    anyOf: ['accounts.view'],
    scope: 'branch',
  },
  {
    path: 'stock',
    element: page(() => import('@/features/inventory/stock-page'), 'StockPage'),
    anyOf: ['stock.view'],
    scope: 'branch',
  },
  {
    path: 'stock/:productId',
    element: page(() => import('@/features/inventory/stock-ledger-page'), 'StockLedgerPage'),
    anyOf: ['stock.view', 'inventoryReport.view'],
    scope: 'branch',
  },
  {
    path: 'inventory/labels',
    element: page(() => import('@/features/inventory/labels-page'), 'LabelsPage'),
    anyOf: ['stock.view', 'inventoryReport.view'],
    scope: 'branch',
  },
  {
    path: 'inventory/labels/:serial',
    element: page(() => import('@/features/inventory/labels-page'), 'LabelDetailPage'),
    anyOf: ['stock.view', 'inventoryReport.view', 'sales.create', 'returns.create'],
    scope: 'branch',
  },
  {
    path: 'inventory/batches',
    element: page(() => import('@/features/inventory/batches-page'), 'BatchesPage'),
    anyOf: ['stock.view', 'inventoryReport.view'],
    scope: 'branch',
  },
  {
    path: 'inventory/batches/:id',
    element: page(() => import('@/features/inventory/batches-page'), 'BatchDetailPage'),
    anyOf: ['stock.view', 'inventoryReport.view'],
    scope: 'branch',
  },
  {
    path: 'stock-in',
    element: page(() => import('@/features/inventory/stock-documents-page'), 'StockInPage'),
    anyOf: ['stock.view'],
    scope: 'branch',
  },
  {
    path: 'stock-out',
    element: page(() => import('@/features/inventory/stock-documents-page'), 'StockOutPage'),
    anyOf: ['stock.view'],
    scope: 'branch',
  },
  {
    path: 'inventory-report',
    element: page(() => import('@/features/inventory/inventory-report-page'), 'InventoryReportPage'),
    anyOf: ['inventoryReport.view'],
    scope: 'branch',
  },
  {
    path: 'materials',
    element: page(() => import('@/features/manufacturing/materials-page'), 'MaterialsPage'),
    anyOf: ['materials.view'],
    scope: 'branch',
  },
  {
    path: 'materials/:id',
    element: page(() => import('@/features/manufacturing/material-detail-page'), 'MaterialDetailPage'),
    anyOf: ['materials.view'],
    scope: 'branch',
  },
  {
    path: 'material-categories',
    element: page(
      () => import('@/features/manufacturing/material-categories-page'),
      'MaterialCategoriesPage',
    ),
    anyOf: ['materialCategories.view'],
    scope: 'branch',
  },
  {
    path: 'recipes',
    element: page(() => import('@/features/manufacturing/recipes-page'), 'RecipesPage'),
    anyOf: ['recipes.view'],
    scope: 'branch',
  },
  {
    path: 'lab-transfers',
    element: page(() => import('@/features/manufacturing/batches-page'), 'LabTransfersPage'),
    anyOf: ['labTransfers.view'],
    scope: 'branch',
  },
  {
    path: 'productions',
    element: page(() => import('@/features/manufacturing/batches-page'), 'ProductionsPage'),
    anyOf: ['production.view'],
    scope: 'branch',
  },
  {
    path: 'finished-goods',
    element: page(() => import('@/features/manufacturing/manufacturing-reports'), 'FinishedGoodsPage'),
    anyOf: ['finishedGoods.view'],
    scope: 'branch',
  },
  {
    path: 'material-report',
    element: page(() => import('@/features/manufacturing/manufacturing-reports'), 'MaterialReportPage'),
    anyOf: ['materialReport.view'],
    scope: 'branch',
  },
  {
    path: 'patients',
    element: page(() => import('@/features/patients/patients-page'), 'PatientsPage'),
    anyOf: ['patients.view'],
    scope: 'branch',
  },
  {
    path: 'patients/:id',
    element: page(() => import('@/features/patients/patient-profile-page'), 'PatientProfilePage'),
    anyOf: ['patients.view'],
    scope: 'branch',
  },
  {
    path: 'patient-history',
    element: page(() => import('@/features/patients/patient-history-page'), 'PatientHistoryPage'),
    anyOf: ['consultations.view'],
    scope: 'branch',
  },
  {
    path: 'doctors',
    element: page(() => import('@/features/doctors/doctors-page'), 'DoctorsPage'),
    anyOf: ['doctors.view'],
    scope: 'branch',
  },
  {
    path: 'appointments',
    element: page(() => import('@/features/appointments/appointments-page'), 'AppointmentsPage'),
    anyOf: ['appointments.view'],
    scope: 'branch',
  },
  {
    path: 'appointments/:id',
    element: page(() => import('@/features/appointments/appointment-detail-page'), 'AppointmentDetailPage'),
    anyOf: ['appointments.view'],
    scope: 'branch',
  },
  {
    path: 'appointments/:id/consultation',
    element: page(() => import('@/features/consultations/consultation-page'), 'ConsultationPage'),
    anyOf: ['consultations.view'],
    scope: 'branch',
  },
  {
    path: 'prescriptions',
    element: page(() => import('@/features/prescriptions/prescriptions-page'), 'PrescriptionsPage'),
    anyOf: ['prescriptions.view'],
    scope: 'branch',
  },
  {
    path: 'prescriptions/new',
    element: page(
      () => import('@/features/prescriptions/prescription-builder-page'),
      'PrescriptionBuilderPage',
    ),
    anyOf: ['prescriptions.create'],
    scope: 'branch',
  },
  {
    path: 'prescriptions/:id/edit',
    element: page(
      () => import('@/features/prescriptions/prescription-builder-page'),
      'PrescriptionBuilderPage',
    ),
    anyOf: ['prescriptions.update'],
    scope: 'branch',
  },
  {
    path: 'returns',
    element: page(() => import('@/features/returns/returns-page'), 'ReturnsPage'),
    anyOf: ['returns.view'],
    scope: 'branch',
  },
  {
    path: 'returns/:id',
    element: page(() => import('@/features/returns/return-detail-page'), 'ReturnDetailPage'),
    anyOf: ['returns.view'],
    scope: 'branch',
  },
  {
    path: 'sales',
    element: page(() => import('@/features/sales/sales-page'), 'SalesPage'),
    anyOf: ['sales.view'],
    scope: 'branch',
  },
  {
    path: 'sales/new',
    element: page(() => import('@/features/sales/pos-page'), 'PosPage'),
    anyOf: ['sales.create'],
    scope: 'branch',
  },
  {
    path: 'sales/:id',
    element: page(() => import('@/features/sales/sale-detail-page'), 'SaleDetailPage'),
    anyOf: ['sales.view'],
    scope: 'branch',
  },
  {
    path: 'sales/:id/edit',
    element: page(() => import('@/features/sales/pos-page'), 'PosPage'),
    anyOf: ['sales.update'],
    scope: 'branch',
  },
  {
    path: 'deliveries',
    element: page(() => import('@/features/sales/deliveries-page'), 'DeliveriesPage'),
    anyOf: ['sales.view'],
    scope: 'branch',
  },
  {
    path: 'delivery-report',
    element: page(() => import('@/features/sales/delivery-report'), 'DeliveryReportPage'),
    anyOf: ['deliveryReport.view'],
    scope: 'branch',
  },
  {
    path: 'journal',
    element: page(() => import('@/features/finance/journal-page'), 'JournalPage'),
    anyOf: ['journal.view'],
    scope: 'branch',
  },
  {
    path: 'expenses',
    element: page(() => import('@/features/finance/expenses-page'), 'ExpensesPage'),
    anyOf: ['expenses.view'],
    scope: 'branch',
  },
  {
    path: 'reports',
    element: page(() => import('@/features/reports/reports-page'), 'ReportsPage'),
    anyOf: [
      'reports.view',
      'sales.view',
      'appointments.view',
      'appointmentPayments.view',
      'accounts.view',
      'expenses.view',
    ],
    scope: 'any',
  },
  {
    path: 'reports/:key',
    element: page(() => import('@/features/reports/report-view'), 'ReportPage'),
    anyOf: [
      'reports.view',
      'sales.view',
      'appointments.view',
      'appointmentPayments.view',
      'accounts.view',
      'expenses.view',
    ],
    scope: 'any',
  },
];

export const printRoutes: ScreenRoute[] = [
  {
    path: 'labels',
    element: page(() => import('@/features/inventory/labels-print'), 'LabelsPrint'),
    anyOf: ['stock.view'],
    scope: 'branch',
  },
  {
    path: 'stock-in',
    element: page(() => import('@/features/inventory/stock-slip-print'), 'StockInSlipPrint'),
    anyOf: ['stock.view'],
    scope: 'branch',
  },
  {
    path: 'stock-out',
    element: page(() => import('@/features/inventory/stock-slip-print'), 'StockOutSlipPrint'),
    anyOf: ['stock.view'],
    scope: 'branch',
  },
  {
    path: 'appointment/:id',
    element: page(() => import('@/features/appointments/appointment-print'), 'AppointmentPrint'),
    anyOf: ['appointments.view'],
    scope: 'branch',
  },
  {
    path: 'prescription/:id',
    element: page(() => import('@/features/prescriptions/prescription-print'), 'PrescriptionPrint'),
    anyOf: ['prescriptions.view'],
    scope: 'branch',
  },
  {
    path: 'referral/:id',
    element: page(() => import('@/features/consultations/referral-print'), 'ReferralPrint'),
    anyOf: ['consultations.view'],
    scope: 'branch',
  },
  {
    path: 'bill/:id',
    element: page(() => import('@/features/sales/bill-print'), 'BillPrint'),
    anyOf: ['sales.view'],
    scope: 'branch',
  },
  {
    path: 'delivery-slips',
    element: page(() => import('@/features/sales/delivery-report'), 'DeliverySlipsPrint'),
    anyOf: ['deliveryReport.view'],
    scope: 'branch',
  },
  {
    path: 'report/:key',
    element: page(() => import('@/features/reports/report-view'), 'ReportPrint'),
    anyOf: [
      'reports.view',
      'sales.view',
      'appointments.view',
      'appointmentPayments.view',
      'accounts.view',
      'expenses.view',
    ],
    scope: 'any',
  },
];
