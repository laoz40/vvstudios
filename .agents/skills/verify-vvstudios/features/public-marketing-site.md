# Public marketing site

The marketing site introduces VV Studios podcast hire in Sydney: home hero, gallery, pricing, and contact/FAQ content reachable from the primary navigation without signing in.

## Sub-features

- `home-load` renders the home page with the expected document title and brand nav.
- `nav-primary` exposes Gallery, Pricing, FAQ, Contact, and Book session from primary navigation.
- `route-gallery` loads the gallery page from nav.
- `route-pricing` loads the pricing page from nav.

## How to get to it (user POV)

- Open `http://localhost:3000/`.
- Use **Primary navigation** links **Gallery**, **Pricing**, **FAQ**, **Contact**, or **Book session**.
- Follow **VV Studios home** (brand link) to return to `/`.

## Driving it with Playwright

Preconditions:

- `bun .agents/skills/verify-vvstudios/doctor.ts` exits 0 (our server or free port after launch).
- No feature-specific seed data.

- **Home title.** Open `/`. Run `bunx playwright test e2e/home.spec.ts --workers=1` (do not use `bun run test:e2e` for this check; that script always also runs `e2e/book.spec.ts`). Exit code 0 and the test passes `toHaveTitle(/Podcast Studio Hire Sydney \| VV Studios/)`.
- **Nav landmarks.** Open `/`. In a spec or MCP session, assert `page.getByRole("navigation", { name: "Primary navigation" })` is visible and links named **Gallery**, **Pricing**, **FAQ**, **Contact**, and **Book session** are visible.
- **Gallery route.** Click **Gallery**. Run `page.getByRole("link", { name: "Gallery" }).click()` then expect URL pathname `/gallery` and a visible page heading (gallery content loads without error boundary).
- **Pricing route.** From home, click **Pricing**. Expect pathname `/pricing`.
- **FAQ anchor.** Click **FAQ**. Expect navigation to `/contact` with hash targeting the FAQ section (`contact-faq-title` on the contact page).
- **Proof.** Save `tmp/verify-vvstudios/<run-id>/home.png` after `page.screenshot()` on `/` with title bar or in-page **VV STUDIOS** branding visible.

## Gotchas

- Vite binds `127.0.0.1:3000`; use `http://localhost:3000` (Playwright default) which resolves to the same listener.
- Mobile nav uses **Navigation Menu** in a sheet; desktop uses **Primary navigation**. Pick one viewport and stay consistent within a run.
- Marketing pages must stay fast and accessible; do not treat Clerk or dashboard routes as substitutes for public nav checks.
