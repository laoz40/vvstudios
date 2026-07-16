# Multi-Booking Implementation Plan

## Goal

Add paid package bookings for 4, 8, and 12 studio sessions. Customers submit a package request, receive a full invoice, admin marks it paid, then the customer schedules package sessions through a private link.

## Current source of truth

### Package rules

- Booking form supports `single` and `multi` modes.
- Multi-booking does not ask for date/time upfront.
- Package sizes: 4, 8, 12 sessions.
- Package validity starts when admin marks the invoice paid:
  - 4-pack: 60 days
  - 8-pack: 120 days
  - 12-pack: 180 days
- Package discounts:
  - 4-pack: 5% off
  - 8-pack: 10% off
  - 12-pack: 15% off
- Package total = current single-session total x package size, minus discount.
- Discount is stored as a separate invoice line item snapshot.
- Package invoice due date is 14 days after request creation.
- Unpaid overdue packages are filterable/archivable, not deleted.
- Package scheduling uses a private token link and hides details when invalid/expired/inactive/unpaid.
- Scheduling can book through package expiry, past the normal max-days-ahead limit.
- Package sessions are stored as normal `bookings` rows linked back to the package.

## Implementation Steps

### Step 1: Add shared package rules and pricing helpers

_Implemented. Keep this as the shared source for package pricing rules._

Add package pricing rules in `src/sites/studio/features/booking-form/lib/booking-pricing.ts`:

- `MULTI_BOOKING_PLANS` with 4/8/12 package discounts and validity days
- `calculateMultiBookingAmounts(values)`
- `getMultiBookingInvoiceDueAt(createdAt)`
- `getMultiBookingExpiresAt(paidAt, packageSize)`
- shared duration prices, add-on prices, and invoice currency

Implementation notes:

- Reuses existing duration/add-on pricing and editing add-on quantity helpers.
- Duration prices, add-on prices, and invoice currency live with booking pricing utilities as the shared source of truth.
- Invoice code imports shared pricing constants directly instead of duplicating them.
- No `getMultiBookingPackageConfig` helper was added because direct `MULTI_BOOKING_PLANS[packageSize]` access is simpler.
- Current validity uses days, not calendar months: 60, 120, and 180 days.

Check after step:

- 4/8/12 package totals calculate from current single-session pricing.
- Discounts are applied after multiplying full session total.
- Existing single-booking pricing stays unchanged.

### Step 2: Add Convex schema for package records and package-linked bookings

_Implemented. Keep scheduled package sessions as normal bookings._

Update `convex/schema.ts` without duplicating scheduled-session data:

- Add optional package link fields to `bookings`:
  - `multiBookingPackageId`
  - `multiBookingSlotNumber`
- Keep scheduled package sessions as normal `bookings` rows so they reuse existing date/time, reminder, admin booking, and later Google Calendar behavior.
- Add `multiBookingPackages` for package-level state:
  - customer/contact fields used before any sessions are scheduled
  - duration/service/add-ons/notes copied from the package request
  - package size, discount percent, and invoice totals
  - current status values: `pending_payment`, `paid`, `invoice_email_failed`, `schedule_email_failed`
  - `createdAt`, `invoiceDueAt`, `paidAt`, `expiresAt`, `hiddenAt`
  - invoice metadata/email status fields
  - `scheduleTokenHash` and `scheduleLinkStatus`
  - bounded `sessions` array with `slotNumber`, optional `bookingId`, `scheduledAt`, and `cancelledAt`
- Do **not** add a separate `multiBookingSessions` table in v1. Package size is capped at 12, and full scheduled-session data lives on linked `bookings`.
- Add indexes for package-linked bookings, admin package lists, invoice due dates, and public schedule token lookup.

Check after step:

- Package-level payment is modeled separately from per-session scheduling.
- Scheduled package sessions can appear in normal admin bookings because they are normal `bookings` rows.
- Package session slots only point to linked bookings; they do not duplicate date/time/calendar fields.
- Existing bookings table remains compatible.

### Step 3: Build backend package creation flow

_Implemented mainly in `convex/multiBookings.ts`, `convex/bookings.ts`, and invoice helpers._

Add Convex action/mutation flow:

- `createMultiBookingRequest` validates package form input with `multiBookingFormSchema`.
- Checks email domain with shared `emailDomainCanReceiveMail`, reused by the Stripe booking flow.
- Rate-limits package submission with shared `getBookingSubmitRateLimitKey` and existing rate limit helpers.
- Calculates package amounts before creating the package.
- Inserts one `multiBookingPackages` row as `pending_payment`.
- Stores 4/8/12 unscheduled session slot entries in the package `sessions` array.
- Snapshots invoice line items with `createMultiBookingInvoiceLineItemSnapshot`.
- Generates package invoice artifacts and auto-sends the package invoice email with rendered PDF attachment.
- Stores invoice email success/failure state with `markMultiBookingInvoiceEmailAttempt`.

