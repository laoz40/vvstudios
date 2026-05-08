# Route Migration Plan

Goal: make the current VV Studios site a child site under the same domain at `/studio/`, while the root `/` becomes the future parent website/menu.

## Current preparation already done

- `src/config/sites.ts` centralizes site config:
  - `studioSite.basePath`
  - `studioSite.routes`
  - `studioSite.icons`
  - `parentSite` placeholder metadata/icons
- Internal app links use `studioSite.routes` instead of hardcoded root paths.
- SEO metadata paths use `studioSite.routes`.
- Clerk auth redirects use `studioSite.routes`.
- Minimal-layout path checks use `studioSite.routes`.
- Vite prerender filter uses `studioSite.routes`.

Live routes are intentionally still root-level for now.

## Prepared `src` structure

The app is being organized so shared infrastructure stays at the top level and site-specific code lives under `src/sites/<site>`.

Current intended shape:

```txt
src/
  components/
    ui/                  # shared shadcn/ui primitives only
  config/                # shared site config, route constants, metadata config
  integrations/          # shared providers/integration setup
  lib/                   # truly shared utilities only
  routes/                # TanStack Router file routes; keep thin where possible
  sites/
    studio/
      assets/            # Studio-only imported assets
      components/        # Studio-only UI components/layout pieces
      content/           # Studio-only content/data
      features/          # Studio booking/admin/email/invoice features
      lib/               # Studio-only utilities, e.g. booking date/time helpers
      pages/             # Studio page bodies imported by route files
      StudioLayout.tsx   # Studio layout rules
      styles.css         # Studio theme variables and Studio-specific CSS
```

Future parent site code should follow the same pattern:

```txt
src/sites/parent/
  assets/
  components/
  content/
  features/
  lib/
  pages/
  ParentLayout.tsx
  styles.css             # defines `.parent-site` theme variables
```

Route files should answer “what URL is this?” and site folders should answer “what product/site owns this UI and business logic?”.

## Migration checklist

### 1. Move TanStack routes under `/studio`

Update file routes in `src/routes` so Studio pages resolve under `/studio`:

- `/` -> `/studio`
- `/book` -> `/studio/book`
- `/pricing` -> `/studio/pricing`
- `/gallery` -> `/studio/gallery`
- `/contact` -> `/studio/contact`
- `/admin` -> `/studio/admin`
- `/login` -> `/studio/login`
- `/booking-complete` -> `/studio/booking-complete`
- `/booking-expired` -> `/studio/booking-expired`

Likely TanStack Router file structure options:

- create `src/routes/studio/index.tsx` for `/studio`
- use a `src/routes/studio/` directory

After changing routes, regenerate/check `src/routeTree.gen.ts` by running the normal dev/build flow.

### 2. Flip Studio base path config

In `src/config/sites.ts`, change:

```ts
const studioBasePath = "";
```

to:

```ts
const studioBasePath = "/studio";
```

This should update internal links, SEO paths, Clerk redirects, layout path checks, and prerender paths that already consume `studioSite.routes`.

### 3. Implement parent root route

Replace the old Studio root route with the parent website/menu at `/`.

The parent route should have its own:

- page title/meta description
- favicon/icon set
- manifest, if needed
- layout needs
- links/cards to child sites, including `/studio`

Use `parentSite` in `src/config/sites.ts` as the starting point for parent metadata.

Theme note:

- Keep shared Tailwind/shadcn token mapping global in `src/styles.css` (`@theme inline` maps classes like `bg-background` to CSS variables like `--background`).
- Keep actual site theme values scoped by site class, e.g. `.studio-site` in `src/sites/studio/styles.css` and a future `.parent-site` in the parent site styles.
- There is only one `<body>`, so during the parent route migration make the body site class dynamic from the active route/site.
- Current preparation can keep `<body className="studio-site">` because all live routes are still Studio.
- After migration, `/` should use the parent theme class and `/studio...` should use the Studio theme class.
- Prefer applying the active site class to `<body>` rather than only an inner wrapper, because iOS/mobile overscroll and browser chrome areas can otherwise reveal the default white document background.
- Shared shadcn components will use the active site's theme automatically as long as their CSS variables are in scope.

