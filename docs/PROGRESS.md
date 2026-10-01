# Dashboard Progress

| Phase                                                          | Status | Date       |
| -------------------------------------------------------------- | ------ | ---------- |
| D0 — Project setup, login and layout                           | Done   | 2026-10-01 |
| D1 — Super Admin: branches, branch admins, staff, company info | Done   | 2026-10-01 |
| D2 — Master data screens                                       | Done   | 2026-10-01 |
| D3 — Stock and manufacturing screens                           | Done   | 2026-10-01 |
| D4 — Customers, doctors and appointments                       | Done   | 2026-10-01 |
| D5 — Consultation, clinical records and prescriptions          | Done   | 2026-10-01 |
| D6 — POS sales and printing                                    | Done   | 2026-10-01 |
| D7 — Accounts, reports and dashboards                          | Done   | 2026-10-01 |
| D8 — Polish and deployment                                     | Next   |            |

## D0

- Vite + React + TypeScript strict, Tailwind v4, shadcn/ui, ESLint, Prettier, and zod-validated env.
- The design system is global CSS variables in `src/index.css`, with light (default) and dark themes.
- The API client is generated from the backend OpenAPI spec. `authFetch` adds the Bearer token, refreshes on 401 and adds `?branchId=` for a super admin.
- Login uses backend `/auth/login`. `AuthProvider` holds me, permissions, `can()` and the branch selection.
- The layout has:
  - a collapsible sidebar built from permissions, following posSoft's menu groups;
  - a mobile sheet menu;
  - a top bar with the branch switcher, user menu, theme toggle, change password and logout.
- Guards: `RequireAuth` (redirects to /login), `RequirePermission` (no-access page) and `RequireBranch` (a super admin picks a branch for branch screens).
- Shared components: DataTable, FormSheet, form fields, ConfirmDialog, FileUpload, DateRangePicker, StatusBadge, MoneyInput, EmptyState, ErrorBoundary, skeletons and PrintLayout.
- Menu items for later phases show "Soon" and a coming-soon page.

## D1

- Branches: list, create and edit, activate and deactivate, and a detail page with the staff count and branch admins. Includes "Create branch admin" with a generated password shown once.
- Employees: list, create (only roles the actor may create), edit, reset password, activate/deactivate and delete.
- Company info (super admin), profile settings and change password.
- Super admin home: one card per branch, with KPI placeholders until D7.

## D2

- Categories, with an image.
- Products, with an image and an optional first purchase. The detail page shows stock from the ledger, the purchase entries (add, correct and remove) and recent movements.
- Bundles: product lines with qty and price. The total shown is a preview; the server calculates the real total.
- Supply chain: suppliers and dispatchers in tabs.
- Banks, and account sheets (cash or bank).

## D3

- Stock overview with a low-stock filter, and a per-product ledger page (`/stock/:productId`).
- Stock in and stock out share one screen:
  - create with several lines and attachments;
  - edit one entry, or delete it;
  - print a slip in the posSoft layout.
- Inventory report with a date range, category and product filters, and a totals row.
- Manufacturing:
  - material categories;
  - materials, with receipts and minimum / bare-minimum levels;
  - product recipes;
  - material out to the pharmacy lab;
  - production to finished product, prefilled from the lab batch;
  - finished goods and the material report.
- Menus follow the role permissions, so Store Keeper and Pharmacy see only their screens.

## D4

- Customers:
  - phone-first search;
  - create and edit, with a duplicate-phone warning and city suggestions;
  - a patient profile with tabs for Appointments, Sales (filled in D6), History, Prescriptions, Medical records and BHRT.
- Doctors: linked to a new or existing doctor login, with fee, commission, status and a signature upload.
- Appointments:
  - List with filters, and a day/week calendar per doctor.
  - Booking: patient search or inline create, the doctor's booked slots, time, mode, type, issues, medical record files and several payments.
  - Detail page: payments with proof screenshots, attachments, complete/cancel/reopen, and a printable slip.
  - A doctor sees "My Appointments" only.

