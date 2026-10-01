# DSM Clinic Platform — Dashboard

This is the web dashboard of the multi-branch rebuild of posSoft. It is built one phase at a time from `../progress/dashboard.md`.

## Before any work

- Build plan and phase prompts: `../progress/dashboard.md`.
- Current phase: `docs/PROGRESS.md`. Implement ONLY the next phase, or the one the user names. When it is done:
  1. Run lint, typecheck and build.
  2. Mark the phase in `docs/PROGRESS.md`.
  3. STOP and report.
- API contract: `../backend/docs/API.md` and `../backend/docs/openapi.json`. Business rules: `../backend/docs/BUSINESS_FLOW.md`.
- `../posSoft` is a READ-ONLY reference for screens, fields, table columns and print layouts. Copy the business screens, not the code.
- Never modify `../posSoft`, `C:\DSM\dr-shawan` or `../backend`. If the API lacks something, report it instead of working around it.

## Code style (user requirement)

- Clean, self-explanatory code with NO comments: no JSDoc and no `//` notes.
- Keep business logic exactly as posSoft has it. The only additions are branch scoping and role permissions.

## Run

- `npm run api:generate` regenerates `src/lib/api/schema.d.ts` from `../backend/docs/openapi.json`. Run it after every backend API change.
- `npm run dev` starts Vite on http://localhost:3000. It proxies `/api` to `API_PROXY_TARGET`, which defaults to http://localhost:4000. Start the backend first.
- `npm run lint`, `npm run typecheck`, `npm run build`, `npm run format`.
- `.env`: `VITE_API_BASE_URL=/api/v1`, `API_PROXY_TARGET=http://localhost:4000`. See `.env.example`.

## Stack (fixed)

- **Framework:** React 19 + Vite, TypeScript strict. TypeScript is pinned to 5.9 for openapi-typescript.
- **Styling:** Tailwind v4 and shadcn/ui (Radix, new-york style).
- **Libraries:**
  - lucide-react for icons.
  - TanStack Query v5 for server state.
  - TanStack Table **v8** (do not upgrade; v9 has a different API).
  - React Hook Form + zod 4.
  - recharts, date-fns, sonner.
  - `motion`, only for subtle effects.
- **Routing:** react-router with lazy routes. Register screens in `src/app/screens.tsx` and the menu in `src/lib/permissions/menu.ts`.
- **Auth:** login goes through the backend `POST /auth/login`. Tokens are stored in localStorage (`dsm.session`) and refreshed once on 401. No Supabase keys in the browser.
- **API calls:** `api` from `src/lib/api/client.ts` (openapi-fetch). Always use `unwrap()`. For a standard resource use `createCrud` in `src/lib/api/crud.ts`.
- **Branch selection:** a super admin's selected branch is added as `?branchId=` automatically. Never add it by hand.

## Design system (user requirement)

- ALL colors, shadows, radii and layout sizes come from the CSS variables in `src/index.css`. They are exposed to Tailwind through `@theme inline`.
- NEVER hardcode colors in components: no hex, rgb or oklch values, and no `bg-black/50`, `text-white` or raw palette classes like `bg-blue-600`. Use the semantic tokens:
  - `primary`, `primary-soft`
  - `success`, `warning`, `destructive`, `info`, each with a `-soft` variant
  - `muted`, `accent`, `border`, `ring`
  - `chart-1` to `chart-5`
  - the `sidebar-*` tokens
- To add a color, add the token to both `:root` and `.dark`, then map it in `@theme inline`.
- Light mode is the default and dark mode must look right. The theme toggle is in the top bar.
- Use the shared components before building new ones:
  - Layout and states: `page-header`, `panel`, `empty-state`, `error-state`, `skeletons`
  - Tables and actions: `data-table`, `row-actions`, `status-badge`
  - Forms and dialogs: `form-sheet`, `form-fields`, `confirm-dialog`, `money-input`
  - Inputs and media: `file-upload`, `date-range-picker`, `thumb`
  - Other: `print-layout`, `secret-reveal`
- Format money, quantities and dates only with `src/lib/format.ts` (PKR as `Rs`).

## Rules for every screen

- Use the generated API client. Types come from `schema.d.ts`, never handwritten.
- Every list uses the shared `DataTable` with server-side pagination, search and sort. List state lives in the URL through `useListState`.
- Every form:
  - uses Zod, through the helpers in `src/lib/validation.ts`;
  - shows inline errors, including server errors mapped with `applyServerErrors`;
  - disables submit while saving;
  - shows a toast on success and on error.
- Hide actions the role cannot use, with `can()` / `canAny()`. The backend still enforces every action; never rely on hiding alone.
- Screens must work at laptop widths (1280px and up) and on tablets (768px and up).
- No business calculations in the UI that the backend already does, such as totals, stock and balances. Show what the API returns. A preview must be labelled as one.
- Computed RHF default values must be stable. Never call a random or time function inside `values`; use `useState(fn)` and remount with a `key`.

## SCREEN CHECKLIST

Tick every item before marking a screen done:

- [ ] Route registered in `screens.tsx` with the right `anyOf` permissions and scope (`branch` / `platform` / `any`).
- [ ] Menu item in `menu.ts`, with the `phase` flag removed.
- [ ] `PageHeader` with a title, a description and a primary action that is hidden without permission.
- [ ] `DataTable` with server pagination, search, sort keys, filters, empty state, error state with retry, and skeleton rows.
- [ ] Column visibility and CSV export work. Money and quantity columns are right-aligned with `tabular-nums`.
- [ ] Create and edit form: Zod schema, inline errors, server field errors, disabled submit, toasts.
- [ ] Delete and status changes use `ConfirmDialog` and show the backend's error message (for example "in use").
- [ ] Row actions are hidden by permission. A branch-scoped screen works for a super admin once a branch is selected.
- [ ] Uploads use `FileUpload`. Private files open through signed URLs.
- [ ] Only global CSS tokens are used. Checked in light and dark mode.
- [ ] Checked at 1440px and 820px widths. No horizontal page scroll; the table scrolls inside its card.
- [ ] Fields, columns and actions match the posSoft screen.
- [ ] `npm run lint`, `npm run typecheck` and `npm run build` pass.
