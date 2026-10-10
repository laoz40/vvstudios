# Convex three-layer architecture

**Goal:** every endpoint is built from three layers. Each layer only calls the layer below it.

## Layout

Code is grouped by **feature** under `convex/`:

```text
convex/
  schema.ts, http.ts, crons.ts, …          # global entrypoints
  <feature>/
    *.ts                                   # handlers (public/internal Convex functions)
    services/
    lib/
    tests/                                 # optional colocated tests
  shared/
    lib/                                   # result, email, auth helpers, shared validators
    services/                              # auth, requirePermissionActions
  tests/                                   # integration tests (multi-domain)
```

Examples: `convex/packages/scheduling.ts`, `convex/booking/settings.ts`, `convex/sessions/admin.ts`.

## Handlers (`convex/<feature>/*.ts` and root globals)

- Thin entrypoints that call **services only**.
- Read like a short, flat list of steps describing what the endpoint does (as many steps as the story needs — keep it scannable).
- **No** direct `ctx.db` calls, **no** `#convex/.../lib` imports, **no** domain logic in the handler file (allowlisted exceptions: `http.ts`, `devSeed.ts`, `schema.ts`, `convex/sessions/drive.ts`, …).
- Own validators and step order; wire tuple results with `.match(tupleOk, tupleErr)`.

## Services (`convex/<feature>/services/**`, `convex/shared/services/**`)

- Each exported function is **one abstraction**: a meaningful, reusable unit of work (get item, parse item, validate item, save item).
- Composed from **lib** functions (and other services when needed).
- One service **file** groups related abstractions for one domain concept.
- **File layout:** name modules for what they do (`checkoutMutations.ts`, `queries.ts`, `invoiceSend.ts`). No `Workflow`, `MutationWorkflow`, or layer jargon in filenames; the parent folder is the feature (`packages/services/`). Do not repeat the feature name in the basename when the path already provides it. Internal Convex entrypoints live in the feature folder (e.g. `sessions/drive.ts`), not under a generic `convex/internal/` folder.
- Handlers chain several service functions together.
- Policy and invariants live here, not in handlers or lib. Authorization services load the caller's identity and access, choose the required permission, and compose lib checks.
- Mutation/query services do not use `ctx.runQuery` / `ctx.runMutation`.

## Lib (`convex/<feature>/lib/**`, `convex/shared/lib/**`)

- Small, single-purpose building blocks: DB operations and pure logic.
- Pure authorization checks on supplied values belong here, such as checking an identity's role, an editor profile's active status, or an access value's permissions.
- No authorization workflows, workflow orchestration, or policy. Services decide which checks an operation requires and load their inputs.

## How they fit

Handler story (top): parse the item → validate the item → save the item.

Inside a service step such as **get item**: permission check + DB read + not-found check — each a lib function, combined in the service.

## Guiding principles

1. **Handlers call abstractions only** — *what*, not *how*.
2. **Services are the abstractions** — named steps handlers mix and match.
3. **Lib holds the small pieces** — detail at the bottom, story at the top.
4. **Avoid pointless wrappers** — a service step should add something beyond a single lib call; if not, fold into a richer neighbor. Handlers still never import lib.
5. **No mega-service per endpoint** — do not hide the whole pipeline behind one `.match` on a single service call.
6. **Concrete step names** — not `persist` / `assert` / `prepare` / generic `ensure`.
7. **No client callbacks in step args** (e.g. `getStripeClient`) — create clients inside the step that uses them.

## Neverthrow & errors

Implementation rules live in [AGENTS.md](../AGENTS.md) under Convex → Neverthrow. Deeper review notes: [convex-neverthrow-review.md](./convex-neverthrow-review.md).

## Lint enforcement (`bun run lint`)

The `convex-layers` oxlint plugin (`tools/oxlint/convex-layers/`) runs on feature handlers, `convex/*/services/**`, `convex/*/lib/**`, `convex/shared/**`, and legacy paths if any remain:

| Rule | What it blocks |
| --- | --- |
| `convex-layers/no-handler-lib-import` | Handler modules importing `#convex/**/lib/**` directly. Handlers call services only. Allowlisted entrypoints include `http.ts`, `devSeed.ts`, `schema.ts`, `convex/sessions/drive.ts`. |
| `convex-layers/no-db-in-services` | `ctx.db` reads/writes inside service files. DB I/O stays in lib; services compose lib functions. |
| `convex-layers/no-lib-reexport` | `export { … } from "#convex/…/lib/…"` or re-exporting a lib import unchanged from a service file. Use a real service function, or `export type Foo = LibFoo` for public types. |
| `convex-layers/no-lib-loader-orchestration` | Exported lib functions that call a loader (`get*` / `load*` / `list*` or `okOrThrow` on a db read / `runQuery`) and chain domain work with `.andThen`. Split into a loader-only lib helper plus a service that wires `loader.andThen(work)`. |
| `convex-layers/no-drive-state-write-outside-owner` | Writes to Drive tables, booking Drive linkage, or booking Drive setup-failure fields outside their designated lib owners under `convex/drive/lib/`. |
| `convex-layers/no-billing-recovery-state-write-outside-owner` | Writes to `stripeInvoices`, `packageAdjustments`, or booking/package `originalPaidAmount` outside their designated lib owners under `convex/stripe/lib/` and `convex/packages/lib/`. |

The two ownership rules check direct `ctx.db` writes with static table names and visible inline field keys; they do not resolve aliases, dynamic names, or fields hidden in variables or function calls, and test fixtures are exempt.

Rule unit tests live next to each rule under `tools/oxlint/convex-layers/rules/*.test.ts` (same layout as `tools/oxlint/neverthrow/`).
