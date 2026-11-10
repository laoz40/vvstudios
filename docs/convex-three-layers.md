# Convex architecture

Group code by feature under `convex/`. Feature paths determine API paths: `convex/packages/scheduling.ts` exposes `api.packages.scheduling.*`. Put cross-cutting code in `convex/shared/`.

## Layer responsibilities

- Handlers own validators, endpoint step order, and response conversion. Compose meaningful service steps, not domain logic or direct DB operations. Do not hide a multi-step endpoint behind one whole-workflow service.
- Services compose lib operations and other services. Each export owns a meaningful unit of work. Authorization services load identity and access, then delegate checks to lib.
- Lib owns DB and external API operations, calculations, validation, domain decisions, and payload construction. It does not orchestrate Result steps or call services.

Keep simple argument objects, projections, and response literals inline. Do not extract helpers merely to satisfy layer restrictions.

## Results and errors

Services and fallible lib operations return `Result` or `ResultAsync`. Compose steps in handlers and services with `safeTry` and `yield*`, returning `ok(value)` on success. Lib returns individual Results.

Convert Results with terminal `.match(tupleOk, tupleErr)` in handlers. Paginated queries instead return the plain Convex page, throwing `ConvexError` for a service error.

Use `convex/shared/lib/result.ts`:
- `okOrThrow` for individual Convex I/O operations. Infrastructure failures throw.
- `fromConvexTuple` for calls to handlers returning Result tuples.
- `tryPromise` for external APIs, mapping expected failures to domain errors.

Preserve domain reason codes, recovery behavior, step order, and sequential or parallel execution. Successful skips return a success value, not an error. Keep skip eligibility in lib and operation sequencing in services.

## Conventions

- Group related service operations by domain concept.
- Name modules for their work, without `Workflow` or redundant feature names.
- Use verb-first names for new service functions. Do not bulk-rename existing ones.
- Keep internal entrypoints in their feature folder, without `Internal` suffixes.
- Split services that select behavior based on the calling endpoint.
- Create external clients inside the operation that uses them, not via callback arguments.
- Infer return types unless an explicit Result type is needed to break circular inference.

## Convex neverthrow review checklist

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