Helper/function names:

- `api.multiBookings.createMultiBookingRequest`
- `internal.bookings.createPendingMultiBooking`
- `internal.bookings.markMultiBookingInvoiceEmailAttempt`
- `sendMultiBookingInvoiceEmail`
- `createMultiBookingInvoiceArtifacts`
- `buildMultiBookingInvoiceData`

Check after step:

- Submitting a package creates one package with the correct number of unscheduled session slots.
- Invoice email is attempted immediately.
- Failed invoice email keeps the package record and marks the invoice email attempt as failed.

### Step 4: Add booking form multi-booking mode

_Implemented in booking form model/components._

Build on the shared form/pricing work instead of adding another parallel model:

- Add `bookingMode: "single" | "multi"` to the booking form.
- In multi mode, hide date/time picker and remove date/time from submitted package values.
- Show package selector for 4/8/12 using `MULTI_BOOKING_PLANS`.
- Show calculated package subtotal, discount, and total using `calculateMultiBookingAmounts(values)`.
- Keep duration, service, add-ons, contact fields, notes, and the same terms modal gate.
- Validate multi mode with `multiBookingFormSchema`.
- Submit multi mode to `api.multiBookings.createMultiBookingRequest` instead of Stripe checkout.
- Handle Result reasons returned by Step 3:
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

_Implemented in `convex/bookings.ts`, `convex/multiBookings.ts`, and `src/sites/studio/features/admin/*`._

Add admin package UI separate from normal bookings. Use `multiBookingPackages` status fields:

- `pending_payment` = invoice sent or awaiting payment
- `invoice_email_failed` = package exists, invoice email failed, still unpaid
- `paid` = paid and scheduling link email sent
- `schedule_email_failed` = paid, but scheduling link email failed

Backend functions/actions:

- List packages for admin with filters for pending, overdue, archived, paid, and email-failed states.
- Resend invoice for unpaid packages by reusing `sendMultiBookingInvoiceEmail` and `markMultiBookingInvoiceEmailAttempt`.
- Archive/unarchive package by patching `hiddenAt`.
- Mark package paid through `api.multiBookings.confirmPackagePayment`.
- Retry scheduling-link email through `api.multiBookings.retryMultiBookingSchedulingEmail`.

Dashboard should show:

- customer/contact summary
- package size
- service/duration/add-ons
- total due
- due date or package expiry date
- payment/status
- scheduled slot progress from `sessions`
- package actions

When marking paid:

- Set `paidAt`.
- Set `expiresAt` with `getMultiBookingExpiresAt(paidAt, packageSize)` from Step 1.
- Generate one public schedule token and store only `scheduleTokenHash`.
- Set `scheduleLinkStatus: "active"`.
- Send scheduling-link email.
- If scheduling email succeeds, set status to `paid`.
- If scheduling email fails, keep `paidAt`, `expiresAt`, and active token, then set status to `schedule_email_failed`.

Implementation difference from earlier plan:

- Direct `markPackagePaymentStatus` only supports marking unpaid. Marking paid must go through the confirmation action so the schedule token/email flow runs.

Check after step:

- Pending package list does not mix with normal booking list.
- `invoice_email_failed` packages still appear as unpaid and actionable.
- Overdue means `now > invoiceDueAt` and unpaid.
- Hidden overdue packages are only hidden by filter, not deleted.
- Mark paid is still allowed after due date.
- Cancel/mark unpaid is not the normal paid path; paid confirmation must create schedule token and send/retry the email.

### Step 6: Build package scheduling link backend

_Implemented in `convex/packageScheduling.ts` and `convex/packageSchedulingCalendar.ts`._

Add public token-based queries/actions in package-specific Convex files. Keep sensitive admin-only helpers private/internal.

Public functions:

- `api.packageScheduling.getPackageByToken`
- `api.packageScheduling.savePackageSlot`
- `api.packageScheduling.clearPackageSlot`
- `api.packageSchedulingCalendar.getPackageBusyWindows`

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
- If expired/invalid/inactive/unpaid, return a Result error and do not return package details.
- Bookable end date is the package `expiresAt` date.
- Do not duplicate Google Calendar busy-window logic. Package busy windows load from today through package expiry.
- Package scheduling can ignore normal `maxDaysAhead`, but must still respect opening hours, duration validity, lead time, buffers, and Google Calendar busy windows.
- Same-day multiple package sessions are allowed when separate time slots are free.

Current implementation gaps to handle in Step 9:

- Server-side save validates booking settings but does not re-check Google Calendar conflicts at write time.
- Edit/clear lock is currently date-based (`booking.date <= today`), not the intended 24-hour cutoff.

Check after step:

