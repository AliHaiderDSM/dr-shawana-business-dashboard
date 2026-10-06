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

## Stock status, stock out columns, sales totals row, delivery table (2026-10-06)

- **Stock:** status shows Out of stock (red) at 0 or less, Low stock at or below the threshold, otherwise In stock.
- **Stock out list:** Batch, Mfg date, Expiry and Batch qty are separate columns. When an entry took several batches, they stack line by line.
- **`DataTable` `totalsRow`:** an optional total row that lines up under the columns.
  - The sales list uses it for the totals, instead of the separate card strip below the table.
  - Sales has new Sub amount, Discount and Remaining columns.
- **Delivery report:** on screen it is now a table: order no, date, type, customer, delivery address, products, total qty and a total row. Clicking a row opens the sale. The printed slips are unchanged.

## Reports, product trail, label search, print and line discounts (2026-10-06)

- **Inventory report:** the Opening, Manufactured and Adjusted columns are gone, as in posSoft. Closing is now called Total stock. Each product name opens its full trail (`/stock/:id?from&to`).
- **Finished goods:** has a new Stock summary table with Opening, Manufactured, Adjusted and Closing for the period.
- **Product trail (`/stock/:id`):** has a From / to column. Invoices and returns link to their pages. It also has batch Mfg and Expiry columns, and takes the date range from the URL.
- **Topbar label search:** "Find label" accepts `DSM-000060`, `dsm-60` or `60` and opens the label page. The super admin searches every branch.
- **Print:**
  - `PrintButton` (`window.print()`) is on the inventory report, material report, finished goods, stock, batches, batch detail, product trail and label pages.
  - When printing, the sidebar, topbar, page actions, table toolbars, pagination and row menus are hidden.
- **POS line discounts:**
  - Every cart line has a % discount field. The line shows the gross amount struck through and the net amount.
  - Totals show "Item discounts" when there are any.
  - The sale detail page and the bill show each line's discount.

## Stock batch details and payment screenshots (2026-10-06)

- **Stock out form:** each product row shows a batch table (batch, mfg, expiry, qty) with full dates. "Oct 26" read like a day of the month, so short dates are no longer used.
  - For a labelled product, Qty is read-only and counts the scanned labels.
  - Scanning the product barcode of a labelled product asks for its labels instead.
- **Stock in list:** has Batch, Mfg date, Expiry and Unit cost columns.
- **Stock out list:** has a Batches column showing the batches each entry took.
- **Edit stock in:** can change mfg date, expiry and unit cost. New dates apply to the whole batch.
- **POS and sale detail payments:** take up to 5 screenshots. Each screenshot opens and can be removed on its own.
- **Appointments and returns:** still keep one screenshot. `PaymentFields` has `maxProofs` for this.

## Patient link, login redirect and Excel export (2026-10-06)

- **Copy link** on an appointment asks the API for a signed token and copies `/p/{token}`.
  - The link is valid for 30 days.
  - `/p/:token` sits outside `RequireAuth`. It shows the patient's history on a page that works on a phone and can be printed. It fetches with plain `fetch`, so no session or branch is attached.
- **Login redirect:** `?redirect=` is followed only when the same user signs back in (`dsm.lastUser`). Any other user lands on the dashboard. This fixes "You don't have access" after a super admin logs out on an admin page and a branch admin logs in.
- **Export:**
  - Table **Export** downloads a real `.xlsx` file. It has a bold, frozen header row and sized columns.
  - Numbers stay numbers. Values with a leading zero, such as phone numbers, stay text.
  - Report **Excel** fetches the report CSV and converts it to `.xlsx`, with the report title as the sheet name.
  - The writer is `lib/xlsx.ts`. It adds no dependency.

## Appointment row menu matches posSoft (2026-10-06)

The row menu on `/appointments` now has the posSoft options, in posSoft order:

| Option | What it does | Shown when the user can |
| --- | --- | --- |
| Add prescription | Opens `/prescriptions/new?patientId=&doctorId=`. The builder fills in that patient and doctor. | `prescriptions.create` |
| View | Opens the appointment. | always |
| Copy link | Copies the patient history link (`/patient-history?patientId=`). | `consultations.view` |
| Remarks 2.0 | Opens the consultation workspace. | `consultations.view` |
| Remarks | Opens a dialog with status, remark and screenshots. It uses `POST /appointments/{id}/status`. | `appointments.update` |
| BHRT | Opens a sheet with the patient's BHRT history and status form. | `consultations.view` |
| Medical record | Opens a sheet with the patient's medical and imaging records and an upload button. | `consultations.view` |
| Print | Opens the printed appointment. | always |
| Edit | Edits the appointment. | `appointments.update` |
| Delete | Deletes the appointment. | `appointments.delete` |

Complete and Cancel are kept as before.

In BHRT and Medical record, only users with `consultations.create` or `consultations.update` can add entries.

Saving a BHRT status now also refreshes the appointment list, so the BHRT column updates.

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
