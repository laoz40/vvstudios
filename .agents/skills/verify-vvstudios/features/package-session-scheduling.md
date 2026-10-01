# Package session scheduling

After a package Stripe checkout, the customer receives email with a scheduling link. The scheduling UI lists package sessions, lets them pick date and time for session 1, and confirms calendar creation plus remaining sessions to schedule.

## Sub-features

- `package-pay` checks out a 4-session package (default in spec) and lands on package confirmation heading.
- `email-link` retrieves the schedule URL from Resend for the booking email address.
- `schedule-session-1` opens the first **Date Required** session, picks calendar slot, and **SAVE SESSION**.
- `remaining-count` read-back shows how many sessions are left to schedule.

## How to get to it (user POV)

- On `/book`, choose **Package**, package size (spec uses 4), fill contact details, complete terms and Stripe **Pay**.
- On confirmation, note the package confirmed heading (`4-Session Package confirmed` for default size).
- Open the **Schedule your package sessions** link from the package email (not the dashboard).
- Click **Schedule** on the first session needing a date, pick date/time and recording space, then **SAVE SESSION**.

## Driving it with Playwright

Preconditions:

- `E2E_RESEND_API_KEY` or `RESEND_API_KEY` in `.env.local` (same Resend account Convex uses).
- Stripe test keys and our dev server on port 3000.
- Run `bun run test:e2e:package-payment` with `--workers=1` (script default).

- **Package checkout and email.** Run `bun run test:e2e:package-payment`. Spec skips with a clear message if Resend API key is missing.
- **Confirmation.** After pay, heading **4-Session Package confirmed** (or chosen size) and URL `/booking-complete` with `session_id=`.
- **Schedule URL.** Helper `waitForPackageScheduleUrl` polls Resend since test start; `page.goto(scheduleUrl)` shows heading **Schedule your package sessions**.
- **Save session 1.** `scheduleFirstPackageSession` clicks **Schedule**, fills calendar via `[data-slot="calendar"]`, clicks **SAVE SESSION**. Success text **Calendar event created. Check your email for the invitation.** appears.
- **Read-back.** `expectFirstPackageSessionScheduled` sees copy like **Schedule 3 more sessions to complete your booking.** and an **Upcoming** label.
- **Proof.** Screenshot scheduling page after save; optional second screenshot of confirmation email metadata in test logs (not the secret API key).

## Gotchas

- Package proof creates real Convex bookings and Google Calendar events; serialize with other payment tests.
- Resend polling can take minutes; spec timeout is 270s.
- Do not mint schedule tokens manually or skip email by calling Convex mutations.
- `bun run test:e2e:package-schedule` is an alias of the package payment spec; same constraints apply.
