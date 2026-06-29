# Multi-Booking Implementation Plan

## Goal

Add paid package bookings for 4, 8, and 12 studio sessions. Customers submit a package request, receive an auto-sent full invoice, admin marks it paid, then the customer schedules sessions through a package scheduling link.

## Rules

- Booking form supports single booking and multi-booking modes.
- Multi-booking form does **not** ask for date/time upfront.
- Package sizes: 4-pack, 8-pack, 12-pack.
- Package validity starts when admin marks the invoice paid:
  - 4-pack: 2 months
  - 8-pack: 4 months
  - 12-pack: 6 months
- Pricing: single-session total multiplied by package size, then package discount:
  - 4-pack: 5% off
  - 8-pack: 10% off
  - 12-pack: 15% off
- Discount appears as a separate invoice line.
- $50 deposit is folded into the full package total. Do not subtract deposit from package invoices.
- Package invoice is auto-sent immediately after request submission.
- Package invoice has a 14-day soft due date. Unpaid packages past due show as overdue, not blocked.
- Overdue packages can be hidden using filters, not permanently removed.
- Admin can cancel unpaid package requests only.
- Admin can resend the same package invoice.
- Admin manually marks package paid.
- If scheduling-link email fails after marking paid, keep package paid and show retry email action.
- Customer schedules package sessions through a public token link.
- Scheduling link expires at the package validity date. After expiry, hide the whole package page.
- No admin extension/regeneration for expired package links in v1.
- Customer can partially schedule sessions and return later.
- Each package slot saves independently.
- Customer can reschedule or clear future scheduled sessions until 24 hours before session start.
- Clearing a session cancels Google Calendar event and keeps cancelled history.
- Session slots can be scheduled in any order.
- Multiple sessions on the same day are allowed if available.
- Package scheduling can book up to package expiry, even beyond normal max-days-ahead.
- Each saved package session creates/updates Google Calendar.
- Each save/change/clear sends a customer email.
- Scheduled package sessions appear in normal admin bookings with a package tag like `Package 3/8`.
- Existing reminder emails still run for each confirmed package session.
- Admin scheduling package sessions is not in v1.
- Keep same terms modal gate before creating package request.

## Implementation Steps

### Step 1: Add shared package rules and pricing helpers
_Done in commit `7425eb1`._

Added shared package pricing rules in `src/sites/studio/features/booking-form/lib/booking-pricing.ts`:

- `MULTI_BOOKING_PLANS` with 4/8/12 package discounts and validity days
- `calculateMultiBookingAmounts(values)`
- `getMultiBookingInvoiceDueAt(createdAt)`
- `getMultiBookingExpiresAt(paidAt, packageSize)`

Implementation notes:

- Reuses existing duration/add-on pricing and editing add-on quantity helpers.
- Duration prices, add-on prices, and invoice currency now live with booking pricing utilities as the shared source of truth.
- Invoice code imports shared pricing constants directly instead of duplicating them.
- No `getMultiBookingPackageConfig` helper was added because direct `MULTI_BOOKING_PLANS[packageSize]` access is simpler.

Check after step:

- 4/8/12 package totals calculate from current single-session pricing.
- Discounts are applied after multiplying full session total.
- Existing single-booking pricing stays unchanged.

### Step 2: Add Convex schema for package records and package-linked bookings
_Done in commit `72473a6`._

Update `convex/schema.ts` without duplicating scheduled-session data:

- Add optional package link fields to `bookings`:
  - `multiBookingPackageId`
  - `multiBookingSlotNumber`
- Keep scheduled package sessions as normal `bookings` rows so they reuse existing date/time, Google Calendar, reminder, and admin booking behavior.
- Add `multiBookingPackages` for package-level state:
  - customer/contact fields used before any sessions are scheduled
  - duration/service/add-ons/notes copied from the package request
  - package size, discount percent, and invoice totals
  - status: `pending_payment`, `paid`, `invoice_email_failed`, `schedule_email_failed`
  - `createdAt`, `invoiceDueAt`, `paidAt`, `expiresAt`, `hiddenAt`
  - invoice metadata/email status fields
  - schedule link token hash/status fields
  - bounded `sessions` array with `slotNumber`, optional `bookingId`, `scheduledAt`, and `cancelledAt`
- Do **not** add a separate `multiBookingSessions` table in v1. Package size is capped at 12, and full scheduled-session data lives on linked `bookings`.
- Add indexes for package-linked bookings, admin package lists, invoice due dates, and public schedule token lookup.

Check after step:

- Package-level payment is modeled separately from per-session scheduling.
- Scheduled package sessions can appear in normal admin bookings because they are normal `bookings` rows.
- Package session slots only point to linked bookings; they do not duplicate date/time/calendar fields.
- Existing bookings table remains compatible.

### Step 3: Build backend package creation flow
Added Convex action/mutation flow in `convex/multiBookings.ts` and `convex/bookings.ts`:

