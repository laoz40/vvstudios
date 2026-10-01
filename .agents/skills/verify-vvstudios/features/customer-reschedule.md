# Customer reschedule

A customer who paid for a single session can open the reschedule link from the invoice email, pick a new date and time, confirm in the dialog, and land on `/reschedule-complete` with **Booking updated** and changed booking details.

## Sub-features

- `book-and-pay` creates a real paid session booking (same as confirmation flow).
- `invoice-link` loads the reschedule URL from Resend for the booking email.
- `reschedule-form` shows **Reschedule your booking** and **Existing booking** summary.
- `reschedule-complete` submits **UPDATE BOOKING**, confirms **Update Booking** in the dialog, and asserts date or time changed on `/reschedule-complete`.

## How to get to it (user POV)

- Book and pay for a single session on `/book`.
- Open the reschedule link from the booking invoice email (hosted on localhost during local e2e when Convex return URL origin is `http://localhost:3000`).
- Choose a new date/time, press **UPDATE BOOKING**, confirm **Update Booking** in the modal.

## Driving it with Playwright

Preconditions:

- `E2E_RESEND_API_KEY` or `RESEND_API_KEY` in `.env.local`.
- Convex `STRIPE_CHECKOUT_RETURN_URL` origin must be `http://localhost:3000` so invoice links open in Playwright.
- `--workers=1` via `bun run test:e2e:session-reschedule`.

- **End-to-end reschedule.** Run `bun run test:e2e:session-reschedule`. Exit code 0 on happy path.
- **Pay and confirm first.** Spec runs `fillSingleSessionBookingForm`, terms, `completeStripePayment`, and **Your booking is confirmed!** before polling Resend.
- **Reschedule page.** `page.goto(rescheduleUrl)` shows heading **Reschedule your booking**; `readExistingBookingSummary` captures prior date and time from **Existing booking**.
- **Submit change.** `completeReschedule` picks a different slot (`startingDayIndex + 1`, `timeIndex` 1), clicks **UPDATE BOOKING**, then dialog button **Update Booking**.
- **Complete page.** URL `/reschedule-complete`, heading **Booking updated**, and **Booking Details** date or time differs from the previous summary.
- **Proof.** Screenshot `/reschedule-complete` with **Booking updated**; retain trace on failure.

## Gotchas

- Do not mint reschedule tokens via Convex or dev menus; use the invoice email link only.
- Reschedule specs skip without Resend keys; report that as skipped, not verified.
- Slot collisions with Google Calendar behave like booking confirmation; rotate offsets or clear test events.
- Parallel payment/reschedule runs against shared Convex cause flaky slot conflicts; keep `--workers=1`.
