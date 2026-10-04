# convex-handlers oxlint plugin

## `no-root-lib-import`

Top-level `convex/*.ts` files are Convex API entrypoints. They should call `convex/services/**`, not pull domain behavior from `convex/lib/**`.

- **Flagged:** `import` / `export … from` with source `#convex/lib` or `#convex/lib/…` in `convex/<name>.ts` only.
- **Not flagged:** `convex/lib/**`, `convex/services/**`, `convex/internal/**`, nested paths, or `#/…` imports.
- **Type-only:** `import type` from lib is also forbidden in root handlers (same boundary).

### Migration allowlist

Existing violations are listed in [`allowlist.ts`](./allowlist.ts). Lint passes while handlers are migrated; remove paths from the set as each file stops importing lib.

`convex/internal/**` may import lib (adapter modules after the sessions/drive split).
