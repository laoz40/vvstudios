# Booking confirmation

Booking confirmation is the post-checkout `/booking-complete` page after a successful Stripe test payment for a single session, showing a confirmed heading and a `session_id` query parameter.

## Sub-features

- `stripe-pay` completes Stripe TEST MODE card entry inside the payment modal iframe.
- `redirect-complete` lands on `/booking-complete` with `session_id=` in the URL.
- `confirmed-heading` shows **Your booking is confirmed!** when the slot was not taken.
- `slot-taken-guard` fails fast if payment succeeded but Google Calendar still shows the slot busy (**We received your payment** path).

## How to get to it (user POV)

- Complete the [studio booking](./studio-booking.md) flow through **Agree & Book**.
- In the payment modal, enter test card details and press **Pay**.
- Stripe redirects back to `/booking-complete?...session_id=...`.

## Driving it with Playwright

Preconditions:

- Local run only (not CI): Stripe test keys in `.env.local` aligned with the Convex deployment.
- `bun .agents/skills/verify-vvstudios/launch.ts` or doctor confirms our dev server on port 3000.
- `--workers=1`; no concurrent payment specs against shared Convex.

- **Full pay path.** Run `bun run test:e2e:session-payment`. Exit code 0 after `completeStripePayment` and `expectBookingConfirmed`.
- **URL proof.** During the spec, `page` URL matches `/booking-complete` and `/session_id=/`.
- **Heading proof.** Visible heading **Your booking is confirmed!** within the helper timeout (45s). If **We received your payment** appears instead, treat as failure (calendar slot conflict).
- **Stripe iframe.** Inside the payment dialog iframe: text **TEST MODE**, fill **Card number** `4242 4242 4242 4242`, expiry `12 / 34`, CVC `123`, then **Pay**.
- **Proof.** Screenshot `/booking-complete` with confirmation heading; save Playwright HTML report or trace on failure under `test-results/`.

## Gotchas

- Never use `/booking-complete?dev_scenario=...` for verification; dev scenarios bypass real checkout.
- Live Google Calendar windows must be free or tests rotate `startingDayIndex`; stale calendar events cause false failures.
- Do not prove confirmation via Convex dashboard reads; use the public confirmation page only.
- Completing Pay in CI is intentionally out of scope (hCaptcha).