- `createMultiBookingRequest` validates package form input with `multiBookingFormSchema`.
- Checks email domain with shared `emailDomainCanReceiveMail`, reused by the Stripe booking flow.
- Rate-limits package submission with shared `getBookingSubmitRateLimitKey` and existing rate limit helpers.
- Calculates package amounts before creating the package.
- Inserts one `multiBookingPackages` row as `pending_payment`.
- Stores 4/8/12 unscheduled session slot entries in the package `sessions` array.
- Generates invoice artifacts with `createMultiBookingInvoiceArtifacts` and package invoice data from `buildMultiBookingInvoiceData`.
- Auto-sends the package invoice email with a rendered PDF attachment.
- Stores invoice email success/failure state with `markMultiBookingInvoiceEmailAttempt`.

Helper/function names:

- `createMultiBookingRequest`
- `createPendingMultiBooking`
- `markMultiBookingInvoiceEmailAttempt`
- `sendMultiBookingInvoiceEmail`
- `createMultiBookingInvoiceArtifacts`
- `buildMultiBookingInvoiceData`

Check after step:

- Submitting a package creates one package with the correct number of unscheduled session slots.
- Invoice email is attempted immediately.
- Failed invoice email keeps the package record and marks the invoice email attempt as failed.

### Step 4: Add booking form multi-booking mode

Build on the Step 1 shared form/pricing work instead of adding another parallel model:

- Add a single vs multi-booking choice to the existing booking form.
- In multi mode, hide date/time picker and remove date/time from submitted values.
- Show package selector for 4/8/12 using `MULTI_BOOKING_PLANS`.
- Show the calculated package subtotal, discount, and total using `calculateMultiBookingAmounts(values)`.
- Keep duration, service, add-ons, contact fields, notes, and the same terms modal gate.
- Validate multi mode with `multiBookingFormSchema`.
- Submit multi mode to `api.multiBookings.createMultiBookingRequest` instead of Stripe checkout.
- Handle the Result reasons already returned by Step 3:
  - `BOOKING_INVALID_INPUT`
  - `BOOKING_EMAIL_DOMAIN_INVALID`
  - `BOOKING_RATE_LIMITED`
  - `PACKAGE_CREATE_FAILED`
- On success, show a message telling the customer to check email for the invoice.
- If `invoiceEmailStatus` is `failed`, still show success for the saved request, but say the team will follow up with the invoice.

Check after step:

- Single booking still opens Stripe checkout.
- Multi-booking submits without date/time.
- Terms modal still appears before both submit paths.
- Package totals match the invoice math from Step 3.
- Form validation errors are clear for both modes.

### Step 5: Add admin package backend and dashboard section

Add admin package UI separate from normal bookings. Use the existing `multiBookingPackages` table/status fields from Step 2:

- `pending_payment` = invoice sent or awaiting payment.
- `invoice_email_failed` = package exists, invoice email failed, still unpaid.
- `paid` = paid and scheduling link email sent.
- `schedule_email_failed` = paid, but scheduling link email failed.

Backend functions to add:

- List packages for admin with filters for pending, overdue, archived, paid/email-failed.
- Resend invoice for unpaid packages by reusing `sendMultiBookingInvoiceEmail` and `markMultiBookingInvoiceEmailAttempt`.
- Archive/unarchive package by patching `hiddenAt`.
- Mark package paid.
- Retry scheduling-link email for `schedule_email_failed`.

Dashboard should show:

- customer/contact summary
- package size
- service/duration/add-ons
- total due
- due date
- payment/status
- invoice email status/failure
- schedule email status/failure when relevant
- scheduled slot progress from `sessions`

When marking paid:

- Set `paidAt`.
- Set `expiresAt` with `getMultiBookingExpiresAt(paidAt, packageSize)` from Step 1.
- Generate one public schedule token, store only `scheduleTokenHash`, and set `scheduleLinkStatus: "active"`.
- Send scheduling-link email.
- If scheduling email succeeds, set status to `paid`.
- If scheduling email fails, keep `paidAt`, `expiresAt`, and active token, then set status to `schedule_email_failed`.

Check after step:

- Pending package list does not mix with normal booking list.
- `invoice_email_failed` packages still appear as unpaid and actionable.
- Overdue means `now > invoiceDueAt` and unpaid.
- Hidden overdue packages are only hidden by filter, not deleted.
- Mark paid is still allowed after due date.
- Cancel is blocked after payment.

### Step 6: Build package scheduling link backend

Add public token-based queries/actions in `convex/multiBookings.ts` or a nearby package-specific Convex file. Keep sensitive admin-only helpers private/internal.

Suggested public functions:

- `getMultiBookingPackageByToken`
- `getMultiBookingBookableRangeBusyWindows`
- `saveMultiBookingSessionSlot`
- `clearMultiBookingSessionSlot`

Use the Step 2 schema shape:

- Package slots are entries in `multiBookingPackages.sessions`.
- Slot identity is `slotNumber`, not `sessionId`.
- Full scheduled-session data lives on normal `bookings` rows.
- Linked bookings use `multiBookingPackageId` and `multiBookingSlotNumber`.

Rules:

