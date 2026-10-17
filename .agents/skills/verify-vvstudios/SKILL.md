---
name: verify-vvstudios
description: Verify VV Studios at http://localhost:3000. Use before selecting or running pre-PR E2E flows, verifying marketing pages, booking/payment, package scheduling, rescheduling, staff login or dashboards in the browser, or investigating failed CI checks.
---

# Verify VV Studios

VV Studios is a podcast studio hire site (brand **VV Studios**). The primary surface is the public web app: marketing pages plus live booking against a shared Convex cloud deployment. Clerk powers `/login` and `/dashboard` (see the clerk-login and admin-dashboard feature files).

Timezone for browser checks: **Australia/Sydney** (matches Playwright config).

## Pre-PR verification

Run relevant E2E flows once against the final changes, immediately before creating a PR. For routine development verification, run `bun run verify` without E2E. The [verification runner](../../../scripts/verify.sh) installs dependencies and runs local checks in order, stopping on failure.

Choose the command for the changed flow:

- Booking changes spanning flows: `bun run verify --e2e all`. It runs session reschedule including payment, then package scheduling including payment, sequentially. Skip additional smoke or payment-only runs that duplicate this coverage.
- Changes limited to one flow: `bun run verify --e2e smoke`, `bun run verify --e2e session-reschedule`, or `bun run verify --e2e package-schedule`.
- Admin or editor dashboard changes: run `bun run verify`, then the matching dashboard command under [Drive](#drive).

When Convex functions changed, follow the [Convex deployment workflow](../../../docs/convex-three-layers.md#workflow) before running E2E. Add `--convex` to the selected verification command when that workflow permits; the runner completes deployment before E2E starts.

Payment E2E requires headed Chromium and a usable display. The runner checks display/browser availability before local checks and exits immediately if unavailable. Complete payment E2E on a machine with a usable display.

## Launch

1. From repo root, install deps if needed: `bun i`.
2. Require `.env.local` with these names set (never log values): `VITE_CONVEX_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_FREE_TOUR_URL`.
3. Convex is **shared cloud**. Do not start a long-running `convex dev`. Use `npx convex dev --once` only when function code changed and no `convex dev` is already running elsewhere.
4. **One Vite on port 3000** (`127.0.0.1`, `strictPort` in `vite.config.ts`). If something else listens on 3000, run doctor. If it is not the pid recorded by this skill, **refuse** to drive or start another instance.
5. **No parallel booking proofs** on the same Convex deployment. Run payment, package, and reschedule Playwright scripts with `--workers=1` (already set in `package.json` for those scripts).
6. Start the app: `bun run dev` from repo root, or use the launch helper (writes pid/log under this skill's `state/`).
7. **Ready** when `GET http://localhost:3000` returns HTML whose `<title>` matches `/Podcast Studio Hire Sydney | VV Studios/`.
8. Record the **listener pid** on port 3000 in `.agents/skills/verify-vvstudios/state/dev.pid` and the `bun run dev` spawn pid in `state/dev.spawn.pid`. Append stdout/stderr to `state/dev.log`.
9. Optional `bun run convex:seed-dev` seeds **dashboard admin data only**. Do not use it to prove customer booking flows. Create customer state through the UI (see repo `tests` skill).

Exact helper invocations (from repo root):

```bash
bun .agents/skills/verify-vvstudios/doctor.ts
bun .agents/skills/verify-vvstudios/launch.ts
bun .agents/skills/verify-vvstudios/drive-auth.ts
bun .agents/skills/verify-vvstudios/drive-editor.ts
bun .agents/skills/verify-vvstudios/cleanup.ts
```

Each helper accepts `--help`.

## Doctor

Read-only preflight:

```bash
bun .agents/skills/verify-vvstudios/doctor.ts
```

Checks HTTP on port 3000, home document title, whether `state/dev.pid` matches a live process that owns the listener (via `ss`), and that required env **names** exist (values loaded from `.env.local`, never printed). Exit **0** when you may launch or drive **our** server, or when port 3000 is free and env is complete. Exit **1** with a single-line reason when a foreign listener, wrong title, stale pid, or missing env blocks verification.

## Drive

Read [features/README.md](./features/README.md), then the feature file for the flow under test.

**Prefer Playwright** and existing helpers under `e2e/helpers/`.

| Goal | Command | Notes |
| --- | --- | --- |
| CI-safe smoke | `bun run test:e2e` | Always runs `home.spec.ts` and `book.spec.ts`; extra CLI args are appended, not a filter |
| Home title only | `bunx playwright test e2e/home.spec.ts --workers=1` | Document title on `/` |
| Single session pay + confirm | `bun run test:e2e:session-payment --headed` | Local only; Stripe test card, hCaptcha |
| Package pay + schedule session 1 | `bun run test:e2e:package-payment --headed` | Needs `E2E_RESEND_API_KEY` or `RESEND_API_KEY` in `.env.local` |
| Book, pay, reschedule | `bun run test:e2e:session-reschedule --headed` | Same Resend key; Convex `STRIPE_CHECKOUT_RETURN_URL` origin must be `http://localhost:3000` |
| Clerk login + admin dashboard | `bun .agents/skills/verify-vvstudios/drive-auth.ts` | Needs `E2E_ADMIN_EMAIL` and `E2E_CLERK_SECRET_KEY` or `CLERK_SECRET_KEY`. Admin role only. |
| Editor dashboard | `bun .agents/skills/verify-vvstudios/drive-editor.ts` | Creates a temp Clerk editor (`+clerk_test` email), assigns a confirmed session as admin, asserts the customer on **Edits**, restores assignment, retires the profile, deletes the Clerk user |

Playwright uses `baseURL` `http://localhost:3000`, starts `bun run dev` via `webServer` when CI or when no server is reused. When you use this skill's launch helper, run doctor first so Playwright `reuseExistingServer` hits **our** pid file.

**Ad-hoc driving** (Playwright library or t3-code `preview_*` MCP after our server is up):

- Nav: `aria-label` **Primary navigation**; links **Gallery**, **Pricing**, **FAQ**, **Contact**; **Book session**; home link **VV Studios home**.
- Home title: `Podcast Studio Hire Sydney | VV Studios`.
- Book (`/book`): heading **Studio Hire Booking**; button **COMPLETE BOOKING**; terms dialog **Terms & Conditions**; **Agree & Book**; **Close payment modal**; labels **Full Name \***, **Mobile Number \***, **Account Name \***, **Email \***; calendar `[data-slot="calendar"]`; fields `[data-field-name="time"]`, `duration`, `service`, `bookingMode`, `packageSize`; radios `#duration-2h`, `#service-table-setup`, `#booking-mode-package`.
- Stripe iframe (in payment dialog): text **TEST MODE**; fields **Card number**, **Expiration**, CVC; button **Pay**; card `4242 4242 4242 4242`.
- Confirm: heading **Your booking is confirmed!** (single session) or `{N}-Session Package confirmed`; URL `/booking-complete` with `session_id=`.
- Package schedule page: heading **Schedule your package sessions**; **SAVE SESSION**; success copy **Calendar event created. Check your email for the invitation.**
- Reschedule: heading **Reschedule your booking**; **UPDATE BOOKING**; confirm dialog **Update Booking**; complete page heading **Booking updated** on `/reschedule-complete`.
- Login (`/login`): heading **Administrator login**; link **booking page**; title `Login | VV Studios`. Sign-in via `prepareClerkTesting` + `signInAsAdmin` (`e2e/helpers/admin-auth.ts`), not typed passwords.
- Admin dashboard (`/dashboard`): tabs **Sessions**, **Packages**, **Contractors**; **Sign out**; search `Search sessions...`. Fail on **Dashboard access required.** or **Backend connection failed.** Editor UI (**Edits** / **History**) is a separate feature (`drive-editor.ts`).
- Editor dashboard (`/dashboard` as editor): a **named assigned session** on **Edits** or **History** after admin assignment. Empty **Nothing in your queue** is not proof.

**Do not** use as proof: Convex mutations or `convex run` to fake bookings; `/booking-complete?dev_scenario=...`; minting reschedule tokens outside the email link flow; completing Stripe Pay in CI; `pkill` by process name; `convex:seed-dev` for customer booking proofs. Seed is allowed only to fill an empty admin table for a screenshot, never as the auth proof.

## CI failures

For failed GitHub Actions checks, read [CI failure triage](./ci-failures.md) before retrying tests or changing shared backend data.

## Evidence

Store artifacts under `tmp/verify-vvstudios/<run-id>/` (`tmp/` is gitignored). Capture the user action and resulting state: screenshot plus visible heading or URL. On Playwright failure, collect traces from `test-results/` (gitignored). After mutations, add a second read-only view (confirmation page, remaining package session count, reschedule-complete details).

## Cleanup

```bash
bun .agents/skills/verify-vvstudios/cleanup.ts
```

Kill only the pids in `state/dev.pid` (listener) and `state/dev.spawn.pid` (the `bun run dev` spawn). Remove those pid files and `state/dev.log`. Do not `pkill vite`. Do not delete `tmp/verify-vvstudios/`.

## Helpers

| Script | Role |
| --- | --- |
| `doctor.ts` | Read-only; exit 0 when safe to launch or drive |
| `launch.ts` | Spawn `bun run dev` from repo root when port free; wait for title; write listener pid |
| `cleanup.ts` | SIGTERM/SIGKILL recorded pid only; keep evidence |
| `drive-auth.ts` | Unauthenticated `/login`, Clerk testing sign-in, admin tabs, sign-out |
| `drive-editor.ts` | Temp Clerk editor, admin-assign confirmed session, editor sees that customer, restore assignment, retire profile, delete Clerk user |
| `clerk-temp-editor.ts` | Clerk Backend create/delete for verification-only editor users |
| `lib.ts` | Shared paths, env load, port/title checks (not invoked directly) |

Feature recipes live in [features/](./features/).
