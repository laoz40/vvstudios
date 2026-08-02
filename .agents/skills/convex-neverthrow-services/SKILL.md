---
name: convex-neverthrow-services
description: Structures Convex business logic as neverthrow service layers while preserving serializable tuple Results at handlers and generic unexpected-error handling at React callers. Use when adding or refactoring Convex queries, mutations, actions, service functions.
---

# Convex Neverthrow Services

## Goal

Use three boundaries:

```text
React caller -> Convex handler -> service
                               -> action: internal query/mutation
```

- Services model only expected business failures with `Result`/`ResultAsync`.
- Convex and other unexpected failures remain thrown/rejected.
- Handlers convert neverthrow values into the project's serializable tuple `Result`.
- Client `tryCatch` converts rejected Convex calls into `UNEXPECTED_ERROR`.

## Before editing

- Inspect nearby Convex helpers before adding a service or adapter.
- Put reusable database lookups in the nearest feature lookup module and call them from services instead of rebuilding lookup logic inside a service.

## Service rules

- Put business orchestration in a named feature service under the nearest appropriate `convex/services/*` module.
- Return inferred `Result<T, E>` or `ResultAsync<T, E>`; avoid manually duplicating unions.
- Use `{ reason: "STABLE_CODE" }` discriminated errors and literal inference.
- Migrate the dependency chain, not just the top-level function. Replace touched tuple-returning lookups, parsers, and validators with native neverthrow and update their callers; do not add parallel `*Result` wrappers.
- Compose propagation with `map`/`andThen`. Avoid mechanical conversions such as `if (result.isErr()) return err(result.error)` or tuple unpacking. Use explicit branching only for distinct behavior such as cleanup.
- Convert tuples only at real boundaries: `fromConvexResult` for internal Convex calls and `.match(tupleOk, tupleErr)` in registered handlers.
- Compose dependent expected outcomes with `andThen`; use `map` for infallible transformations.
- Keep each `andThen` focused on one business step. For complex chains, add a brief, accurate business-flow comment immediately above every `andThen`.
- Carry only values required by the next chain section. Return `null` after intermediate write-only steps instead of forwarding unrelated documents or confirmation objects.
- Use `ResultAsync.fromSafePromise` around Convex operations when rejection must propagate. Its rejection intentionally bypasses the Result channel.
- Wrap Convex operations with the shared `okOrThrow` helper and explicitly return the service's success value:

```ts
okOrThrow(ctx.db.patch(documentId, patch).then(() => null));
```

  `okOrThrow` preserves unexpected promise rejections. Use `.then()` to make the successful service return value explicit, such as `null` or `{ session }`.
- Return only success values a caller uses. Default validation and write-only operations to `null`; do not add confirmation payloads such as `{ valid: true }`, `{ limited: false }`, `{ ok: true }`, or `{ updated: true }`.
- Use `ResultAsync.fromPromise` only when rejection is an expected, explicitly mapped product failure, such as a handled third-party outage.
- Do not wrap synchronous `Result` values in `Promise.resolve`/`fromSafePromise`; compose them directly.
- Avoid one-line forwarding helpers. Extract cohesive domain logic to the nearest `lib` module and keep services focused on orchestration.
- Do not broadly catch Convex/database exceptions or map them to business errors.
- Check all expected failures before writes. Returning `Err` after a mutation write commits that write unless the handler throws.

## Handler rules

- Keep validators and registration in the public Convex file.
- Export the Convex function first; place its named handler immediately below it.
- End the service with `.match(tupleOk, tupleErr)`; never return neverthrow class instances through Convex.
- Preserve inferred API types:

```ts
export type SomethingResult = Awaited<ReturnType<typeof somethingHandler>>;
```

- Do not throw expected business errors. TypeScript cannot infer thrown error types, and client `tryCatch` would collapse them into `UNEXPECTED_ERROR`.
- Let rejected Convex operations escape naturally.

## Action rules

- Actions orchestrate external I/O and internal queries/mutations; they never access `ctx.db`.
- Convert an internal function's tuple result back to neverthrow inside the action service.
- Wrap `ctx.runQuery`/`ctx.runMutation` with `fromSafePromise` so unexpected rejection propagates.
- Keep atomic checks and writes in one internal mutation. Multiple action calls are separate transactions; use idempotency or compensation where required.

## Client rules

- Import the inferred handler result type; do not recreate its success/error union.
- Call `tryCatch<SomethingResult>(convexCall(...))`.
- Exhaustively switch on `error.reason`, including `UNEXPECTED_ERROR`, with a `never` default.
- Never patch widened or `any` errors with casts; trace the backend return type.

## Verification

- Test expected `Err` branches and thrown unexpected failures separately.
- Verify no mutation can return an expected `Err` after unintended partial writes.

See [EXAMPLES.md](EXAMPLES.md) for mutation/query, action, caller, and anti-pattern examples.