- Public link cannot access unpaid packages.
- Expired link hides the whole package page.
- Same-day multiple sessions work when separate time slots are free.
- Slot updates are keyed by `slotNumber`.
- Result errors have stable `reason` values for the UI to handle exhaustively.

### Step 7: Build package scheduling page

_Implemented at `src/routes/_public/multi-booking.$token.tsx` with extracted package scheduling components._

Create public route:

- `src/routes/_public/multi-booking.$token.tsx`

Reuse existing booking date/time picker patterns where possible, but use package-specific backend function wrappers because package scheduling can book past the normal max-days-ahead limit. The underlying Google Calendar busy-window loading stays shared.

UI should show:

- package/session summary
- session progress, e.g. `3 of 8 scheduled`
- slots labelled from `slotNumber`, e.g. `Session 3 of 8`
- unscheduled/scheduled/cancelled states from `sessions`
- expiry date
- per-slot date/time picker
- per-slot save button
- clear button for scheduled future sessions
- locked state for sessions that can no longer be edited
- expired/invalid-link state that hides package details
- loading states and success/error toasts
- saved session highlight

Implementation notes:

- The page uses `PackageScheduleSummary` and `PackageSessionsAccordion`.
- Save and clear actions use the shared booking modal host for confirmation.

Check after step:

- Customer can schedule one slot and leave others empty.
- Revisiting link shows saved slots.
- Customer can edit or clear allowed future sessions.
- Locked sessions cannot be edited/cleared.
- Expired packages do not leak customer/package details.

### Step 8: Create/update bookings per saved slot

_Partially implemented in `convex/packageScheduling.ts`. Calendar and session emails still belong to Step 9._

When a slot is saved:

- Create or update a normal `bookings` row for that package session.
- Set booking `status` to `confirmed` without Stripe fields.
- Set required booking timestamps safely, including `pendingPaymentCreatedAt`, `paymentCompletedAt`, and `bookingConfirmedAt`.
- Link booking with `multiBookingPackageId` and `multiBookingSlotNumber`.
- Do **not** use `multiBookingSessionId` or stored slot labels; compute labels from `slotNumber` and `packageSize`.
- Patch that session entry with `bookingId`, `scheduledAt`, and clear any prior `cancelledAt`.
- Existing slot reschedule resets reminder email claim/send fields.

When a slot is cleared:

- Current behavior patches that session entry with `cancelledAt`.
- Current behavior does not yet mark the linked booking cancelled or remove it from reminder/admin active booking queries.

Not included yet and moved to Step 9:

- Create/update/cancel Google Calendar events.
- Store `googleEventId`/`googleCalendarId` for package session calendar operations.
- Send scheduled/rescheduled/cleared customer emails.
- Add a proper booking cancellation model for cleared slots.
- Enforce the true 24-hour edit/clear cutoff.

Check after step:

- Scheduled package sessions are stored as normal bookings.
- Package slot entries point to linked bookings.
- Admin booking card can compute package tag like `Package 3/8` from `multiBookingSlotNumber` and package size.
- Existing reminder job still picks up active confirmed package sessions.
## Remaining work

### Step 9: Finish package slot lifecycle

Make saved and cleared package sessions behave like real confirmed/cancelled bookings end-to-end.

Tasks:

- Add a clear cancellation model for package session bookings:
  - preferred: add `cancelled` to `bookings.status`, then update all booking status unions/render paths/reminder filters; or
  - add an explicit cancellation field if that is safer after review.
- Update reminder/admin booking queries so cleared package sessions do not appear as active upcoming bookings and do not receive reminders.
- On slot save/reschedule:
  - re-check Google Calendar availability server-side before committing or before finalizing the booking
  - create/update the Google Calendar event
  - store `googleEventId` and `googleCalendarId` on the linked booking
  - send package session scheduled/rescheduled email
- On slot clear:
  - cancel/delete the Google Calendar event when one exists
  - record cancellation clearly on the linked booking/package session
  - send package session cleared email
- Replace the current date-based lock with the intended 24-hour cutoff if that rule still stands.
- Keep labels computed from `multiBookingSlotNumber` + package size, e.g. `Package 3/8`.

Check after step:

- package sessions create/update/delete Google Calendar events correctly
- cleared sessions do not receive reminders
- admin bookings only show active scheduled package sessions
- package scheduled/rescheduled/cleared emails include date, time, timezone, and slot label
- same-day multiple package sessions still work when separate times are free


## Final manual checks

- single booking still works through Stripe
- multi-booking request sends invoice
- package appears pending/overdue/hidden correctly
- admin marks paid and scheduling email sends
- failed schedule email keeps package paid-ready and retryable
- customer schedules partial sessions and returns later
- customer edits and clears allowed future sessions
- expired package link hides package details
- active package sessions appear in admin bookings with package tags
- Google Calendar events and emails match each session action

Do not run build or Convex codegen unless explicitly requested.
