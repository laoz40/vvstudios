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

Create shared package constants/helpers near existing booking pricing code, for example:

- `MULTI_BOOKING_PACKAGES`
- `getMultiBookingPackageConfig(packageSize)`
- `calculateMultiBookingPackageAmounts(values)`
- `getMultiBookingInvoiceDueAt(createdAt)`
- `getMultiBookingPackageExpiresAt(paidAt, packageSize)`

Reuse existing duration/add-on pricing and editing add-on quantity helpers.

Check after step:

- 4/8/12 package totals calculate from current single-session pricing.
- Discounts are applied after multiplying full session total.
- Existing single-booking pricing stays unchanged.

### Step 2: Add Convex schema for package records and session slots

Update `convex/schema.ts` with new tables instead of overloading `bookings` too much:

- `multiBookingPackages`
  - customer/contact fields
  - duration/service/add-ons/notes
  - package size, discount percent, totals
  - status: `pending_payment`, `paid`, `invoice_email_failed`, `schedule_email_failed`, `cancelled`
  - `createdAt`, `invoiceDueAt`, `paidAt`, `expiresAt`
  - `hiddenAt` for filtered hidden overdue packages
  - invoice metadata/email status fields
  - schedule link token hash/status fields or relation to separate link table
- `multiBookingSessions`
  - `packageId`
  - `slotNumber`
  - status: `unscheduled`, `confirmed`, `cancelled`
  - optional `bookingId`
  - optional date/time/sessionStartAt
  - optional Google Calendar fields if not stored only on booking

Add indexes for admin lists and public token lookup.

Check after step:

- Schema models package-level payment separately from per-session scheduling.
- No unbounded session arrays inside package docs.
- Existing bookings table remains compatible.

### Step 3: Build backend package creation flow

Add Convex action/mutation flow, likely in `convex/multiBookings.ts`:

- Validate package form input with a package-specific schema.
- Check email domain like the Stripe booking flow.
- Rate-limit package submission using existing rate limit helpers.
- Insert package as `pending_payment`.
- Insert 4/8/12 unscheduled session slot rows.
- Generate invoice artifacts using existing invoice PDF/email infrastructure, adapted for package invoices.
- Auto-send package invoice email.
- Store invoice email success/failure state.

Helper names:

- `createPendingMultiBookingPackage`
- `createMultiBookingSessionSlots`
- `sendMultiBookingInvoiceEmail`
- `buildMultiBookingInvoiceData`

Check after step:

- Submitting a package creates one package and the correct number of slots.
- Invoice email is attempted immediately.
- Failed invoice email does not create duplicate packages on retry.

### Step 4: Add booking form multi-booking mode

Update booking form UI/state:

- Add single vs multi-booking choice.
- In multi mode, hide date/time picker.
- Show package selector for 4/8/12.
- Keep duration, service, add-ons, contact fields, notes, and terms modal.
- Submit multi mode to the new package creation action instead of Stripe checkout.
- Show success message telling customer to check email for invoice.

Check after step:

- Single booking still opens Stripe checkout.
- Multi-booking submits without date/time.
- Terms modal still appears before submit.
- Form validation errors are clear for both modes.

### Step 5: Add admin package dashboard section

Add package admin UI separate from normal bookings:

- Pending/overdue/hidden filters.
- Show package customer, package size, total, due date, status, invoice email status.
- Actions:
  - mark paid
  - resend invoice
  - hide/unhide overdue package
  - cancel unpaid package
  - retry scheduling-link email if failed

When marking paid:

- Set `paidAt` and `expiresAt`.
- Create/activate scheduling token.
- Send scheduling-link email.
- If email fails, keep paid and set `schedule_email_failed`.

Check after step:

- Pending package list does not mix with normal booking list.
- Overdue means `now > invoiceDueAt` and unpaid.
- Hidden overdue packages are only hidden by filter, not deleted.
- Mark paid is still allowed after due date.

### Step 6: Build package scheduling link backend

Add public queries/actions for token-based scheduling:

- `getMultiBookingPackageByToken`
- `getMultiBookingBookableRangeBusyWindows`
- `saveMultiBookingSessionSlot`
- `clearMultiBookingSessionSlot`

Rules:

- Token must be active and not expired.
- If expired, return package-link-expired and do not show package details.
- Bookable end date is package `expiresAt` date.
- Availability checks must include existing Google Calendar busy windows.
- Rescheduling a slot should ignore its own current event.
- Customer edits/clears only allowed until 24 hours before session start.

Check after step:

- Public link cannot access unpaid packages.
- Expired link hides the whole package page.
- Same-day multiple sessions work when separate time slots are free.

### Step 7: Build package scheduling page

Create a public route like:

- `src/routes/_public/multi-booking.$token.tsx`

Reuse the existing reschedule page/date-time picker patterns where possible.

UI should show:

- package summary
- expiry date
- session slots `Session 1 of 8`, etc.
- unscheduled/scheduled/cancelled states
- per-slot date/time picker
- per-slot save button
- clear button for scheduled future sessions

Check after step:

- Customer can schedule one slot and leave others empty.
- Revisiting link shows saved slots.
- Customer can edit or clear future sessions.
- Past or within-24-hour sessions are locked.

### Step 8: Create/update bookings and Google Calendar per saved slot

When a slot is saved:

- Create or update a normal `bookings` record for that session.
- Mark booking as `confirmed` without Stripe fields.
- Link booking to `multiBookingPackageId` and `multiBookingSessionId`.
- Store package label data needed for admin display.
- Create/update Google Calendar event.
- Send save/change email.

When a slot is cleared:

- Cancel/delete Google Calendar event.
- Mark linked booking/session as cancelled history.
- Send clear email.

Check after step:

- Scheduled package sessions appear in normal admin bookings.
- Admin booking card shows package tag.
- Calendar events are created, updated, and cancelled correctly.
- Reminder job still picks up confirmed package sessions.

### Step 9: Add email templates

Add email templates/renderers for:

- package invoice email
- package scheduling-link email
- package session scheduled confirmation
- package session rescheduled confirmation
- package session cleared confirmation

Reuse invoice PDF/email primitives where possible.

Check after step:

- Emails include package/customer details.
- Scheduling email includes expiry date and public link.
- Session emails include date/time/timezone and package slot label.

### Step 10: Add migration/backfill safety

Because this adds tables and possibly optional fields on `bookings`, plan schema rollout carefully:

- Add new tables first.
- Add optional booking link fields only if needed:
  - `multiBookingPackageId`
  - `multiBookingSessionId`
  - `multiBookingSlotLabel`
- Keep existing booking flows working with missing package fields.

Check after step:

- Existing bookings query/render paths tolerate missing package fields.
- No existing booking data needs immediate migration.

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
