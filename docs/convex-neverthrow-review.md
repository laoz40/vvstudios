# Convex neverthrow review checklist

Review-only companion for Convex layer migrations. Implementers: skim wrong/right pairs before opening a refactor PR; reviewers: run the litmus greps on touched handlers.

## Wrong / right

### Export wrapper around a domain promise

**Wrong:** `okOrThrow(fetchAdminPackagesListPage(ctx, args))` or `okOrThrow(stripe.invoices.create(...))`.

**Right:** Callee returns `ResultAsync`; services compose steps with `safeTry` and `yield*`, returning `ok(value)` on success. Reserve `okOrThrow` for one Convex I/O expression (`ctx.db…`, `ctx.runQuery`, `ctx.runMutation`, `ctx.scheduler`, `ctx.auth`).

### Mega-handler service

**Wrong:** `handler` calls one service function whose body is the entire workflow (`confirmPaidBooking` doing twelve steps).

**Right:** Handler composes named service steps with `safeTry` and `yield*`. Each step is a verb-shaped function.

### `tryPromise` catch rethrow

**Wrong:**

```ts
tryPromise({
  try: () => externalCall(),
  catch: (cause) => {
    throw cause;
  }
});
```

**Right:** Return a domain `err` from `catch`, or use `okOrThrow` on Convex I/O in the caller and keep external work in a `ResultAsync` callee.

### `okOrThrow` on DNS / fetch / Stripe

**Wrong:** `okOrThrow(resolveMx(domain))`, `okOrThrow(fetch(...))`.

**Right:** `tryPromise` (or a dedicated lib helper) inside the integration module; expose `ResultAsync` to services.

## Handler litmus

On touched handler files:

```bash
rg '\.(andThen|asyncAndThen)\b' convex src --glob '!**/_generated/**' --glob '!*.test.ts'
```

Any `.andThen` or `.asyncAndThen` use fails lint. Multi-step handlers use `safeTry` generators and `yield*`, then terminal `.match(tupleOk, tupleErr)`. A handler that only calls one service can return its tuple conversion directly.

Also spot-check:

```bash
git diff --name-only | xargs rg 'okOrThrow\(' 
```

Every hit should be Convex I/O at the call site (oxlint `neverthrow/no-export-okorthrow-on-call` enforces this on `convex/*/services/**`, `convex/shared/services/**`, feature handlers under `convex/<feature>/*.ts`, and root `convex/*.ts`; lib paths under `convex/*/lib/**` and `convex/shared/lib/**` are warn until migration catches up).

## Refactor scope

When the issue says layer migration, wrapper exports (`liftPromise`, `promiseResult`, `okOrThrow(wholeHelper())`) are out of scope even if tests pass. Fix the shape, not the symptom.