## D5

- Consultation workspace (`/appointments/:id/consultation`):
  - Sections follow CLINICAL_FIELDS.md, each saved on its own (Save button or Ctrl+S).
  - A saved/unsaved indicator, and a warning before leaving unsaved changes.
  - A sticky patient header.
- Clinical records: medical records, blood work (entry, pivot table and trend chart), imaging results, BHRT log and MRS history chart.
- Prescriptions:
  - A builder driven by the catalog, with dose and instructions per item, notes, plan and follow-up date.
  - Prescription print and referral letter print.
- Patient history timeline page.

## Dashboard home

- Live data from `GET /branch/dashboard`, refreshed every minute:
  - KPIs: appointments, patients, revenue (with the change from last month) and low stock.
  - Charts: monthly revenue by year, and this month's revenue split.
  - Revenue by branch, for a super admin viewing all branches.
- A super admin on "All branches" sees the whole system. A branch user sees only their own branch.

## D6

- **Add Sale (POS, `/sales/new`):**
  - A product and bundle grid with search, category chips and a barcode scan box. It shows stock where the role may see it.
  - The cart has a qty stepper, and a customer search or inline new customer.
  - Sale type and city, plus discount (Auto, as in posSoft, or a percentage) and several payments with screenshots.
  - The totals are a labelled preview; the server prices the sale. Stock shortages from the API are listed and highlighted on their lines.
  - Saving opens the bill print.
- **Edit sale** (`/sales/:id/edit`) reuses the POS screen. Bundle quantities are rebuilt from the bundle definition.
- **View Sales:**
  - Filters: date, type, payment, delivery and staff. The totals footer covers every matching sale.
  - Online sales can be marked delivered or returned. Returned sends the goods to the returns section.
  - Front Desk and Team Manager can change only their own sales.
- **Sale detail:** items, payments (add, edit, delete, screenshots), the returns of this sale, and "receive a return" with the sale preselected.
- **Bill print** in the posSoft layout, under the company or branch header.
- **Delivery report:** filters by date, type and order number range, a preview, and print with two slips per A4 page.
- The patient profile Sales tab now lists the patient's sales.

## D7

- **General entries:**
  - Journal lines with live debit/credit balance validation.
  - Expense-created entries are read-only here.
- **Expenses:** entries with a receipt upload, plus categories, in tabs.
- **Reports hub (`/reports`):** all 10 B7 reports, driven by one config.
  - Each has date and per-report filters, a totals row, a by-branch breakdown (super admin on all branches) and summary tiles.
  - Server CSV download and a print view.
  - Each report is shown only to the roles the backend allows.
- Accounts Balance and Finance Report are in the Finance menu.
- **Dashboard:**
  - Branch view: top products, low-stock alerts and pending deliveries.
  - Super admin: a branch comparison table that opens a branch.
- **Not built:** the doctor schedule screen (D7 item 7). It needs the B8 mobile booking API, which does not exist yet.

**Verified:** typecheck, lint and build pass. Not yet checked in the browser: the new `ReturnsBarcodes` migration has to run on the database first.

## Returns and barcodes (2026-10-01)

- Returns (`/returns`):
  - Receive a return: pick the sale, enter the quantity per product (limited to what is still returnable), the reason, a note and an optional refund.
  - The detail page inspects each item: back in stock, damaged, or sent to the supplier. It also manages the refund, and a return can be deleted before any item is inspected.
- Barcodes:
  - A product has a barcode field (scan into it). Product search also matches barcodes.
  - Stock In / Stock Out have a scan box: a scan adds the product, and scanning it again adds 1 to its quantity.

## Backend gaps found

- Fixed 2026-10-01: `GET /branch/account-sheets/options` now also allows `appointmentPayments.create/update` and `sales.create/update`. Front Desk, Team Manager and Doctor can choose the receiving account for payments.

## Notes

- The backend has no logo upload endpoint for branches and company info, so the UI shows initials.
- Login goes through the backend API instead of `@supabase/ssr`, so Supabase keys stay out of the browser.
