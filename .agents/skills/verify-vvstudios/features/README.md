# VV Studios verification map

This directory is the maintained source for verifying customer-facing VV Studios behavior in the browser. Read this index before driving the app, then open the feature file that matches the flow you need to prove.

## Baseline preconditions

- Working directory is the repository root (where `package.json` defines `bun run dev`).
- `.env.local` defines `VITE_CONVEX_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, and `VITE_FREE_TOUR_URL` without printing values in logs.
- Run `bun .agents/skills/verify-vvstudios/doctor.ts`. If port 3000 is free, run `bun .agents/skills/verify-vvstudios/launch.ts` and re-run doctor until it reports our pid.
- Never drive `http://localhost:3000` when doctor reports a **foreign** listener on port 3000.
- Set `RUN_ID` (for example `date +%s`) and write proof under `tmp/verify-vvstudios/$RUN_ID/`.
- Playwright loads `.env.local` via `playwright.config.ts`. Local payment and reschedule specs also need `E2E_RESEND_API_KEY` or `RESEND_API_KEY` when the recipe polls Resend. Clerk login and admin dashboard need `E2E_ADMIN_EMAIL` and `E2E_CLERK_SECRET_KEY` or `CLERK_SECRET_KEY`. Editor dashboard creates a temp Clerk user with that secret (no `E2E_EDITOR_EMAIL`).
- Do not run two booking or payment proofs in parallel against the shared Convex deployment.

## Driving conventions

- Start from baseline unless a feature file says otherwise.
- Prefer Playwright test scripts and `e2e/helpers/*` over one-off selectors when a spec already covers the flow.
- Use accessible names and stable `data-field-name` / `data-slot` hooks listed in feature files and in [SKILL.md](../SKILL.md).
- Treat commands as literal; run from repo root.
- `bun run test:e2e` always runs `e2e/home.spec.ts` and `e2e/book.spec.ts`. Extra args after `--` are appended, so they do not isolate a single spec. Use `bunx playwright test <file> --workers=1` to run one file.
- Timezone `Australia/Sydney` for calendar and slot labels.
- Create booking state through the public UI only. Do not seed customer bookings with `convex:seed-dev` or Convex mutations for proof.

## Proof and skip reporting

- Capture the action and the resulting state, not only the last screen.
- UI proof: screenshot plus heading text or URL in the artifact name.
- Playwright proof: command, exit code, and on failure the retained trace under `test-results/`.
- Mutation proof: second read-only view (confirmation heading, package sessions remaining, reschedule-complete details).
- Record feature id and entry point with each artifact.
- If a precondition fails, report the attempted command and the missing env, foreign port, or skipped Resend key. Do not mark the feature verified through a shortcut path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing user-visible behavior. It then uses exactly four H2 sections in this order:

1. `Sub-features`
2. `How to get to it (user POV)`
3. `Driving it with Playwright`
4. `Gotchas`

The Playwright section starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.

## Features

- [Public marketing site](./public-marketing-site.md) covers home, primary nav, and core marketing routes.
- [Studio booking](./studio-booking.md) covers `/book` through terms and the Stripe payment modal without Pay.
- [Booking confirmation](./booking-confirmation.md) covers paid single-session checkout and the confirmation page.
- [Package session scheduling](./package-session-scheduling.md) covers package checkout and scheduling the first package session from the email link.
- [Customer reschedule](./customer-reschedule.md) covers pay, invoice reschedule link, and reschedule-complete read-back.
- [Clerk login](./clerk-login.md) covers `/login` (Administrator login) and Clerk testing sign-in.
- [Admin dashboard](./admin-dashboard.md) covers `/dashboard` Sessions, Packages, and Contractors tabs plus sign-out.
- [Editor dashboard](./editor-dashboard.md) covers assigned sessions on **Edits** / **History**. The helper creates a temp Clerk editor, admin-assigns a confirmed session, then asserts that customer row.

### Not yet mapped

These areas exist in the app but do not have feature files yet: **legal** (`/terms-and-conditions`, `/privacy-policy`), **free tour** (modal via `VITE_FREE_TOUR_URL`), **booking-expired** (`/booking-expired`), contractor **Invite editor** / `__clerk_ticket` sign-up. Add a feature file before treating them as verified.
