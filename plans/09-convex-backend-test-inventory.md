# Essential Convex Backend Behaviour Tests

## Scope

This list intentionally excludes small helper tests, formatting tests, payload-shape tests, and exhaustive validation permutations.

The goal is to test the backend behaviours that could cause real customer, scheduling, payment, or administrative problems if they break. Tests should normally invoke the real Convex query, mutation, action, or HTTP endpoint and assert both the returned result and final database state.

External providers such as Stripe, Google Calendar, DNS, and Resend should be replaced with controlled fakes at their boundaries.

Priority:

- **P0** — payment, authorization, double-booking, idempotency, or destructive-operation integrity.
- **P1** — core customer/admin workflow behaviour.

---

## 1. Authorization

| ID | Priority | Behaviour test | Expected outcome | Primary targets |
|---|---:|---|---|---|
| AUTH-01 | P0 | Admin APIs reject anonymous and non-admin users | Admin booking edits/deletes, package edits/payment actions, invoice actions, settings changes, and deliverables email return the correct auth failure and perform no database or external side effects. Use a parameterized test across the admin endpoints. | `convex/bookings.ts`, `googleCalendar.ts`, `multiBookings.ts`, `customInvoices.ts`, `invoices.ts`, `bookingSettings.ts`, `deliverablesEmail.ts` |
| AUTH-02 | P0 | Admin list queries cannot expose operational data | Anonymous and non-admin calls to `getBookings` and `listPackages` fail; an admin can read them. | `bookings.getBookings`, `bookings.listPackages` |

---

## 2. Single-session booking and payment

| ID | Priority | Behaviour test | Expected outcome | Primary targets |
|---|---:|---|---|---|
| BOOK-01 | P1 | Invalid booking submission has no side effects | Representative invalid customer data and an invalid scheduling request return the stable validation error without creating a booking or Stripe session. Do not exhaustively test every individual field. | `stripe.createEmbeddedCheckoutSession`, `bookings.createPendingBooking` |
| BOOK-02 | P0 | Unavailable booking time is rejected by the backend | Past, outside-hours, too-soon, too-far-ahead, and conflicting slots are rejected even if the client submits them directly; no confirmed booking or Calendar event is created. Implement as one parameterized behaviour test. | `bookings.createPendingBooking`, `googleCalendar.completeClaimedBooking` |
| BOOK-03 | P0 | Successful checkout creates one linked pending booking | A valid request creates one `pending_payment` booking, creates the expected Stripe checkout, and stores the Stripe session ID on that booking. | `stripe.createEmbeddedCheckoutSession` |
| BOOK-04 | P0 | Closing an incomplete checkout abandons only its booking | An open Stripe session is expired and its matching pending booking becomes `abandoned`; a completed or mismatched session does not incorrectly abandon a booking. | `stripe.closeEmbeddedCheckoutSession`, `bookings.deletePendingBooking` |
| BOOK-05 | P0 | Stripe completion claim is idempotent | The first valid completion claims the pending booking and records Stripe identifiers; a duplicate event does not overwrite claim data or start completion twice. | `bookings.claimBookingCompletion`, `convex/http.ts` |
| BOOK-06 | P0 | Successful payment completion confirms the booking exactly once | The backend rechecks availability, creates one Google Calendar event, changes the booking to `confirmed`, stores Calendar IDs, and performs confirmation/invoice email work once. | `googleCalendar.completeClaimedBooking` |
| BOOK-07 | P0 | Slot becoming unavailable during checkout prevents confirmation | If the slot becomes busy after checkout starts but before payment completion, no Calendar event is created and the booking records the supported time-unavailable failure state. | `googleCalendar.completeClaimedBooking` |
| BOOK-08 | P0 | Calendar creation failure records a recoverable booking failure | Google failure does not leave the booking confirmed; the correct failure state is saved and confirmation email is not sent. | `googleCalendar.completeClaimedBooking` |
| BOOK-09 | P0 | Two customers cannot both complete the same slot | Concurrent completion attempts for two bookings targeting the same time result in at most one confirmed booking and one Calendar event. This is an important risk-revealing test. | `googleCalendar.completeClaimedBooking` |
| BOOK-10 | P0 | Stripe webhook rejects untrusted requests and ignores replays | Missing/invalid signatures cause no state changes; valid duplicate completion events return success without duplicate Calendar or email effects. | `convex/http.ts` |

---

## 3. Customer rescheduling

