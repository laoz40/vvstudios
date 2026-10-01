# Clerk login

Staff open `/login` and sign in with Clerk. An unauthenticated visit shows **Administrator login** and the Clerk SignIn widget. A successful sign-in lands on `/dashboard`. Invitation tickets switch the page to **Create your account** and Clerk SignUp instead.

## Sub-features

- `login-unauthenticated` loads `/login` with heading **Administrator login** and a link to the public **booking page**.
- `login-clerk-widget` shows the Clerk SignIn form after Clerk finishes **Contacting security**.
- `login-redirect-signed-in` sends an already signed-in user from `/login` to `/dashboard`.
- `login-sign-in` signs in the `E2E_ADMIN_EMAIL` user via `@clerk/testing/playwright` and waits for `/dashboard`.

## How to get to it (user POV)

- Open `http://localhost:3000/login` (no public nav link; staff bookmark or type the URL).
- Document title is `Login | VV Studios` (noindex).
- Invitation flow: same path with a Clerk `__clerk_ticket` query or hash param (contractor invite). Do not use that path for admin verification.

## Driving it with Playwright

Preconditions:

- `bun .agents/skills/verify-vvstudios/doctor.ts` reports our server (or launch first).
- Desktop viewport (Clerk widget and later dashboard chrome assume desktop).
- For `login-sign-in`: `E2E_ADMIN_EMAIL` plus `E2E_CLERK_SECRET_KEY` or `CLERK_SECRET_KEY`. `VITE_CLERK_PUBLISHABLE_KEY` is already required to boot the app.
- Call `prepareClerkTesting()` once per process before `signInAsAdmin`.

- **Unauthenticated shell.** Open `/login`. Wait until heading **Administrator login** is visible (loading copy **Contacting security** must go away). Link named **booking page** points at `/book`.
- **Document title.** `page` title is `Login | VV Studios`.
- **Clerk SignIn.** The Clerk SignIn widget is in the card (do not treat **Contacting security** as the proof).
- **Testing sign-in.** Run `bun .agents/skills/verify-vvstudios/drive-auth.ts` (covers login then dashboard) or, in a spec: `await prepareClerkTesting(); await signInAsAdmin(page)` from `e2e/helpers/admin-auth.ts`. URL matches `/\/dashboard/` within 15s.
- **Proof.** Screenshot `/login` with **Administrator login** visible (`tmp/verify-vvstudios/<run-id>/login.png`). After sign-in, capture `/dashboard` in the admin-dashboard recipe, not as a substitute for the login heading.

## Gotchas

- There is no Playwright spec for login yet. Drive with `drive-auth.ts` or import `e2e/helpers/admin-auth.ts`. Do not invent email/password fills when Clerk testing tokens are available.
- `ensureClerkTestingEnv` copies `VITE_CLERK_PUBLISHABLE_KEY` onto `CLERK_PUBLISHABLE_KEY` for `@clerk/testing/playwright`.
- Signed-in visits to `/login` immediately `Navigate` to `/dashboard`. Prove the login heading in a fresh browser context.
- Public booking does not use Clerk. Do not treat `/book` as a login check.
- Invitation SignUp (`__clerk_ticket`) is a different heading. Skip it unless you are verifying contractor invites. Editor dashboard verification creates a temp Clerk user instead of a standing `E2E_EDITOR_EMAIL`.
