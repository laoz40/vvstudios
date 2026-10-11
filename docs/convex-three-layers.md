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
- Paginated queries keep Convex's plain page format. The handler may await the service Result, throw `ConvexError` for an error, and return the page value. This converts the boundary format without choosing domain operations.

## Services (`convex/<feature>/services/**`, `convex/shared/services/**`)

- Each exported function is **one abstraction**: a meaningful, reusable unit of work (get item, parse item, validate item, save item).
- Composed from **lib** functions (and other services when needed).
- One service **file** groups related abstractions for one domain concept.
- **File layout:** name modules for what they do (`checkoutMutations.ts`, `queries.ts`, `invoiceSend.ts`). No `Workflow`, `MutationWorkflow`, or layer jargon in filenames; the parent folder is the feature (`packages/services/`). Do not repeat the feature name in the basename when the path already provides it. Internal Convex entrypoints live in the feature folder (e.g. `sessions/drive.ts`), not under a generic `convex/internal/` folder.
- Handlers chain several service functions together.
- Function bodies compose meaningful operations with `.andThen` and `.map`. Keep simple mappings, literals, Result constructors, conditional value mappings, argument objects, and projections inline. Do not extract these into tiny wrappers or assign bound callbacks just to pass them into a chain. Domain validation, operation selection (including ternaries, short-circuit calls, optional calls, and selected function references), collection eligibility, loops, and I/O live in lib, including implementation used by private helpers and callbacks. Authorization services load the caller's identity and access and compose lib checks.
- Name functions for the domain action they perform. Do not add `Step` just because a function appears in a chain.
- Lib validation returns a `Result` directly; services compose it with `.andThen`. Do not replace a validation with a callback selector and a returned thunk. Do not select operations from callback tables and immediately invoke them. Skip-capable I/O functions can accept an optional input and return success without I/O when there is nothing to do.
- `.match` is only used as the terminal `.match(tupleOk, tupleErr)` conversion in a registered handler. Services and lib return Results for callers to compose. Do not invent error reasons to represent successful skips.
- Mutation/query services do not use `ctx.runQuery` / `ctx.runMutation`.

For example, a service can wire arguments and shape its final response directly:

```ts
return loadBooking(ctx, id)
	.andThen(validateBookingForConfirmation)
	.andThen((booking) => saveBookingConfirmation(ctx, booking))
	.andThen((booking) => sendBookingReceipt(booking))
	.map(() => ({ confirmed: true }));
```

`validateBookingForConfirmation` lives in lib and returns `err` for missing or invalid bookings, or `ok(booking)` when valid. The response literal needs no named helper.

For optional work, keep the sequence in the service and put eligibility in the lib operation:

```ts
return saveSessionEditStatus(ctx, session, editStatus)
	.andThen(() => loadDeliverablesReviewHostEmailArgs(ctx, session, identity, editStatus))
	.andThen((args) => scheduleDeliverablesReviewHostEmail(ctx, args))
	.andThen(() => archiveSessionWhenFullyDone(ctx, session._id));
```

The loader returns `okAsync(null)` without reading when notification is ineligible. The scheduler accepts that null and returns success without scheduling. Use nullable inputs for operations that can be skipped; ordinary required operations keep required inputs. Neither helper selects or invokes a service callback, and the lib functions do not compose Result steps.

For work on eligible records, lib selects the records and the service composes the operation for each one:

```ts
return queryOptionalEditorSetup(ctx, args)
	.andThen(selectBookingsForEditorAccessSetup)
	.andThen((bookingIds) =>
		ResultAsync.combine(
			bookingIds.map((bookingId) => setupEditorAccess(ctx, { bookingId }))
		).map(() => null)
	);
```

The selector returns a genuine not-found error for a missing booking, an empty list for an unassigned booking, or its ID when assigned. An empty list runs no setup operations. Select domain data, never functions or callbacks.

## Lib (`convex/<feature>/lib/**`, `convex/shared/lib/**`)

