---
name: convex-result-type-error-handling
description: Applies Result type error handling to Convex client-facing functions and React callers using a Rust-inspired tuple shape. Use when converting Convex queries, mutations, actions, helpers, or UI handlers to use ok(...), err(...), tryCatch(...), and exhaustive error.reason handling.
---

# Convex Result Type Error Handling

## Quick start

Use a Result type for expected client-facing failures. This implementation uses a tuple shape:

```ts
Result<Success, Error> = [error, null] | [null, data];
```

Expected app/domain failures return `err({ reason: "..." })`; success returns `ok(data)`. Unexpected invariant/developer failures may still throw.

## Define the Result helpers

Create or reuse shared helpers equivalent to this:

```ts
export type Result<S, E extends { reason: string }> =
	| [error: E, data: null]
	| [error: null, data: S];

export function ok<S>(data: S): Result<S, never> {
	return [null, data];
}

export function err<const R extends string, E extends { reason: R }>(error: E): Result<never, E> {
	return [error, null];
}

export type UnexpectedError = { reason: "UNEXPECTED_ERROR" };

export async function tryCatch<R extends Result<unknown, { reason: string }>>(
	promise: Promise<R>
): Promise<R | Result<never, UnexpectedError>> {
	try {
		return await promise;
	} catch {
		return err({ reason: "UNEXPECTED_ERROR" });
	}
}
```

## Convex conversion workflow

1. Convert public/client-facing expected failures to tuple `Result` values: auth, authorization, validation, lookup, rate-limit, third-party, and expected write failures.
2. Use `reason` as the stable error discriminator.
3. Prefer non-throwing helpers for repeated expected checks, such as auth and lookup helpers that return `Result` tuples.
4. Check expected failures before writes. Convex mutations commit when they return and roll back when they throw, so avoid `err(...)` after partial writes unless those writes should commit.

## Handler and type style

Prefer inferred result types from handler returns:

```ts
type RemoveItemArgs = { itemId: Id<"items"> };

export const removeItem = mutation({
	args: { itemId: v.id("items") },
	handler: (ctx, args) => removeItemHandler(ctx, args),
});

async function removeItemHandler(ctx: MutationCtx, args: RemoveItemArgs) {
	const item = await ctx.db.get(args.itemId);
	if (!item) return err({ reason: "ITEM_NOT_FOUND" });

	try {
		await ctx.db.delete(item._id);
	} catch {
		return err({ reason: "ITEM_DELETE_FAILED" });
	}

	return ok({ removed: true });
}

export type RemoveItemResult = Awaited<ReturnType<typeof removeItemHandler>>;
```

Rules:

- Export the Convex function first, put the named handler immediately below it, then export the inferred result type near the handler.
- Do not duplicate error-code unions unless inference cannot work.
- Avoid aliases that only rename existing types or constants.
- Inline one-off success/error shapes in return annotations when TypeScript needs help.
- If a named handler causes Convex to infer args as `EmptyObject`, keep the named handler but use `handler: (ctx, args) => namedHandler(ctx, args)`.
- Do not add temporary client-side `FunctionReference` casts for stale generated types.

## Client handling style

Handle tuple results explicitly and exhaustively:

```ts
const [error] = await tryCatch<RemoveItemResult>(removeItem({ itemId }));

if (error !== null) {
	switch (error.reason) {
		case "ITEM_NOT_FOUND":
			toast.error("This item no longer exists.");
			return;
		case "ITEM_DELETE_FAILED":
			toast.error("Failed to remove item.");
			return;
		case "UNEXPECTED_ERROR":
			toast.error("Something went wrong while removing the item.");
			return;
		default: {
			const _exhaustive: never = error;
			return _exhaustive;
		}
	}
}
```

Client rules:

- If `error.reason` widens to `string`, import the inferred result type and call `tryCatch<ResultType>(...)`.
- Keep expected messages inline in the caller unless reused by multiple callers.
- Do not group known expected write failures with `UNEXPECTED_ERROR`.
- When one handler performs multiple operations, handle each operation separately instead of one broad `try/catch`.
- If a shared client helper has expected failures, convert it to tuple `Result` too and update current callers in the same pass.
