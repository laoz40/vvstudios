# Admin dashboard

An authorised admin signs in and manages sessions, packages, and contractors on `/dashboard`. Proof is the admin shell (Sessions / Packages / Contractors tabs plus Sign out), not Convex table dumps. Optional `bun run convex:seed-dev` only fills empty tables; it is not a substitute for sign-in.

## Sub-features

- `dashboard-gate` loads `/dashboard` after Clerk + Convex auth and editor provisioning (loading labels include **Calibrating systems**, **Contacting security**, then dashboard-stage copy).
- `dashboard-admin-tabs` shows tabs **Sessions**, **Packages**, and **Contractors**.
- `dashboard-sessions-table` shows session filters (**Inbox**, **All sessions**) and search placeholder `Search sessions...`.
- `dashboard-packages-tab` switches to **Packages** and shows package table chrome.
- `dashboard-sign-out` uses **Sign out** and returns to `/login` with **Administrator login**.

## How to get to it (user POV)

- Sign in at `/login` (see [Clerk login](./clerk-login.md)). Clerk redirects to `/dashboard`.
- Opening `/dashboard` while signed out redirects to `/login`.
- Document title is `Dashboard | VV Studios` (noindex).
- Desktop: tabs plus **Privacy off** / **Privacy on**, **Availability settings**, and **Sign out** in the header. Mobile: **Open admin menu** instead of that header cluster.

## Driving it with Playwright

Preconditions:

- Complete [Clerk login](./clerk-login.md) `login-sign-in` in the same browser context.
- `E2E_ADMIN_EMAIL` must be an **admin** Convex role (`view:sessions` and admin dashboard). An editor account shows **Edits** / **History** instead; that is [editor dashboard](./editor-dashboard.md).
- Desktop viewport so **Sign out** is in the header (`hidden md:block` on the header cluster).
- Shared Convex. Do not seed unless the Sessions table is empty and you need rows to screenshot; seed does not prove auth.

- **Full auth + admin shell.** Run `bun .agents/skills/verify-vvstudios/drive-auth.ts`. Exit 0. Artifacts under `tmp/verify-vvstudios/<run-id>/`.
- **Land on dashboard.** After `signInAsAdmin`, URL is `/dashboard`. Wait until tab **Sessions** (`exact: true`, because **All sessions** also matches) is visible. Fail if **Dashboard access required.**, **Could not load dashboard.**, or **Backend connection failed.** appears.
- **Sessions chrome.** **Inbox** and **All sessions** visible. Search input placeholder `Search sessions...`. Table or empty state is enough; do not query Convex.
- **Packages tab.** Click tab **Packages** (`exact: true`; **All packages** also matches a substring). Packages view is visible (not stuck on **Calibrating systems**).
- **Contractors tab.** Click tab **Contractors**. Employees table or empty state is visible.
- **Sign out.** Click **Sign out**. URL `/login`, heading **Administrator login**.
- **Proof.** Screenshots: `dashboard-sessions.png` (tabs + Sign out), `dashboard-packages.png`, `login-after-sign-out.png`.

## Gotchas

- Auth is several gates: Clerk loaded, Convex authenticated, `createEditorUser`, then `getCurrentUserAccess`. Long waits are normal. Do not treat a loading spinner as failure until the helper timeout.
- Editor role is a different UI. If you see **Edits** and **History**, stop and report the account is not admin.
- Privacy mode masks customer fields. Toggle **Privacy on** / **Privacy off** only if you are proving that control; default screenshots should keep **Privacy off** so you can see table content.
- `convex:seed-dev` writes synthetic sessions/packages on the shared deployment. Use it only for empty-dashboard screenshots, never for customer booking proofs.
- Do not call admin Convex mutations from Playwright as proof. Row actions (cancel, invoices, Drive) are not in this recipe yet.
