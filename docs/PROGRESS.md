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

## Discount limit, one-row dispatch table, print all awaiting slips (2026-10-08)

- **POS discounts:** the product discount and the overall discount accept at most 99%. Typing a bigger number is blocked, so the totals cannot overflow.
- **Dispatch dialog:**
  - Wider than before.
  - The customer card (name, phone, city, address) is on top. The address is cut at 10 words with "...", and the full address shows on hover. The print icon is in the same card.
  - Each product is one table row with columns Qty, Scanned (x / n), DSM labels (removable chips) and a done tick.
- **Deliveries, All awaiting dispatch tab:** a "Print N slips" button prints a slip for every order still waiting, two per A4 page.
- **API:** `GET /branch/sales/delivery-slips?awaitingDispatch=true` returns only pending online orders from any day.

## Dispatch slip, logo delivery slips, whole-number money (2026-10-08)

- **Dispatch dialog:** after the first scan (or right away for unlabelled products), a Dispatch slip shows the customer name, phone, city and address, plus every product with its qty and scanned DSM labels. A print icon opens the slip in a new tab, so the scans stay in the dialog.
- **Delivery slips print:**
  - Redesigned like posSoft: the DSM logo, Order No, a "To," block (Name, Phone, City, Address), the numbered product list and a "From," block.
  - Two slips fit on one A4 page.
- **Bug fix:** the "Print slip" row action now finds the order by its invoice sequence. Before, it joined the branch code into the number and found nothing.
- **Money format:** amounts show without ".00", for example Rs 1,500. Real paisa still shows, for example Rs 1,500.5. Payment amount inputs are prefilled without ".00".

## Deliveries default tab, sale saves to list, ledger cards (2026-10-07)

- **Deliveries:** "All awaiting dispatch" is now the first tab and opens by default.
- **POS:** after a new sale is saved, the app goes to View Sales instead of the bill print page.
- **Stock history:** the Opening card is removed. Total in, Total out and Closing remain.
- **Branch inventory report:** the Purchased column is removed.
- **Sales list:** the Products column no longer crashes against an older API that does not send `products`.

## Product columns, report row click (2026-10-07)

- **Sales list:** new Products column. It lists each product × qty, and a bundle by its name. The API list returns `products`.
- **Returns list:** Products are listed one per line. The pieces of the same product are merged with their qty added up.
- **Inventory report:**
  - Clicking anywhere on a row opens that product's history.
  - Branch names in the per-branch lines drop a trailing "branch", so "Islamabad branch" shows as "Islamabad".

## No received/remaining in sales, clearer totals, branch returns (2026-10-07)

- **Sales list:** the Received and Remaining columns are gone, and so are their totals. The branch cards show only sales count, qty and total. The "Payment pending" chip no longer shows the amount due.
- **POS totals:**
  - Shown in order: Total qty, then (only when a product has a discount) Products before discount and Product discounts, then Sub amount, Overall discount (x%) and Total.
  - Received and Remaining are not shown.
- **Inventory report (Super Admin):**
  - New column: Returned in branches.
  - "Left in branches" is now called "Now in branches".
  - The description explains Sent − Sold + Returned.

## Payment approval, branch sales cards, POS payment and city (2026-10-07)

- **Sales list:**
  - The quick-filter checkboxes sit next to search: All sales, Payment pending, Awaiting approval and Awaiting dispatch.
  - The row menu has "Approve payment" for users with `salePayments.update`.
  - The Super Admin sees a card per branch with sales count, qty, total, received and due. Clicking a card filters to that branch.
- **Sale detail:**
  - The payments table has an Approval column: Approved with its time, or an Approve button.
  - "Approve all" appears when more than one payment is waiting.
- **Super Admin:** `salePayments` is in the modules the Super Admin can act on in any branch.
- **POS:**
  - A new sale cannot be saved without a payment.
  - The Auto discount toggle is gone; there is only the overall discount %.
  - Sale city follows the customer's city until the user types their own.

## Sales quick filters, mark as paid, Super Admin inventory report (2026-10-07)

- **Sales list:**
  - Quick filter checkboxes: All sales, Payment pending (`due=true`, shows the amount still due) and Awaiting dispatch (`deliveryStatus=pending`). The last two can be combined.
  - The row menu has "Mark as paid" when money is still due. It opens the payment sheet with the remaining amount filled in.
- **`DataTable`:** the menu column is titled "Actions".
- **Inventory report:**
  - For the Super Admin stock with no "Stock to" filter, the columns are Stock in, Sent to branches, Sold in branches, Left in branches and Super Admin stock.
  - Each of the branch columns lists the branches below its total.
  - The Super Admin view no longer has the Purchased column.

## Deliveries dashboard and online dispatch (2026-10-07)

- **Deliveries page (`/deliveries`, menu: Sales → Deliveries):**
  - Stat cards: awaiting dispatch (with the oldest order date), booked this month, dispatched this month, delivered this month.
  - A month calendar, Monday to Sunday. Each day shows the orders booked that day with dots per status, and how many orders were sent that day.
  - Three tabs: "Booked <day>", "Sent <day>" and "All awaiting dispatch".
  - The orders table shows customer, address, items (labelled items are marked), amount, payment and status. Its row actions are Dispatch, Delivered, Print slip, Mark returned and Cancel order.
- **`delivery-actions.tsx`:**
  - `DeliveryBadge`.
  - Dispatch dialog: dispatch date, label scanning per product (counts must match; unlabelled items go FEFO).
  - Cancel dialog with an optional refund.
  - `useOrderActions`, used by the sales list, sale detail and Deliveries.
- **Sales:**
  - The Delivery column shows the new statuses and the date sent.
  - The sale detail page has a Delivery timeline (Ordered, Dispatched, Delivered / Returned / Cancelled) and Dispatch / Cancel buttons.
- **POS:**
  - An online sale is booked without scanning. Labelled products can be picked from the catalog. Scanning a DSM label shows a message to scan at dispatch.
  - Available stock excludes booked stock.
  - The sale type is fixed once the sale is saved.
- **Stock page:** has Booked and Available columns.

## Label layout, label not found, return detail (2026-10-06)

- **Label 38×25 mm:** the product name sits on top, then the barcode. Below it, one line has the serial and `B: <batch>`, and the next line has `MFG mm/yyyy` and `EXP mm/yyyy`. Nothing is cut off any more.
- **Label not found:** a wrong or unknown serial shows a "Label not found" card with the number searched, a box to try another label, and an All labels button. It no longer shows the generic error.
- **Return detail:**
  - Stat cards at the top: items returned, inspected, back in stock, refunded.
  - Items sit in a table: product and label, qty, the batch it was sold from, and the outcome with when and why.
  - "Back in stock" is the main action. The other outcomes sit in an "Other" menu.
  - The side panels are "Customer and sale" (with a link to the sale) and "Refund".
  - The page has a Print button.

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