| ID | Priority | Behaviour test | Expected outcome | Primary targets |
|---|---:|---|---|---|
| RES-01 | P0 | Only a valid active token can access a reschedulable booking | Unknown, used, expired, past-session, and wrong-status links are rejected; supported confirmed/email-failed/recoverable-failed bookings are accepted. Use one state-matrix test. | `bookingReschedule.getValidRescheduleLinkAndBookingInternal` |
| RES-02 | P0 | Issuing a new reschedule link invalidates previous links | Only the newest link remains active and only token hashes are stored. | `bookingReschedule.createActiveRescheduleLinkInternal` |
| RES-03 | P0 | Invalid or busy target leaves the original booking untouched | The original Calendar event, booking timing, token state, and reminder state remain unchanged when the requested slot fails backend availability checks. | `googleCalendar.rescheduleBooking` |
| RES-04 | P0 | Successful reschedule updates all related state | The Calendar event and booking timing move together, reminder state resets, the submitted link becomes used, a replacement link is created, and update emails run once. | `googleCalendar.rescheduleBooking`, `bookings.saveClientBookingRescheduleInternal` |
| RES-05 | P0 | Recoverable failed booking can reschedule into confirmed state | A booking failed because its original time or Calendar creation was unavailable gets a new event, becomes `confirmed`, and clears the old failure code. | `googleCalendar.rescheduleBooking` |
| RES-06 | P0 | One reschedule token cannot be used concurrently twice | Concurrent submissions with the same token produce one successful move and at most one set of emails. This is an important risk-revealing test. | `googleCalendar.rescheduleBooking`, reschedule-link mutations |

---

## 4. Admin session workflows

| ID | Priority | Behaviour test | Expected outcome | Primary targets |
|---|---:|---|---|---|
| ADMIN-01 | P0 | Admin timing edit cannot create a Calendar conflict | Editing around normal availability settings may be allowed for admin, but a conflicting Google event still rejects the change and leaves the booking untouched. | `googleCalendar.updateBookingFromAdmin` |
| ADMIN-02 | P0 | Editing a confirmed session keeps Convex and Calendar synchronized | Timing/customer/session changes update or recreate the Google event as required and persist the matching booking data and Calendar IDs. | `googleCalendar.updateBookingFromAdmin`, `lib/bookingAdminEdit.ts` |
| ADMIN-03 | P0 | Admin can recover a supported failed booking | A valid edit creates the missing Calendar event and promotes the booking to `confirmed`; unavailable or Google-failed attempts leave it failed. | `googleCalendar.updateBookingFromAdmin` |
| ADMIN-04 | P1 | Timing edits reset reminders but ordinary edits do not | A timing change clears reminder claim/sent/failure state; contact, notes, and other non-timing edits preserve it. | `bookings.saveAdminBookingUpdateInternal` |
| ADMIN-05 | P0 | Admin financial edit stores one coherent recalculation | Editing duration/add-ons/quantities updates the booking balance consistently; an explicit valid override is respected and negative balances cannot be stored. | `bookings.updateBooking`, `updateBookingRemainingBalanceAmount` |
| ADMIN-06 | P0 | Admin deletion changes the booking only after Calendar deletion | Google deletion failure leaves the booking active; success or an already-missing event clears Calendar IDs and sets `cancelled`. | `googleCalendar.deleteBookingFromAdmin` |
| ADMIN-07 | P1 | Session status changes obey supported source states | Editable statuses can transition as currently supported; pending/expired/abandoned/cancelled sources cannot be changed through the admin status mutation. | `bookings.updateBookingStatus` |

---

## 5. Package purchase and payment

