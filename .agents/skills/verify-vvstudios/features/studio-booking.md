# Studio booking

Studio booking is the public `/book` flow: single session or package, contact details, calendar availability, terms acceptance, and opening the Stripe payment modal. CI proofs stop before Pay.

## Sub-features

- `book-sections` renders booking type, duration, contact, and session date sections.
- `single-terms` submits a filled single-session form and opens the terms dialog.
- `single-payment-modal` agrees to terms and opens the Stripe iframe payment modal for a single session.
- `package-payment-modal` selects package mode and opens the payment modal after terms.

## How to get to it (user POV)

- Click **Book session** in the header or open `http://localhost:3000/book`.
- Choose **Single Session** or **Package**, fill contact fields, pick date/time (single session), and press **COMPLETE BOOKING**.
- Read **Terms & Conditions**, then **Agree & Book** to reach payment.

## Driving it with Playwright

Preconditions:

- `bun .agents/skills/verify-vvstudios/doctor.ts` exits 0.
- Shared Convex calendar availability may take several seconds; helpers wait for `[data-slot="calendar"]` and enabled `button[data-day]` cells.
- Run with `--workers=1` when combined with other booking specs in one session.

- **Form shell.** Open `/book`. Run `bunx playwright test e2e/book.spec.ts --workers=1 -g "loads booking form sections"`. Heading **Studio Hire Booking** and labels **Booking Type \***, **Session Duration \***, **Contact Details**, **Session Date \*** are visible.
- **Single session terms.** Run `bunx playwright test e2e/book.spec.ts --workers=1 -g "single session form opens terms dialog"`. After `fillSingleSessionBookingForm` and **COMPLETE BOOKING**, dialog shows **Terms & Conditions** and button **Agree & Book**.
- **Single session payment modal (no Pay).** Run `bunx playwright test e2e/book.spec.ts --workers=1 -g "single session checkout opens payment modal"`. After **Agree & Book**, button **Close payment modal** and payment dialog `iframe` are visible; modal is closed in `finally`.
- **Package payment modal (no Pay).** Run `bunx playwright test e2e/book.spec.ts --workers=1 -g "package checkout opens payment modal"`. Package radios `#booking-mode-package` and package size labels appear before submit.
- **Full CI bundle.** Run `bun run test:e2e`. Exit code 0 runs home plus all book specs serially within the file.
- **Proof.** Screenshot payment modal with **Close payment modal** visible; store under `tmp/verify-vvstudios/<run-id>/book-payment-modal.png`.

## Gotchas

- Default single-session helpers select `#duration-2h` and `#service-table-setup` and pick the first bookable calendar slot (may advance months).
- E2E contact email uses `@resend.dev` sink addresses with a timestamp; reruns rotate day index via `getE2eBookingSlotOffset` to reduce Google Calendar collisions.
- Do not click **Pay** in CI (`test:e2e`); hCaptcha blocks headless checkout in GitHub Actions.
- Closing the payment modal is required so later tests are not blocked by an open dialog.
