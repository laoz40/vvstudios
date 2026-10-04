# Plans index

One-screen map of `plans/`. Open the linked file for full PR stacks, stages, and file trees. For implementation guardrails see [AGENTS.md](../AGENTS.md).

## Active epics

| Plan | Summary | Stack / status | Start here |
| --- | --- | --- | --- |
| [14-admin-search.mdx](./14-admin-search.mdx) | Server-side admin search (`searchBlob`, `field:` prefixes, refine banner) | **5 PR launch stack** — PRs 1–3 merged; **PR 4** (search UX) and **PR 5** (backfill ops) in progress on `feat/admin-search-ux`. Deploy search only after PR 5 merges. | `convex/lib/adminSearchQuery.ts`, `convex/lib/adminSearchPagination.ts`, `convex/lib/adminBookingSearch.ts`, `convex/lib/adminPackageSearch.ts`, `src/sites/studio/features/admin/lib/admin-list-pagination.ts`, `src/sites/studio/features/admin/components/AdminDashboard.tsx` |
| [12-upfront-stripe-payments.mdx](./12-upfront-stripe-payments.mdx) | Full upfront Stripe checkout, receipts, package checkout, adjustment invoicing | **6-stage `gh stack`** — stages 1–3 done; **4a** open (PR #96); **4b** and **5** in progress | Stage table in plan → `convex/services/stripe.ts`, `convex/http.ts`, `src/sites/studio/features/booking-form/`, `src/sites/studio/features/admin/` |

## Shipped (keep for reference)

| Plan | Summary | Status |
| --- | --- | --- |
| [13-admin-sessions-inbox.mdx](./13-admin-sessions-inbox.mdx) | Inbox / All sessions tabs, server lists, auto-archive | Stages 1–4 **done** — see `convex/lib/sessionArchive.ts`, `convex/lib/adminSessionList.ts`, `AdminInboxAllViewTabs.tsx` |

## Feature and migration plans

| Plan | Topic |
| --- | --- |
| [11-google-drive-session-workspaces.md](./11-google-drive-session-workspaces.md) | Google Drive client/session workspaces (vertical slices) |
| [10-editor-dashboard.md](./10-editor-dashboard.md) | Editor permissions and restricted sessions dashboard |
| [08-package-adjustment-invoices.md](./08-package-adjustment-invoices.md) | Automatic Remote Podcast adjustment invoices (superseded in part by plan 12 stage 3) |
| [07-package-scheduling-booking-refactor.md](./07-package-scheduling-booking-refactor.md) | Package sessions as normal `bookings` rows |
| [06-multi-booking-implementation.md](./06-multi-booking-implementation.md) | Multi-session package bookings (4 / 8 / 12) |
| [04-client-rescheduling.md](./04-client-rescheduling.md) | Customer reschedule via invoice email token |
| [03-reschedule-google-calendar-from-admin-dashboard.md](./03-reschedule-google-calendar-from-admin-dashboard.md) | Admin edit → Google Calendar sync |
| [02-route-migration.md](./02-route-migration.md) | `/studio/` child site under parent domain |
| [01-stripe-implementation.md](./01-stripe-implementation.md) | Original minimal deposit Stripe plan (teaching notes; historical) |

## Merged PR stacks (documented)

- **Admin search (14):** shell → receipt model → search backend → search UX → backfill ops → post-deploy dashboard backfill → optional PR 6 cleanup (canonical phone, required fields).
- **Upfront Stripe (12):** `session-checkout` → `package-checkout` → `adjustment-invoicing` → `admin-billing` (4a) → `admin-stripe-invoicing` (4b) → `tests-cleanup` (5). Use `gh stack` workflow in the plan.
- **Admin sessions inbox (13):** editor decouple → inbox/all lists → auto-archive → manual archive UX (all shipped).
