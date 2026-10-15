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

## Warehouse and branch stock fixes (2026-10-15)

- Send stock for a request: the product list shows only the approved products, and saving stops when a qty is above the approved qty.
- Warehouse Keeper and Super Admin see Incoming Stock as **Outgoing Stock**.
- Received transfers have **Print receipt** (`/print/transfer-receipt?transfer=`): Stock Receiving Receipt for the branch admin.
- Discount Requests show the **Customer** column; POS sends the chosen or new customer with the request.
- Labels → By batch: the chips (labels, In stock, In branches, Sold, Other) are clickable. A chip opens the batch and lists only those labels; click it again or Show all for every label. Backend items list takes `group=in_stock|in_branches|sold|other`.
- Trace pages (request, transfer numbers) open for stock / inventory report viewers, so the Warehouse Keeper no longer sees No access.

## Patient Messages: voice notes (2026-10-14)

Voice messages from patients show a "Voice message" button in the thread; clicking it loads a signed link and plays it in an audio player.

## Sales table compact amounts (2026-10-14)

View Sales table shows amounts without "Rs" (new `formatAmount` in lib/format) and uses extra-small text through the new `dense` prop on DataTable. Branch total cards above the table still show "Rs".

## Patients edited in the app (2026-10-14)

- Patients table: "Edited in app" column with the date the patient last changed their details in the mobile app.

## Patient Messages for doctors (2026-10-14)

- "Patient Messages" (Patients & Care, doctors only, red badge for unread): patient list with search and unread counts, WhatsApp-style thread (refreshes every 5 s, earlier messages on demand), reply with text and a PDF or photo; Enter sends.

## Catalog, inventory report and sales table (2026-10-14)

- Catalog menu (Categories, Products, Bundles, Supply chain) and its routes are Super Admin only (routes need the create permission).
- Inventory report: "Booked (not dispatched)" and "Total" columns; the branch sheet shows booked per branch and the total. Warehouse Keeper and Lab Officer see the report in their menu.
- View Sales: Actual amount → Discount (item + sale, shown with a minus) → Sub-amount (after discount); Remaining now comes before Payment.

## Patient app: login codes (2026-10-14)

- Patient profile "Mobile app" panel: "Create login code" / "New login code"; the dialog tells staff the patient logs in with the phone number and this code.

## Dispatcher menu and stock out report (2026-10-13)
- "Send stock" on an approved request shows for the Warehouse Keeper only; the Super Admin approves.
- Staff form: Dispatcher is offered only for the Dispatch Department.

- Dispatcher sidebar: Dashboard, Deliveries, Delivery report, Returns, Write-offs, Stock, Labels only. Incoming stock can be received by the branch admin only. The write-off report button stays for the dispatcher.
- New "Stock Out Report" page (Inventory, warehouse view; also in the Warehouse Keeper menu): transfers with date, destination, request, products, quantity, labels scanned, sent by and received; tabs for on the way / received, date range and branch filters, export, and a sheet with each item and its labels.

## Patient app: access codes and requests (2026-10-13)

- Patient profile: "Mobile app" panel under Details shows whether the patient uses the app, creates a 6-digit activation code (shown once, also used to reset a forgotten password) and turns access off.
- "Patient Requests" page (Patients & Care, `patients.view`) with Open / Resolved / Closed / All tabs and a sheet to change status and reply; red sidebar badge for open requests.
- Medical records uploaded from the app show a "From patient app" badge.

## Read saved reports with AI (2026-10-13)

- Medical and imaging records files (PDF and photos) have checkboxes on the patient profile and the consultation Records tab; up to 5. With files ticked, the Blood work button reads "Read N selected (AI)" and reads them straight away; with none ticked it opens the device picker as before.
- Reports from the device stay with the AI summary, not under Medical records. File names on a summary row open the file (saved records and new uploads); older summaries show the name only.

## Expiry alerts by batch (2026-10-13)

- One row per product batch (same product, batch and expiry): total quantity across all places, the place name or "N places". The side sheet lists every place holding that batch, then the other expiring batches of the product.

## Report upload sizes (2026-10-13)

- Before upload, photos larger than 0.8 MB or 2000 px are redrawn as JPG (longest side 2000 px, quality 0.85); HEIC is converted where the browser can decode it (Safari/iPhone), else sent as HEIC. PDFs are sent as they are.
- Up to 5 files and 4.3 MB in total (under the Vercel 4.5 MB limit); a clear message names each file and its size when the total is too big. "No patient results were found on this document" when a document holds no results.