- Small, single-purpose building blocks: DB operations, external API operations, pure logic, branch decisions, and payload builders.
- Pure authorization checks on supplied values belong here, such as checking an identity's role, an editor profile's active status, or an access value's permissions.
- No workflow orchestration. Services decide the sequence of steps and load their inputs; lib implements the decisions within each step. Lib never calls up into services.

## How they fit

Handler story (top): parse the item → validate the item → save the item.

Inside a service step such as **get item**: permission check + DB read + not-found check — each a lib function, combined in the service.

## Guiding principles

1. **Handlers call abstractions only** — _what_, not _how_.
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

| Rule                                                          | What it blocks                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `convex-layers/no-handler-lib-import`                         | Handler modules importing `#convex/**/lib/**` directly. Handlers call services only. Allowlisted entrypoints include `http.ts`, `devSeed.ts`, `schema.ts`, `convex/sessions/drive.ts`.                                                                                                                                                                                                                |
| `convex-layers/no-service-implementation`                     | Statement-based branching, conditional operation calls, optional calls, selected-function aliases, callback-table dispatch, `.filter`, `.bind`, loops, `await`, throws, mutation, and raw Convex I/O in service functions, private helpers, and callbacks. Conditional value mappings, defaults, optional value access, argument objects, Result constructors, and direct composition remain allowed. |
| `convex-layers/no-result-match-outside-handler`               | Result `.match` access outside handlers, including literal computed access and destructuring. Registered handlers may only return a terminal `.match(tupleOk, tupleErr)` conversion.                                                                                                                                                                                                                  |
| `convex-layers/no-trivial-result-wrapper`                     | Named helpers returning only a literal, an argument, a tiny static object, or a Result wrapping those values. Inline callbacks and meaningful payload builders remain allowed.                                                                                                                                                                                                                        |
| `convex-layers/no-synthetic-skip-error`                       | Explicit `SKIP`/`SKIPPED` sentinel errors from neverthrow in service/lib code. Arbitrary domain codes cannot be classified by semantic intent.                                                                                                                                                                                                                                                        |
| `convex-layers/no-db-in-services`                             | `ctx.db` reads/writes inside service files. DB I/O stays in lib; services compose lib functions.                                                                                                                                                                                                                                                                                                      |
| `convex-layers/no-lib-reexport`                               | `export { … } from "#convex/…/lib/…"` or re-exporting a lib import unchanged from a service file. Use a real service function, or `export type Foo = LibFoo` for public types.                                                                                                                                                                                                                        |
| `convex-layers/no-lib-result-composition`                     | Any use of `.andThen`, `.asyncAndThen`, or neverthrow `safeTry` in lib, including pure helpers and private functions. Method references, literal computed access, destructuring, and aliased `safeTry` imports are checked. Compose Result steps in services; simple `.map` transformations remain allowed.                                                                                           |
| `convex-layers/no-drive-state-write-outside-owner`            | Writes to Drive tables, booking Drive linkage, or booking Drive setup-failure fields outside their designated lib owners under `convex/drive/lib/`.                                                                                                                                                                                                                                                   |
| `convex-layers/no-billing-recovery-state-write-outside-owner` | Writes to `stripeInvoices`, `packageAdjustments`, or booking/package `originalPaidAmount` outside their designated lib owners under `convex/stripe/lib/` and `convex/packages/lib/`.                                                                                                                                                                                                                  |

These checks enforce identifiable syntax, not every possible semantic disguise. Conditional calls and local aliases are checked, but arbitrary imported helper implementations require review. The trivial-wrapper check is intentionally limited to static or identity returns and objects with at most two properties. Synthetic skip errors with arbitrary names cannot be inferred reliably.

The two ownership rules check direct `ctx.db` writes with static table names and visible inline field keys; they do not resolve aliases, dynamic names, or fields hidden in variables or function calls, and test fixtures are exempt.

Rule unit tests live next to each rule under `tools/oxlint/convex-layers/rules/*.test.ts` (same layout as `tools/oxlint/neverthrow/`).
