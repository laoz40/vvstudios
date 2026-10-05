# Convex three-layer architecture

**Goal:** every endpoint is built from three layers. Each layer only calls the layer below it.

## Handlers (`convex/<domain>.ts`)

- Thin entrypoints that call **services only**.
- Read like a short, flat list of steps describing what the endpoint does (as many steps as the story needs — keep it scannable).
- **No** direct `ctx.db` calls, **no** `convex/lib` imports, **no** domain logic in the handler file.
- Own validators and step order; wire tuple results with `.match(tupleOk, tupleErr)`.

## Services (`convex/services/**`)

- Each exported function is **one abstraction**: a meaningful, reusable unit of work (get item, parse item, validate item, save item).
- Composed from **lib** functions (and other services when needed).
- One service **file** groups related abstractions for one domain concept.
- **File layout:** name modules for what they do (`packageCheckoutMutations.ts`, `sessionQueries.ts`, `stripeInvoiceSend.ts`). No `Workflow`, `MutationWorkflow`, or layer jargon in filenames; the folder is the feature (`services/packages/`). Internal Convex entrypoints live next to the feature (e.g. `sessionsDriveInternal.ts`), not under a generic `convex/internal/` folder.
- Handlers chain several service functions together.
- Policy and invariants live here, not in handlers or lib.
- Mutation/query services do not use `ctx.runQuery` / `ctx.runMutation`.

## Lib (`convex/lib/**`)

- Small, single-purpose building blocks: DB operations and pure logic.
- No permission checks, workflow orchestration, or policy.

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

The `convex-layers` oxlint plugin (`tools/oxlint/convex-layers/`) runs on `convex/*.ts`, `convex/services/**`, and `convex/lib/**`:

| Rule | What it blocks |
| --- | --- |
| `convex-layers/no-handler-lib-import` | Top-level handler modules importing `#convex/lib/**`. Handlers call services only. Allowlisted entrypoints: `http.ts`, `devSeed.ts`, `schema.ts`. |
| `convex-layers/no-db-in-services` | `ctx.db` reads/writes inside `convex/services/**`. DB I/O stays in lib; services compose lib functions. |
| `convex-layers/no-lib-reexport` | `export { … } from "#convex/lib/…"` or re-exporting a lib import unchanged from a service file. Use a real service function, or `export type Foo = LibFoo` for public types. |
| `convex-layers/no-lib-loader-orchestration` | Exported `convex/lib/**` functions that call a loader (`get*` / `load*` / `list*` or `okOrThrow` on a db read / `runQuery`) and chain domain work with `.andThen`. Split into a loader-only lib helper plus a service that wires `loader.andThen(work)`. |

Rule unit tests live next to each rule under `tools/oxlint/convex-layers/rules/*.test.ts` (same layout as `tools/oxlint/neverthrow/`).