- Token lookup uses `scheduleTokenHash`; never store or compare raw token values.
- Token must belong to a paid package: `paid` or `schedule_email_failed`.
- `scheduleLinkStatus` must be `active`.
- Package must have `expiresAt`, and `Date.now()` must be before it.
- If expired, return a package-link-expired result and do not return package details.
- Bookable end date is the package `expiresAt` date.
- Package scheduling can ignore normal `maxDaysAhead`, but must still respect opening hours, duration validity, lead time, buffers, and Google Calendar busy windows.
- Rescheduling a slot should ignore its own current Google Calendar event.
- Customer edits/clears only allowed until 24 hours before that session start.
- Same-day multiple package sessions are allowed when separate time slots are free.

Check after step:

- Public link cannot access unpaid packages.
- Expired link hides the whole package page.
- Same-day multiple sessions work when separate time slots are free.
- Slot updates are keyed by `slotNumber`.
- Result errors have stable `reason` values for the UI to handle exhaustively.

### Step 7: Build package scheduling page

Create a public route like:

- `src/routes/_public/multi-booking.$token.tsx`

Reuse the existing reschedule page/date-time picker patterns where possible, but use package-specific backend functions because package scheduling can book past the normal max-days-ahead limit.

UI should show:

- package summary
- expiry date
- session progress, e.g. `3 of 8 scheduled`
- slots labelled from `slotNumber`, e.g. `Session 3 of 8`
- unscheduled/scheduled/cancelled states from `sessions`
- per-slot date/time picker
- per-slot save button
- clear button for scheduled future sessions
- locked state for past or within-24-hour sessions
- expired-link state that hides package details

Check after step:

- Customer can schedule one slot and leave others empty.
- Revisiting link shows saved slots.
- Customer can edit or clear future sessions.
- Past or within-24-hour sessions are locked.
- Expired packages do not leak customer/package details.

### Step 8: Create/update bookings and Google Calendar per saved slot

When a slot is saved:

- Create or update a normal `bookings` row for that package session.
- Set booking `status` to `confirmed` without Stripe fields.
- Set required booking timestamps safely, including `pendingPaymentCreatedAt` and `bookingConfirmedAt`.
- Link booking with `multiBookingPackageId` and `multiBookingSlotNumber`.
- Do **not** use `multiBookingSessionId` or stored slot labels; compute labels from `slotNumber` and `packageSize`.
- Patch that session entry with `bookingId` and `scheduledAt`.
- Create/update Google Calendar event and store `googleEventId`/`googleCalendarId` on the booking.
- Send scheduled/rescheduled customer email.

When a slot is cleared:

- Cancel/delete the Google Calendar event.
- Keep cancelled history.
- Patch that session entry with `cancelledAt`.
- Prevent reminder emails for the cleared booking.
- Send clear email.

Schema follow-up needed before clear support:

- Step 2 did not add a cancelled booking status.
- Add `cancelled` to `bookings.status` before using cleared package bookings, or introduce another explicit field that reminder/admin queries can use to exclude cleared sessions.
- Prefer adding `cancelled` because it is clear and keeps reminder filtering simple.
- Update admin booking cards and reminder queries so only active confirmed package sessions appear as upcoming bookings.

Check after step:

- Scheduled package sessions appear in normal admin bookings.
- Admin booking card computes package tag like `Package 3/8` from `multiBookingSlotNumber` and package size.
- Calendar events are created, updated, and cancelled correctly.
- Cleared sessions do not receive reminders.
- Existing reminder job still picks up confirmed package sessions.

### Step 9: Add remaining email templates

The package invoice email/PDF path already exists from Step 3 through `sendMultiBookingInvoiceEmail` and `createMultiBookingInvoiceArtifacts`. Add the remaining package-specific emails:

- package scheduling-link email
- package session scheduled confirmation
- package session rescheduled confirmation
- package session cleared confirmation

Reuse existing booking email primitives where possible.

Check after step:

- Scheduling email includes expiry date and public link.
- Session emails include date/time/timezone and package slot label.
- Failed scheduling email keeps package paid and exposes retry in admin.

### Step 10: Add migration/backfill safety

Most initial schema work is already done in Step 2. Keep rollout focused on small additive follow-ups:

- Existing `bookings` package fields are optional, so no booking backfill is needed.
- If Step 8 adds `cancelled` to `bookings.status`, update all status unions/render paths before writing that status.
- Keep existing booking flows working with missing package fields.
- Keep package labels computed from `multiBookingSlotNumber` + package size; do not add `multiBookingSlotLabel` unless a later UI needs a frozen label.
- No separate `multiBookingSessions` table is needed in v1 because package size is capped at 12.

Check after step:

- Existing bookings query/render paths tolerate missing package fields.
- Existing non-package booking data needs no immediate migration.
- Reminder queries ignore cancelled/cleared package sessions.
## Final Checks

- Run format and lint.
- Do not run build or Convex codegen unless explicitly requested.
- End-to-end manual checks:
  - single booking still works through Stripe
  - multi-booking request sends invoice
  - package appears pending/overdue/hidden correctly
  - admin marks paid and scheduling email sends
  - customer schedules partial sessions and returns later
  - customer edits and clears valid future sessions
  - expired package link hides package page
  - scheduled sessions appear in admin bookings with package tag
  - Google Calendar events and emails match each session action
