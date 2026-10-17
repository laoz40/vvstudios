# Convex three-layer architecture

**Goal:** every endpoint is built from three layers. Each layer only calls the layer below it.

## Workflow

- For a planned schema/data migration or backfill, read the [convex-migration-helper skill](../.agents/skills/convex-migration-helper/SKILL.md) before designing the rollout.
- In a cloud VM, read the [convex-cloud-agents skill](../.agents/skills/convex-cloud-agents/SKILL.md) before selecting or pushing to a deployment. It defines when to use the shared dev deployment or create an isolated one. Select the deployment before running the verification/sync command below.
- Use `bun run verify --convex` to verify and sync changed functions to the configured dev deployment when no long-running `convex dev` is already up and no deploy key is set. If one is already running, omit `--convex` and wait for it to finish syncing before E2E.
- Do not start a long-running `convex dev`.

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

Feature paths determine Convex API paths: `convex/packages/scheduling.ts` exposes `api.packages.scheduling.*`. Cross-cutting auth, result, email, and validator code belongs in `convex/shared/`.

## Handlers (`convex/<feature>/*.ts` and root globals)

- Thin entrypoints that call **services only**.
- Read like a short, flat list of steps describing what the endpoint does (as many steps as the story needs — keep it scannable).
- **No** direct `ctx.db` calls, **no** `#convex/.../lib` imports, **no** domain logic in the handler file (allowlisted exceptions: `http.ts`, `devSeed.ts`, `schema.ts`, `convex/sessions/drive.ts`, …).
- Own validators and step order; compose service steps with `safeTry` generators and `yield*`, then wire tuple results with `.match(tupleOk, tupleErr)`. Crons and internal mutations reuse the same service steps.
- Paginated queries keep Convex's plain page format. The handler may await the service Result, throw `ConvexError` for an error, and return the page value. This converts the boundary format without choosing domain operations. Wrap individual reads inside service/lib row-load steps with `okOrThrow`.

## Services (`convex/<feature>/services/**`, `convex/shared/services/**`)

- Each exported function is **one abstraction**: a meaningful, reusable unit of work (get item, parse item, validate item, save item).
- Composed from **lib** functions (and other services when needed).
- One service **file** groups related abstractions for one domain concept.
- **File layout:** name modules for what they do (`checkoutMutations.ts`, `queries.ts`, `invoiceSend.ts`). No `Workflow`, `MutationWorkflow`, or layer jargon in filenames; the parent folder is the feature (`packages/services/`). Do not repeat the feature name in the basename when the path already provides it. Internal Convex entrypoints live in the feature folder (e.g. `sessions/drive.ts`), not under a generic `convex/internal/` folder.
- Function bodies compose meaningful operations with neverthrow `safeTry` generators and `yield*`. Use `function*` for synchronous Results and `async function*` for asynchronous steps, and return `ok(value)` on success. Keep simple mappings, literals, Result constructors, conditional value mappings, argument objects, and projections inline. Do not extract these into tiny wrappers or assign bound callbacks. Domain validation, operation selection (including ternaries, short-circuit calls, optional calls, and selected function references), collection eligibility, non-orchestration loops, and I/O live in lib, including implementation used by private helpers and callbacks. Use `for (const item of items)` inside a `safeTry` generator to sequence Result operations over already selected records. Authorization services load the caller's identity and access and compose lib checks.
- Name functions for the domain action they perform. Do not add `Step` just because a function appears in a chain.
- Lib validation returns a `Result` directly; services unwrap it with `yield*`. Do not replace a validation with a callback selector and a returned thunk. Do not select operations from callback tables and immediately invoke them. Skip-capable I/O functions can accept an optional input and return success without I/O when there is nothing to do.
- `.match` is only used as the terminal `.match(tupleOk, tupleErr)` conversion in a registered handler. Services and lib return Results for callers to compose. Do not invent error reasons to represent successful skips.
- Mutation/query services do not use `ctx.runQuery` / `ctx.runMutation`.
- A service forwarding one operation does not need a generator wrapper.

For example, a service can wire arguments and shape its final response directly:

```ts
return safeTry(async function* () {
	const booking = yield* loadBooking(ctx, id);
	const validatedBooking = yield* validateBookingForConfirmation(booking);
	const confirmedBooking = yield* saveBookingConfirmation(ctx, validatedBooking);
	yield* sendBookingReceipt(confirmedBooking);
	return ok({ confirmed: true });
});
```

`validateBookingForConfirmation` lives in lib and returns `err` for missing or invalid bookings, or `ok(booking)` when valid. The response literal needs no named helper.

For optional work, keep the sequence in the service and put eligibility in the lib operation:

```ts
return safeTry(async function* () {
	yield* saveSessionEditStatus(ctx, session, editStatus);
	const args = yield* loadDeliverablesReviewHostEmailArgs(ctx, session, identity, editStatus);
	yield* scheduleDeliverablesReviewHostEmail(ctx, args);
	return ok(yield* archiveSessionWhenFullyDone(ctx, session._id));
});
```

The loader returns `okAsync(null)` without reading when notification is ineligible. The scheduler accepts that null and returns success without scheduling. Use nullable inputs for operations that can be skipped; ordinary required operations keep required inputs. Neither helper selects or invokes a service callback, and the lib functions do not compose Result steps.

For work on eligible records, lib selects the records and the service composes the operation for each one:

```ts
return safeTry(async function* () {
	const setup = yield* queryOptionalEditorSetup(ctx, args);
	const bookingIds = yield* selectBookingsForEditorAccessSetup(setup);
	yield* ResultAsync.combine(
		bookingIds.map((bookingId) => setupEditorAccess(ctx, { bookingId }))
	);
	return ok(null);
});
```

The selector returns a genuine not-found error for a missing booking, an empty list for an unassigned booking, or its ID when assigned. An empty list runs no setup operations. Select domain data, never functions or callbacks. Keep `ResultAsync.combine` for existing parallel operations, and preserve sequential collection processing rather than converting it to parallel work. Error transformations and recovery may still use `.mapErr` and `.orElse`.

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

## Conventions

- Do not duplicate constants or defaults between the frontend and Convex; extract shared values to one importable source when possible.
- Do not suffix internal Convex function names with `Internal` or similar; that is obvious from context.
- Services whose handlers are exported in the same API module may need an explicit `ResultAsync<..., { reason: string }>` return type to break circular inference.
- Let TypeScript infer service return types, callback parameters, and local values. Keep annotations needed for input contracts, intentional constraints, or circular inference; remove unused output aliases and imports.
- New service **functions** are verb-first; do not bulk-rename existing symbols. Split a service that branches on which endpoint called it (mode flags, endpoint-only optional args).

## Neverthrow and errors

Service and lib steps return `Result` / `ResultAsync`. Compose Results in handlers and services as described above; lib returns individual Results. Preserve existing step order, error mapping/recovery, and parallel or sequential collection semantics.

- Return real domain `reason` codes from lib, email senders, and rate limiters. Do not `mapErr` into synthetic codes. Fire-and-forget success returns `null`.
- Use the helpers in `convex/shared/lib/result.ts` instead of calling `fromSafePromise` / `fromPromise` directly.
  - `okOrThrow` wraps a single Convex I/O at that step: `ctx.db.*`, `ctx.scheduler.*`, `ctx.auth.getUserIdentity()`, or raw `runQuery` / `runMutation`. Infra throws; domain outcomes return `err(...)` from lib validation steps.
  - `fromConvexTuple` wraps `runQuery` / `runMutation` whose handler uses `.match(tupleOk, tupleErr)`.
  - `tryPromise` wraps external APIs such as Stripe, Resend, Google, and render. Its `catch` maps to a domain `err`, never rethrows.
- Lib exports returning `ResultAsync` build it from steps; no export-level `tryPromise` / `okOrThrow` around internal async helpers.

During a user-requested Convex code review, read the [review checklist](./convex-neverthrow-review.md) before checking layer boundaries and neverthrow wrappers.

## Lint enforcement

Run `bun run lint` and follow the diagnostics. When fixing a `convex-layers/*` or `neverthrow/*` lint failure, check [.oxlintrc.json](../.oxlintrc.json) for its active file scope. If the diagnostic is unclear, read the matching rule and colocated tests in [convex-layers](../tools/oxlint/convex-layers/) or [neverthrow](../tools/oxlint/neverthrow/) for accepted patterns and exceptions.

Lint checks handler-to-lib imports, service implementation, Result composition, wrapper restrictions, and designated owners for Drive and billing state writes. Handler domain logic and direct DB access still require manual checks. Application-wide restrictions on `.andThen` and `.asyncAndThen` direct composition to `safeTry` and `yield*`; Convex lib returns individual Results.

Passing lint does not establish that a helper owns meaningful work or that a domain error is appropriate. Checks recognize syntax and some local aliases, rather than arbitrary imported implementations. Trivial-wrapper detection covers static or identity returns and objects with at most two properties; skip-error detection recognizes explicit sentinels, rather than arbitrary domain reasons.

State-ownership checks recognize direct `ctx.db` writes with static table names and visible inline field keys. They do not resolve aliases, dynamic names, or fields hidden in variables or calls; test fixtures are exempt.