| ID | Priority | Behaviour test | Expected outcome | Primary targets |
|---|---:|---|---|---|
| PKG-01 | P1 | Valid package request stores the correct commercial snapshot | One pending package is created with normalized customer data, package size, calculated price/discount/line items, seven-day invoice due date, and pending invoice state. | `multiBookings.createMultiBookingRequest`, `bookings.createPendingMultiBooking` |
| PKG-02 | P1 | Invalid package request creates nothing | Representative invalid form/package data or undeliverable email returns the stable error without package or email side effects. | `multiBookings.createMultiBookingRequest` |
| PKG-03 | P0 | Invoice delivery result drives package invoice state | Successful delivery records invoice metadata; failed delivery preserves the package but records `invoice_email_failed` so admin can retry. | `multiBookings.createMultiBookingRequest`, `bookings.markMultiBookingInvoiceEmailAttempt` |
| PKG-04 | P0 | Package payment confirmation is admin-only and idempotent | Only an unpaid package can transition once; repeated/concurrent confirmation cannot create multiple paid lifecycles or tokens. | `multiBookings.confirmPackagePayment` |
| PKG-05 | P0 | Confirming payment initializes the complete scheduling lifecycle | Paid time, package-size-based expiry, active token hash, expiry adjustment job, and scheduling-email state are created together. | `bookings.markPackagePaidAndCreateScheduleTokenInternal` |
| PKG-06 | P0 | Scheduling email success/failure is recoverable | Success completes `paid`; failure leaves `schedule_email_failed`; retry rotates the token while retaining original paid and expiry times. | `multiBookings.confirmPackagePayment`, `retryMultiBookingSchedulingEmail` |
| PKG-07 | P0 | Marking a package unpaid revokes scheduling access | Paid/expiry/token/link/reminder state is cleared and old scheduling tokens stop working. | `bookings.markPackagePaymentStatus` |
| PKG-08 | P0 | Package token enforces payment, link status, and expiry | Unknown, unpaid, disabled, and expired package links cannot read or mutate package scheduling data. | `packageScheduling.getPackageByToken`, token helpers |
| PKG-09 | P0 | Admin cannot shrink a package below used capacity | The edit is rejected without changing package fields or financial snapshots. | `bookings.updatePackageFromAdmin` |
| PKG-10 | P0 | Admin package pricing edit updates its snapshot atomically | Session amount, subtotal, discount, total, and invoice line items remain coherent after edit; a valid custom total affects only the intended final amount. | `bookings.updatePackageFromAdmin` |

---

## 6. Scheduling package sessions

| ID | Priority | Behaviour test | Expected outcome | Primary targets |
|---|---:|---|---|---|
| SCHED-01 | P0 | Package session creation enforces token ownership, expiry, availability, and capacity | Direct submissions cannot schedule another package, exceed package size, use an expired package, or select an unavailable time. | `packageScheduling.createPackageBooking` |
| SCHED-02 | P0 | Successful package scheduling creates matching Calendar and booking records | The Calendar event is created and one confirmed booking is stored with package/customer snapshot, per-session options, package ID, and Calendar IDs. | `packageScheduling.createPackageBooking`, `saveCreatedPackageBookingInternal` |
| SCHED-03 | P0 | Concurrent requests for the final package slot have one winner | At most one booking is inserted; a losing request removes any Calendar event it created. | Package create action/mutation; concurrency test |
| SCHED-04 | P0 | Calendar success followed by booking-save failure is compensated | The backend attempts to remove the newly created Calendar event and returns the correct failure rather than silently leaking it. | `packageScheduling.createPackageBooking` |
| SCHED-05 | P0 | Package session reschedule enforces ownership and lock window | Wrong-package and lead-time-locked sessions cannot move; invalid/busy targets preserve original booking and event. | `packageScheduling.reschedulePackageBooking` |
| SCHED-06 | P0 | Successful package reschedule updates event and booking together | New timing and Calendar IDs are saved, reminder state resets, and package adjustment reevaluation is scheduled. | `packageScheduling.reschedulePackageBooking` |
| SCHED-07 | P0 | Package session unschedule frees capacity only after Calendar deletion | Failed deletion preserves the booking; success/already-missing event cancels it and allows another package session to be scheduled. | `packageScheduling.unschedulePackageBooking` |

---

## 7. Package adjustment closeout

| ID | Priority | Behaviour test | Expected outcome | Primary targets |
|---|---:|---|---|---|
| ADJ-01 | P0 | Closeout charges only completed eligible Remote Podcast sessions | Only ended, capacity-consuming package sessions with Remote Podcast count; unrelated, cancelled, or still-running sessions do not. | Package adjustment processor |
| ADJ-02 | P0 | Package does not close out too early | Completion closeout requires all package slots scheduled and all relevant sessions ended; expiry jobs with stale expiry data are ignored. | `processPackageAdjustmentWhenSessionsCompleteInternal`, `processPackageAdjustmentAtExpiryInternal` |
| ADJ-03 | P0 | Closeout creates the correct no-charge or invoice-required outcome | Zero eligible sessions create one internal no-charge record and no email; positive usage creates one unpaid invoice snapshot with seven-day due date and schedules delivery. | Package adjustment processor |
| ADJ-04 | P0 | Closeout is idempotent under retries and concurrent jobs | One package produces at most one adjustment and one automatic invoice job regardless of repeated expiry/completion triggers. | Package adjustment processor; concurrency test |
| ADJ-05 | P0 | Adjustment invoice delivery claim has one sender | Concurrent/replayed automatic or retry attempts cannot send the same adjustment invoice twice; stale claim timeouts cannot overwrite a newer attempt. | `packageAdjustments.claimPackageAdjustmentInvoiceEmail` and result mutations |
| ADJ-06 | P0 | Adjustment delivery status remains recoverable | Successful email marks sent; provider/render failure marks failed and allows admin retry; stored financial values are used rather than current pricing. | `packageAdjustmentInvoices.sendPackageAdjustmentInvoiceInternal` |
| ADJ-07 | P0 | Adjustment payment and download require admin and a sent invoice | Pending/failed/no-charge adjustments cannot be marked paid or downloaded as if sent; valid sent invoices can be toggled paid and downloaded. | `packageAdjustments.markPackageAdjustmentPaymentStatus`, `getAdminPackageAdjustmentInvoicePdf` |

