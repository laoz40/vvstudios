# Minimal Stripe integration payment plan

## Teaching rules

- Teach one step at time. One instruction per message. I want implement myself.
- Keep language simple, concise. Explain clearly. Try to keep explanations short.

## Goal

Add fixed $50 deposit payment step with Stripe Embedded Checkout:

- clicking Create booking opens payment modal
- booking confirmation only happens after Stripe payment completes successfully
- user then redirected to /booking-complete

## Core principle

- Stripe confirms payment
- Convex is system of record
- Webhook is only place that finalizes booking
- Frontend only starts payment and shows status

Everything else is UI or state display.

## Current state

- Booking submission happens in `src/routes/book.tsx`
- form submit creates a pending Convex booking record and Stripe Checkout session
- Embedded Stripe Checkout opens in `BookingPaymentModal`
- webhook in `convex/http.ts` is now the only booking confirmation path
- successful webhook flow creates the Google Calendar event, marks booking `confirmed`, and sends the invoice email
- `/booking-complete` is still a placeholder and not yet wired to booking status

## Architecture summary

Create one Convex record before payment. Keep it in `pending_payment`. Stripe session points to that record. When Stripe sends `checkout.session.completed`, webhook loads Convex record, atomically claims finalization, creates calendar booking once, then marks record `confirmed`.

This removes split-brain and duplicate fulfillment paths.

## Implementation plan

### 1) Create one pending booking/payment record in Convex

When the user submits the booking form:

Create a single Convex record that stores:

- booking form payload
- slot/date/time/service details
- `status: "pending_payment"`
- `stripeSessionId: null` initially
- internal booking/payment id
- optional error fields for failure states

Important:

- do not create the Google Calendar event yet
- this pending Convex record is the canonical source of truth

### 2) Create Stripe Checkout session in Convex

Add Stripe session creation on the backend in Convex.

Responsibilities:

- accept validated booking payload or pending record id
- create Stripe Checkout Session for fixed $50 deposit
- use embedded Checkout mode
- attach metadata with internal reference, e.g. `bookingId`
- store `stripeSessionId` back on the Convex record
- keep status as `pending_payment`
- return the client secret needed by embedded checkout

Why:

- Stripe is only the payment processor
- Convex owns booking/payment state

### 3) Refactor `src/routes/book.tsx` to UI-only payment start

New submit flow:

1. validate form
2. call Convex to create pending record + Stripe session
3. receive Stripe client secret / session bootstrap data

Important:

- no calendar calls here
- no booking finalization here
- prevent duplicate submits while session is being created

### 4) Add payment modal with embedded Stripe checkout

Add a small focused payment component.

Responsibilities:

- load Stripe with `VITE_STRIPE_PUBLISHABLE_KEY`
- render embedded checkout inside modal/dialog
- show loading and error states cleanly
- close safely if user abandons payment

### 5) Webhook is the only booking finalization path

Implement Stripe webhook handling in `convex/http.ts`.

Required event:

- `checkout.session.completed`

Optional event:

- `checkout.session.expired`

On `checkout.session.completed`:

1. verify webhook signature
2. extract `bookingId` from Stripe metadata
3. load pending Convex record
4. atomically claim finalization so only one execution can proceed
5. create Google Calendar event once
6. mark record `confirmed`
7. persist Stripe/payment references and timestamps

If webhook is retried, later deliveries must become no-ops.

### 6) Use atomic idempotency in Convex

Do not rely only on a plain read check like:

```ts
if (status !== "pending_payment") {
	return;
}
```

Implementation must use an atomic Convex mutation that claims finalization once.

Minimal safe rule:

- only one transaction may move a record out of `pending_payment` for fulfillment
- repeated webhook deliveries must return the already-processed result

Recommended stored fields:

- `stripeSessionId`
- `stripePaymentIntentId` if available
- `paidAt`
- `confirmedAt`
- `failureCode`
- `failureMessage`

### 7) Booking conflict handling after payment

This plan prevents duplicate fulfillment of the same payment.
It does **not** fully eliminate slot conflicts between different users.

If the slot becomes unavailable before finalization:

- do not silently fail
- mark record `failed`
- store structured error reason
- show clear follow-up state to the user
- log enough context for manual remediation / refund flow

No reservation system yet.
No retries yet.

### 8) Return page becomes read-only status UI

Update `/booking-complete` to be a status page only.

Responsibilities:

- read returned `session_id` or internal booking reference
- ask Convex for current payment/booking status
- show:
  - loading: confirming payment
  - success: booking confirmed
  - failed: payment succeeded but booking finalization failed
  - expired: session expired
  - invalid/missing reference state

Important:

- no Stripe verification logic here for finalization
- no booking creation here
- no fallback fulfillment path here
- this route is display-only

### 9) Minimal state model

Keep the state model small:

```text
pending_payment
confirmed
failed
expired
```

Note:

- implementation still needs an atomic finalization claim
- if that is easier with an internal transitional flag or field, that is fine
- keep the externally visible lifecycle simple

## Likely file touch list

- `src/routes/book.tsx`
- `src/routes/booking-complete.tsx`
- new Stripe payment modal/component under booking feature code
- Convex payment/session module(s)
- `convex/http.ts`
- `convex/schema.ts`

## Test checklist

- valid booking opens Stripe modal
- embedded checkout renders successfully
- successful payment redirects to `/booking-complete`
- webhook finalizes booking successfully
- booking confirmed only after payment completion
- cancelling/closing payment does not confirm booking
- webhook retry does not create duplicate booking/calendar event
- refreshing return page does not create duplicate booking
- invalid or missing `session_id` handled safely
- unavailable slot after payment shows clear failure state
- submitted booking details still appear on success/status page

## Completed

### Done

- Updated `convex/schema.ts` to support booking payment lifecycle fields, Stripe references, confirmation claim fields, and Google Calendar references
- Added pending booking creation in `convex/bookings.ts`
- Added internal booking lookup and lifecycle mutations in `convex/bookings.ts`
- Added mutation to save `stripeSessionId` onto a booking in `convex/bookings.ts`
- Created `convex/stripe.ts` as a Node action module for Stripe
- Added Stripe checkout session creation in Convex
- Added Stripe metadata with internal `bookingId`
- Patched the booking record with `stripeSessionId` after Stripe session creation
- Refactored `src/routes/book.tsx` to stop creating calendar bookings on submit
- `src/routes/book.tsx` now creates a pending booking + Stripe session only
- Added `BookingPaymentModal` for Embedded Checkout
- Added Stripe webhook endpoint in `convex/http.ts`
- Added Stripe webhook signature verification with `constructEventAsync`
- Added handling for `checkout.session.completed` and `checkout.session.expired`
- Added atomic booking confirmation claim logic in Convex to prevent duplicate fulfillment
- Added webhook-only booking confirmation flow via `completeClaimedBooking` in `convex/googleCalendar.ts`
- Moved Google Calendar event creation to the webhook confirmation path only
- Reintegrated invoice generation and invoice email sending into the new webhook confirmation flow
- Added expired and failed booking state handling in Convex
- Removed the obsolete direct booking creation flow from `convex/googleCalendar.ts`
- Wired Stripe return URL to include `session_id={CHECKOUT_SESSION_ID}`
- Added public Convex query to load booking status by Stripe session id
- Implemented read-only `/booking-complete` status page
- Added invalid or missing return reference handling on `/booking-complete`
- Added pending/confirmed/failed/expired status UI on `/booking-complete`
- `/booking-complete` now shows submitted booking details and live Convex status updates while confirmation is still in progress