### 4. Update favicons, icons, and manifests

Current state:

- Existing Studio icons have been copied into `public/icons/studio/`.
- Existing parent placeholder icons have been copied into `public/icons/parent/`.
- `public/studio.webmanifest` exists.
- `public/parent.webmanifest` exists.
- Email/invoice logo usage now points to `https://vertigovisuals.com.au/icons/studio/android-chrome-192x192.png`.
- `studioSite.icons` in `src/config/sites.ts` points to the namespaced Studio icons and `/studio.webmanifest`.
- `parentSite.icons` in `src/config/sites.ts` points to the namespaced parent icons and `/parent.webmanifest`.
- `public/studio.webmanifest` still uses root app scope for now because Studio is still live at root:
  - `start_url: "/"`
  - `scope: "/"`
  - `id: "/"`

During the actual `/studio` migration:

- Change `public/studio.webmanifest` to use Studio scope:
  - `start_url: "/studio/"`
  - `scope: "/studio/"`
  - `id: "/studio/"`
- Replace the placeholder parent icons in `public/icons/parent/` with the final parent brand icons.
- If the Studio icon path changes, also update email/invoice logo references that use `/icons/studio/android-chrome-192x192.png`.
- Ensure parent routes render parent icon links and Studio routes render Studio icon links.

Keep icon assets namespaced long term. Avoid generic child-site icons like `/favicon-32x32.png`, because parent and child sites will need different favicons.

### 5. Update SEO metadata

Confirm all Studio SEO paths point to `/studio/...` after flipping `studioBasePath`.

Check/update:

- `src/lib/seo.ts`
- canonical URLs
- Open Graph URLs
- Twitter image URLs
- `buildWebSiteJsonLd()` URL
- `buildLocalBusinessJsonLd()` URL and `sameAs`, if needed
- parent site SEO metadata once implemented

Avoid duplicate canonicals between `/` and `/studio`.

### 6. Update prerender routes and sitemap

`vite.config.ts` already uses `studioSite.routes` for prerender filtering. After migration, confirm the generated/static routes include:

- `/studio`
- `/studio/pricing`
- `/studio/gallery`
- `/studio/contact`

Also update sitemap handling:

- generated sitemap host remains `https://vertigovisuals.com.au`
- sitemap URLs should include `/studio/...` for Studio pages
- parent `/` should be added once the parent site exists
- exclude admin/login/booking-complete/booking-expired from public sitemap

### 7. Update robots.txt

Update `public/robots.txt` disallow rules from root paths to Studio paths:

```txt
Disallow: /studio/admin
Disallow: /studio/login
Disallow: /studio/booking-complete
Disallow: /studio/booking-expired
```

Keep or update the sitemap URL as needed.

### 8. Add root-to-studio redirects later

Add this later, during or after migration.

Recommended redirects:

- `/book` -> `/studio/book`
- `/pricing` -> `/studio/pricing`
- `/gallery` -> `/studio/gallery`
- `/contact` -> `/studio/contact`
- `/admin` -> `/studio/admin`
- `/login` -> `/studio/login`
- `/booking-complete` -> `/studio/booking-complete`
- `/booking-expired` -> `/studio/booking-expired`

Recommended status: `301` once the migration is permanent.

Decide separately whether `/` should redirect to `/studio` temporarily or become the parent menu immediately.

### 9. Check external integrations

Review any third-party URLs that may point to root-level paths:

- Stripe success/cancel/return URLs
- Clerk redirect URLs/settings
- Convex actions that generate links
- email templates
- booking invoice links
- calendar/email reminders
- analytics dashboards/events if path-specific

### 10. Validation

- `/` shows parent site/menu
- `/studio` shows Studio home
- all Studio nav links stay under `/studio`
- booking flow completes and returns to `/studio/booking-complete`
- expired booking flow routes to `/studio/booking-expired`
- admin auth redirects to `/studio/login` and `/studio/admin`
- parent and Studio favicons differ correctly
- canonical URLs match the visible route
- generated sitemap has correct URLs
