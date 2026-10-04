# convex-handlers oxlint plugin

## `no-root-lib-import`

Top-level `convex/*.ts` files are Convex API entrypoints. They should call `convex/services/**`, not pull domain behavior from `convex/lib/**`.

- **Flagged:** value imports of functions, constants, or mixed schema + logic from `#convex/lib` or `#convex/lib/…` in `convex/<name>.ts`.
- **Allowed:** schema-only imports for handler `args`:
  - `import type { … }` (and inline `import { type … }`)
  - named exports whose imported name ends with `Validator` (Convex `v.*` validators and `as const` field maps re-exported under that naming)
- **Not in scope:** `convex/lib/**`, `convex/services/**`, `convex/internal/**`, nested paths, or `#/…` imports.
- **`export * from`** lib is always forbidden in root handlers.

### Examples

Allowed in `convex/booking.ts`:

```ts
import { bookingAddonsValidator, bookingAddonQuantitiesValidator } from "#convex/lib/booking/bookingAddonQuantities";
import { sessionReservationValidator } from "#convex/lib/sessions/sessionReservations";
import type { BusyDayWindow } from "#convex/lib/sessions/sessionCalendarTime";
```

Forbidden in `convex/booking.ts`:

```ts
import { reserveSessionTime } from "#convex/lib/sessions/sessionReservations";
import { checkBookingSubmitRateLimit } from "#convex/lib/rateLimits";
import { PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS } from "#convex/lib/packages/packageAdjustments";
```

### Migration allowlist

Handlers that still import lib **logic** are listed in [`allowlist.ts`](./allowlist.ts). Lint passes for those files until they are migrated; remove paths when non-schema lib imports are gone.

`convex/internal/**` may import lib (adapter modules after the sessions/drive split).