---

## 8. Invoice access and financial integrity

| ID | Priority | Behaviour test | Expected outcome | Primary targets |
|---|---:|---|---|---|
| INV-01 | P0 | Booking invoice amount remains financially valid | Duration, add-ons, independent edit quantities, deposit, and optional admin override produce the expected nonnegative total and balancing adjustment. Test through artifact generation rather than each helper. | Booking invoice artifact flow |
| INV-02 | P0 | Package invoice uses its stored commercial snapshot | Later pricing or configuration changes do not alter an existing package invoice. | `lib/bookingInvoiceArtifacts.ts` |
| INV-03 | P0 | Custom invoices require admin, valid source, and valid total | Missing source and negative/non-finite totals create no invoice; valid booking/package custom invoices store a final invoice number and requested total. | `convex/customInvoices.ts` |
| INV-04 | P0 | Public invoice downloads obey access windows and lifecycle | Single and package public downloads reject missing, invalid-state, or expired records; admin download remains available where designed. | `convex/invoices.ts` |

---

## 9. Reminders and operational emails

| ID | Priority | Behaviour test | Expected outcome | Primary targets |
|---|---:|---|---|---|
| REM-01 | P0 | Reminder dispatcher runs the correct Sydney-time workflow | Only 09:00, 12:00, and 15:00 runs do work; booking hour buckets and package payment/expiry work execute in their intended run. | `reminders.sendDueReminderEmails` |
| REM-02 | P0 | Reminder eligibility respects lifecycle, date range, and remaining sessions | Ineligible statuses, already-sent reminders, out-of-range bookings/packages, and packages with no remaining sessions are skipped. | Reminder list queries and dispatcher |
| REM-03 | P0 | Reminder claims prevent duplicate emails | Concurrent/replayed jobs produce at most one send for a booking/package reminder. | Booking and package reminder claim mutations |
| REM-04 | P0 | Reminder success and failure are persisted | Successful send records sent time; provider failure records failure and follows the supported retry behaviour. | Reminder actions and mark mutations |
| EMAIL-01 | P1 | Deliverables email requires admin and valid booking/Drive link | Invalid requests make no provider call; valid request sends normalized customer/session details and link. | `deliverablesEmail.sendBookingDeliverablesEmail` |
| EMAIL-02 | P1 | Feedback rejects blank or rate-limited submissions and escapes content | Blank/rate-limited requests send nothing; valid untrusted content is safely sent; provider failure returns `SEND_FAILED`. | `feedback.submit` |

---

## Recommended first implementation batch

Start with these tests because they cover the highest-risk behaviour with relatively little duplication:

1. `AUTH-01` — all admin endpoint authorization matrix.
2. `BOOK-05` — payment claim idempotency.
3. `BOOK-06` — successful payment completion.
4. `BOOK-07` — availability changed during checkout.
5. `BOOK-09` — concurrent double-booking attempt.
6. `BOOK-10` — webhook signature and replay handling.
7. `RES-03` and `RES-04` — failed and successful reschedule state integrity.
8. `RES-06` — concurrent token use.
9. `ADMIN-02` and `ADMIN-06` — Calendar synchronization and deletion.
10. `PKG-04` and `PKG-05` — package payment lifecycle.
11. `SCHED-01` through `SCHED-04` — package capacity and Calendar compensation.
12. `ADJ-03` through `ADJ-06` — adjustment creation and delivery idempotency.
13. `REM-03` — reminder deduplication.

## Explicitly excluded

The following do not need dedicated tests unless they later cause regressions:

- Individual string trimming helpers.
- Filename formatting.
- Every invalid form field in isolation.
- Simple getters with no business decisions.
- Static email wording and ordinary provider payload fields.
- Each date helper independently when its behaviour is covered by booking/rescheduling flows.
- Schema literals already exercised by higher-level mutations.
- Basic list ordering unless it becomes a user-visible requirement.