## MRS and additional symptoms linked (2026-10-12)

- Remarks 2.0 (consultation): MRS scale and Additional symptoms share one "Visit history" panel (per visit: MRS total, %, severity, and that visit's symptoms with severity); the current visit is highlighted. Saving the MRS opens the additional symptoms; that tab names the MRS date it belongs to. The MRS chart skips visits without an MRS.
- The section list stays below the patient header whatever its height (measured), so its first items (Basic information … MRS scale) are no longer hidden under it.

## Table and filter polish (2026-10-12)

- DataTable header in three rows: search with Reset on the left and Export / Columns on the right; a quick status row (quickFilters); then the filters. Headers and cells share the same padding (first and last columns a little wider), totals row too.
- Sales: status filters are one segmented control (All, Completed, Pending, Payment pending, Awaiting approval, Awaiting dispatch); invoice links to the trace, branch with its code, type as a badge, dates on one line, "dispatched" wording.
- Employees: role shown as a colored badge.
- Reports (Patient History and others): short values stay on one line, two-line values show the name over a muted second line, long text wraps at a readable width.
- Checkbox: clearer border, and a dash when part of a list is picked (delivery report select-all).

## GRN print, discount badge, several reports (2026-10-12)

- Goods Received Note print (/print/store-receipt?grn=): GRN details, entered vs received vs short per line, notes, signatures (Lab Officer, Warehouse Keeper, authorized). Opens after the keeper confirms; Print GRN on every receipt.
- Discount Requests shows in the Super Admin sidebar (with its count) in the Super Admin stock view too.
- Read report (AI) takes up to 5 files at once; values are saved per report date; one summary with a Documents section (Doc 1, Doc 2… with date and what each holds).

## Lab Officer and store receipts (2026-10-12)

- New role Lab Officer (Super Admin stock): menu Stock In, Store Receipts, Labels; no sales. Home shows entries waiting for the keeper.
- Store Receipts page: GRNs waiting / confirmed with entered vs received; the Warehouse Keeper counts and confirms (received qty per line, reason, missing labels by scan). Stock In list shows the GRN and Waiting / Confirmed / Received N.
- Select fields no longer push the option hint into the closed field (the Branch field overflow).

## Lab report summaries (2026-10-12)

- Blood work panel: under the table, "Lab report summaries" lists every report read with AI (newest open): details, abnormal findings table with High/Low, normal findings, clinical summary, review points, items to check, and the disclaimer. Values found are saved; tests not on the report stay "—". A report with none of the 9 tests still gets its summary.

## Warehouse Keeper (2026-10-12)

- New role Warehouse Keeper (created by the Super Admin at Super Admin Stock). Menu limited to Stock Requests, Stock Out, Incoming Stock, Stock, Batches & Expiry and Labels; home shows requests to send and transfers not received.
- The keeper opens an approved request and uses Send stock; the form shows the target branch and caps scans at the approved quantities. The Super Admin only approves and sees every transfer (sent by, when, qty, received by).
- Staff form offers roles by branch: Super Admin stock → Warehouse Keeper; Dispatch Department → its four roles; branches → no Store Keeper.

## Trace page, seller return approval, stock out from requests (2026-10-12)

- Top bar search finds any number (or a DSM label) and opens /trace/:number: details, items, linked numbers (clickable) and every step with who and when; Open goes to the record page. Numbers in Stock Requests, Discount Requests, Write-offs, Incoming Stock and Stock Out link to the trace.
- Return detail: the selling branch admin approves or rejects what the dispatcher found; the dispatcher sends checks for approval.
- Stock Out page has no New button; it points to Stock Requests (Send stock).

## Online return approval (2026-10-12)

- Return detail: on an online return the check is sent for approval ("Send for approval"); the item shows what was found and waits; the Super Admin approves or rejects per item. Returns list has a step filter (To check / Waiting for Super Admin) and opens for the Super Admin across branches.

## Sidebar badges, returned orders (2026-10-12)

- Red count badges on Stock Requests, Incoming Stock, Write-offs, Discount Requests and Returns (dot when the sidebar is collapsed); refreshed every 30 s and after each action.
- Sale detail: no "Receive a return" on an order already marked returned (its return was created with the mark).

## Write-off approval, employees overview, dispatcher view (2026-10-12)

- Write-offs page: Report stock builds a list (scan labels or pick batches, qty, reason, note) and sends it for approval; the Super Admin approves or rejects each line with a note; status column and Waiting tab; home banner for the Super Admin. Batch write-off asks for approval for everyone but the Super Admin.
- Employees: the Super Admin sees every branch, newest first, with branch and added date, and a branch filter; New employee asks for the branch. Designation input removed. Roles offered follow the branch (Dispatch Department: Branch Admin, Store Keeper, Delivery Print, Dispatcher).
- Dispatcher and Dispatch Department: no Catalog, Manufacturing or Finance menus; home shows dispatch numbers (waiting, dispatched today and this month, returned, stock to receive, write-offs waiting).
- Stock Out from a request: scanning stops at the approved quantity.

## Stock requests, incoming stock, write-offs (2026-10-12)

- Stock Requests page: branches ask for Super Admin products; the Super Admin approves (less per line if needed) or rejects, then Send stock opens Stock Out filled with the approved lines.
- Incoming Stock page: transfers by number; the branch admin checks and receives with a date; only then it shows in Stock In and stock. Stock Out list shows the transfer number and On the way / Received.
- Write-offs page: number, product, batch, qty (minus), reason, labels, who. Super Admin sees every branch.
- Request numbers show on stock and discount requests (tables, POS line, dialogs). Super Admin home shows banners for waiting requests.
- POS Online: the catalog and its categories come from the server (Dispatch Department products and categories); an empty department shows nothing instead of branch products.
- Deliveries calendar: one "dispatched" count per day (no separate "sent").

## Discount approval, save customer, inventory report split (2026-10-12)

- POS: a line discount shows "Ask for approval"; the request goes to the Super Admin and the line shows waiting / approved / rejected (checks every 8 s). The sale saves only when every discount is approved.
- New Discount Requests page (sales menu): the Super Admin approves or rejects with a note; branches see and withdraw their own. Super Admin home shows a banner while requests wait.
- POS new customer: "Save customer" saves the patient right away and selects them.
- Categories: no image upload.
- Inventory report: rows show totals only; a row click opens the branch split (sent, sold, returned, now). Outgoing stock (stock out, sent, sold) shows and exports as a minus.

## Branch code, emails, labels, month calendar, verified dispatch, bank picker (2026-10-12)

- Branch form accepts codes like lhr-00001 (turned into LHR-00001).
- Shared `emailString` / `optionalEmail` / `isEmail` with the same strict rule as the backend; used by staff, branch admin, branch, company and doctor forms.
- Stock documents: "N scanned" opens a list of the labels; each one can be removed, and the qty follows. Clear all stays.
- Appointments calendar has Day, Week and Month. Month shows each day with up to 3 appointments; clicking a day or "+N more" opens that day.
- Dispatch dialog warns and blocks while a payment is not verified; Scan & print skips those orders and shows "Payment not verified".
- Payments: Online lists only bank accounts as "Bank · Account title" and shows the bank, title and account no once picked; Cash lists cash accounts. A single match is picked on its own.

## Clickable expiry alerts (2026-10-11)

- Each expiry alert row opens a side sheet: branch, branch type, batch, stock, expiry and status, plus every branch where the same product is expiring with totals.
- The branch shows on every row, and "Show more" expands the full list.

## Online catalog on Add Sale (2026-10-11)

- When a Dispatch Department exists and the sale type is Online, the POS catalog shows the department products and their free stock (no bundles). Barcode scans search the same catalog.
- Switching between Office and Online clears the cart, because the two use different stock.
- Without a Dispatch Department, Online works as before with the branch stock.

## Dispatch Department UI (2026-10-11)

- **Branches:** the New branch form has a Type (Branch / Dispatch Department), and the list shows the type.
- **Menu:**
  - Deliveries shows only inside the Dispatch Department once one exists. Without one, branches keep their Deliveries as before.
  - Inside the department, Add Sale, View Sales and Patients & Care are hidden.
- **Deliveries (department):** titled "Dispatch Department", with a "From branch" column (code + name). Scan & print works on the department's labels.
- **Branch sale pages:** no Dispatch action for orders the department ships, and the sale detail notes "The Dispatch Department ships this order from its own stock".
- **Transfers and reports:** stock out can target the Dispatch Department, and the inventory report branch filter includes it.
- **Roles:** new Dispatcher role label.
- **Code:** `useBranchKind`, `useInDispatch`, `useHasDispatch`.

## Read blood report with AI, appointment table trimmed (2026-10-10)

- **Blood work:**
  - A "Read report (AI)" button uploads a PDF or photo. The backend asks Gemini for the 9 tracked tests.
  - When the report has a date, the values are saved at once and the chart updates. Without a date, the add sheet opens prefilled.
  - Values with < or > are skipped.
- **Appointments table:** the Fee and Payment columns are removed. Received and Remaining stay.

## Appointment fee, advance and remaining; Patient History page is the posSoft report (2026-10-10)

- **Appointments:**
  - A new Fee field, defaulting to the doctor fee, with a live Fee / Received now / Remaining box in the booking form.
  - The table has Fee, Received, Remaining and a Payment badge (Paid / Advance / Unpaid).
- **Patient History (menu):** now shows the posSoft patient history report: one row per visit with the full columns, Patient and date filters, and Excel export. It replaces the old consultations list, and staff with consultation access can open it.

## posSoft patient history layout, Remarks 2.0 tabs, appointment time and visit badge (2026-10-10)

- **Patient history report:**
  - posSoft column order: Sr No., ID (PatID-n), Name / Phone (two lines), Age, City, Country, Date, BMI, menopause, each MRS answer and score, FSH / Estradiol / Total Testosterone, treatments, Still on treatment.
  - Empty numeric cells show 0.
  - Filters are Patient (searchable), dates and branch. The Columns button is hidden (`columnsMenu: false`).
- **Remarks 2.0:** the BHRT and Patient history tabs are removed, as posSoft has none.
- **Appointments table:** time shows From on top and "to" below. New / Follow up is a small coloured badge under the mode.
- **Data table:** new `columnsMenu` prop.

## Additional symptoms with severity, visit history, follow-up tab (2026-10-10)

- **Additional symptoms:**
  - The same 43 symptoms in 10 groups as posSoft, now as group cards.
  - Ticking a symptom opens a 0 None / 1 Mild / 2 Moderate / 3 Severe selector, stored in `severity`.
  - On a later visit each symptom shows "Last: n · level" from the patient's previous visit, and ticking it again starts from that level.
- **Basic information:** a "Patient history" panel below the form, as in posSoft:
  - Every earlier appointment as "APP#n : Date", with its issues and remark/plan.
  - "Previous prescription" and "New prescription" slip links, which open the print.
- **Follow up form:** unchanged. It only appears for follow-up appointments, as in posSoft.

## Blood work: same date replaces, single-date view (2026-10-09)

- Adding a result for a test and date that already exist replaces the value instead of adding a hidden duplicate. The list keeps the latest value per test and date.
- With only one test date, the chart area shows a note and the values as tiles instead of a vertical column of dots.

## Blood work editing and overall chart, Save & next, referral patient name, link prefill (2026-10-09)

- **Blood work:**
  - The chart is on top and shows every test with results by default (one line each, with a legend; tests 6–9 are dashed). A selector narrows it to one test.
  - Each date header has Edit (opens the sheet prefilled; clear a value to remove it, change the date to move the column) and Delete (removes the whole date).
  - The add/edit sheet is wider (lg).
- **Remarks 2.0:**
  - Each section's button is "Save & next" and opens the next tab after saving, as in posSoft.
  - Saving Clinical remarks with "Referred to specialist" goes straight to the new referral tab.
- **Referral:** new Patient name field, prefilled and updating the patient, as in posSoft.
- **Patient link:** Basic information is prefilled with the patient's name, age, city and country (`form.defaults`).

## Patient link: intake form, prescription slips, educational resources (2026-10-09)

- **Header:** the public link (/p/:token) has a posSoft-style header: logo, clinic name, a Name + APP# bar and a WhatsApp bar.
- **Downloads:**
  - "Prescription slip (date)" buttons open /p/:token/rx/:id, a printable slip (logo, patient, diagnosis, medicines by category, plan, follow up) that prints or saves as PDF.
  - Educational resources ticked Yes in Remarks 2.0 download from /resources (GLP diet plan PDF, general diet plan PDF, liver detox, skin care and hair care images), copied from posSoft "Diet Plan".
- **Intake form (links made from an appointment):**
  - Basic information (with BMI), "Have you ever been diagnosed with?" (medical history) and "Other symptoms you are experiencing", each with its own Save. They reuse the Remarks 2.0 field definitions.
  - "Upload medical records": medical records and imaging with notes.
  - Everything saves into that appointment's Remarks 2.0 and the patient's medical records, so staff with access see it there.
- **History:** the patient's history stays below the form.

## No return on undispatched orders, paid-extra label (2026-10-09)

- **Sale detail:** "Receive a return for this sale" is hidden for online orders that are awaiting dispatch or cancelled. Nothing left the stock, so there is nothing to return.
- **Return form:** when the server refuses a sale, its reason shows in place of the empty product table.
- **Sale totals:** a negative remaining (paid more than the total) shows as "Paid extra".

## Cancelled orders lock payments, BMI gauge (2026-10-09)

- **Cancelled orders:** Approve actions are hidden on them, because their payments can no longer be approved. The cancel dialog warns that a payment awaiting approval will never count, and says to approve and refund first if the money arrived.
- **Remarks 2.0, BMI:**
  - A full-width glass card with the BMI value (kg/m²) and a coloured category chip.
  - A 15–40 gauge with band colours (info, success, warning, destructive) and a marker, tick marks at 18.5 / 25 / 30 / 35, and a legend.

## Refund needs approval, Scan & print on deliveries, Remarks 2.0 numbers and BMI (2026-10-09)

- **Cancel order dialog:**
  - Refunds only the approved amount and warns about any payment still awaiting approval.
  - The server returns 422 "Approve the payments first" when the refund is more than the approved payments.
- **Deliveries toolbar:**
  - When the list has waiting orders, the button reads "Scan & print N". It opens a dialog to scan every DSM label: each label goes to the oldest waiting order that needs that product.
  - Complete orders (and unlabelled ones) are ready and can be unticked. "Dispatch & print" dispatches them on the chosen date and prints their slips two per A4 page.
  - With no waiting orders, the button prints the dispatched ones.
- **Remarks 2.0, Basic information:**
  - Age takes digits only. Weight takes a number with up to 2 decimals.
  - Height takes digits and adds the point after the first digit (54 → 5.4).
  - A live BMI readout with the posSoft bands (weight / (height ft × 0.3048)²). It is display only.

## View Sales: Pending filter (2026-10-09)

- New "Pending (payment or dispatch)" quick filter. It shows every sale that is not completed: a payment is missing or awaiting approval, or an online order is not dispatched yet. Cancelled and returned orders are left out.
- Completed and Pending cannot both be on.
- All = Completed + Pending (+ cancelled/returned).

## Remaining column, dispatch = delivered, calendar alert, print dispatched, delivery report selection (2026-10-09)

- **View Sales:**
  - New Remaining column, with a total.
  - A partly paid sale shows a "Remaining" badge instead of "Partial".
- **Deliveries:**
  - Dispatching an order also delivers it. There is no separate Delivered step: no "Delivered" or "Mark delivered" actions, and the timeline goes Ordered → Dispatched (→ Returned).
  - The "Delivered this month" card is removed.
- **Calendar:**
  - Each day with orders still waiting shows a red "N left" badge in the top-right corner.
  - Dispatched orders show as one green count, and returned orders in grey.
- **Deliveries table toolbar:** a Print button next to Export prints the slips of only the dispatched (scanned) orders in the list, through `saleIds`.
- **Delivery report:** a checkbox column with select-all in the header. Print prints the selected orders, or all of them when none is selected.
- **Data table:** the Excel export skips the `pick` column.

## Doctors table and form, appointments table, Super Admin appointment actions (2026-10-08)

- **Doctors table:** Sr#, Doctor, Phone, Email, Username, Added on and Status. Fee, Commission and Signature are removed.
- **New doctor form:**
  - No Display name, profile Email or Commission inputs. The display name comes from the first and last name, and the email from the login email. The commission defaults on the server.
  - New Gender selector. Editing a doctor still shows the display name, email and commission.
- **Appointment form:** the "Additional notes" field under Medical record is removed.
- **Appointments table:**
  - Appointment # (APP#n), Date (with the day name below) and a separate Time column.
  - The BHRT column is removed.
  - A new "Entered by" column shows who entered the appointment and when. The API list returns `createdByName`.
- **Super Admin on appointments:** only View and Add prescription. Prescriptions are added to the Super Admin's managed modules. Branch admins keep every action.

## Sale detail: one items table (2026-10-08)

- **One Items table:** the Items, Labelled pieces, Batches and Returns sections are merged into it.
- **Columns:** Product, Qty, Batch (with expiry, and qty when split), DSM labels (returned labels struck through), Returned (return no. × qty, linked), Price, Discount and Total.
- **Unchanged:** Payments stays its own table, because it lists money and not products.

## Super Admin pages keep their data after a hard refresh (2026-10-08)

- **Cause:** after a hard refresh, Super Admin requests went out before the branch list had loaded. The Main Warehouse was not known yet, so the overview pages (dashboard, view sales, delivery report) asked for the Main Warehouse alone, got nothing back, and cached that empty answer.
- **Fix:** for a Super Admin, the app shell shows its loader until the branch list has loaded. The first requests then use the right scope.

## Delivery report: office sales by hand-over date, clear date columns (2026-10-08)

- **Dispatch / hand-over date** now includes office sales on their sale day, since they are handed over at the counter. Choosing it no longer forces the sale type to online.
- **Table:** "Date" is now "Booked on". A new "Dispatched on" column shows "Handed over at the counter" for office sales, or "Not sent yet".

## Delivery report monthly and for every branch (2026-10-08)

- **Default dates:** the delivery report and its print default to the current month instead of today.
- **Super Admin:**
  - A Branch filter with "All branches", and a Branch column.
  - From the Main Warehouse with no branch filter, slips from every branch are shown.
  - Each slip's "From" is its own branch.
- **API:** `GET /branch/sales/delivery-slips` allows a Super Admin with no branchId (all branches). Slips carry `branch` and `dispatchedOn`.

## Stock history single table, Super Admin accounts, product dates, delivery report card (2026-10-08)

- **Stock history:** the separate Batches table is removed. The Movements table already shows the batch, Mfg and Expiry.
- **Super Admin:** can add, edit and delete Bank & Cash accounts for the selected branch.
- **Products:** new Created column, sortable.
- **Reports:**
  - The stock report shows each movement's batch. Manufactured is removed.
  - A "Print delivery report" card in Sales opens the delivery report, which prints two slips per A4 page.

## Product size units, no barcode field, Super Admin label counts, report alignment (2026-10-08)

- **Product form:**
  - The barcode scan field is removed. DSM labels are made at stock in.
  - Size has a unit picker: g, kg, mg, ml, l, pieces, tablets, capsules, sachets.
- **Labels (Super Admin):**
  - Batches count the pieces sent to branches: an "In branches" chip, and Sold includes branch sales.
  - Expanding a batch lists the sent pieces with "at <branch>".
- **Reports:**
  - Branch codes such as "001" stay as text and are not shown as numbers.
  - The By branch table aligns its headers with the values: numbers on the right, branch on the left.
  - Accounts balance has no Opening column.

## One accounts screen, sale report filters, delivery report by dispatch date (2026-10-08)

- **Finance:**
  - The Banks screen is removed. "Bank & Cash Accounts" (/account-sheets) adds a bank account by typing the bank name, with suggestions from the existing banks.
  - The table has a Bank column.
  - Editing can change the type, the bank and the date.
- **Sale products report:**
  - Shows only completed sales, one row per sale.
  - Columns, as in posSoft: products, total qty, total amount, discount, after discount, received, remaining, payment and account.
  - Filters: customer or phone, customer city, product, sale type, sale city, method, account, staff, and entry date from/to (plus the date range and the branch).
  - Report numbers show without ".00".
- **Delivery report:** a "Date by" choice (Booking date / Dispatch date). Dispatch date shows online orders by the day they were sent.
- **Deliveries:** the Sent-tab print uses `dateBy=dispatched`.

## Duplicate phone shows branch, print after full scan, Completed sales filter (2026-10-08)

- **Patient phone:**
  - The duplicate notice now names the branch where the patient was first added.
  - A number is matched on its last 9 digits, so "0300…" and "+92 300…" are the same patient.
- **Dispatch dialog:** the print icon shows only once every labelled piece of the order is scanned. It prints the whole order.
- **View Sales:** new "Completed" quick filter. It shows sales that are fully paid with approved payments and handed over: office sales, plus online orders that are dispatched or delivered.

## Slip shows scanned products, dispatched-only printing, two slips per page (2026-10-08)

- **Dispatch dialog print:**
  - The slip lists only the products scanned so far, with the scanned qty. Unlabelled products appear with their full qty.
  - The print icon stays disabled until something is scanned.
- **Deliveries page printing:**
  - "Print N slips" is on the "Sent [day]" tab. It prints the orders dispatched that day, through `delivery-slips?dispatchedOn=`.
  - The Booked and Awaiting tabs no longer print.
  - The row "Print slip" action is hidden while an order is still awaiting dispatch.
- **Print layout:**
  - Slips are paired two per A4 page, with `@page` margin 10mm and 128mm per slip.
  - The divider lines print through print-color-adjust: exact.
- **POS:** the Overall discount row shows only when there is an overall discount.
- **Returns:** new Products filter.
- **Deliveries:** the "Deliver to" column is one line ending in "...", and the full address shows on hover.

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
