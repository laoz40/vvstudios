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

## Service rules

- Put business orchestration in a named feature service under the nearest appropriate `convex/services/*` module.
- Return inferred `Result<T, E>` or `ResultAsync<T, E>`; avoid manually duplicating unions.
- Use `{ reason: "STABLE_CODE" }` discriminated errors and literal inference.
- Compose dependent expected outcomes with `andThen`; use `map` for infallible transformations.
- Use `ResultAsync.fromSafePromise` around Convex operations when rejection must propagate. Its rejection intentionally bypasses the Result channel.
- When a Convex write has no useful success payload, return `null` explicitly inside an async operation instead of appending `.map(() => null)`:

```ts
ResultAsync.fromSafePromise(
	(async () => {
		await ctx.db.patch(documentId, patch);
		return null;
	})()
);
```

  This keeps the valid Convex `null` result beside the write and avoids passing its non-serializable `undefined` return value to the tuple boundary.
- Use `ResultAsync.fromPromise` only when rejection is an expected, explicitly mapped product failure, such as a handled third-party outage.
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
