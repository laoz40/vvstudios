# Tuple Result Error Handling Refactor Plan

## Goal

Use tuple `Result` returns for expected client-facing failures:

```ts
Result<Success, Error> = [error, null] | [null, data];
```

Expected app/domain failures should be returned with `err(...)`. Unexpected runtime/developer failures may still throw.

## Shared Result Helpers

Use `src/lib/result.ts`:

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

Client usage should pass the whole result type when inference widens:

```ts
const [error] = await tryCatch<DeleteBookingResult>(deleteBooking({ bookingId }));
```

## Result Type Style

Prefer inferred result types from the real handler returns. Do **not** duplicate error codes in a separate exported manual union unless inference cannot work.

Avoid aliases that only rename an existing type or constant. If `BookingAvailabilitySettings` or `DEFAULT_BOOKING_AVAILABILITY_SETTINGS` already exists, use it directly instead of adding wrappers like `BookingSettingsArgs = BookingAvailabilitySettings` or `DEFAULT_BOOKING_SETTINGS = DEFAULT_BOOKING_AVAILABILITY_SETTINGS`.

When a handler needs an explicit `Result` return type for TypeScript, inline the success and error shapes at that return type. Avoid extra top-level aliases like `SomeSuccess`, `SomeError`, or `SomeHandlerResult` unless they are reused or make a complex type much clearer.

For one-off internal call results, prefer local inline annotations near the call instead of top-level aliases.
Preferred order:

1. Export the Convex function.
2. Put the named handler immediately underneath it.
3. Export the inferred result type near the handler.

Example:

```ts
type DeleteBookingArgs = { bookingId: Id<"bookings"> };

export const deleteBooking = mutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => deleteBookingHandler(ctx, args)
});

async function deleteBookingHandler(ctx: MutationCtx, args: DeleteBookingArgs) {
	const identity = await ctx.auth.getUserIdentity();

	if (!identity) {
		return err({ reason: "NOT_AUTHENTICATED" });
	}

	if (!isAdminIdentity(identity)) {
		return err({ reason: "NOT_AUTHORIZED" });
	}

	const booking = await ctx.db.get(args.bookingId);

	if (!booking) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	try {
		await ctx.db.delete(booking._id);
	} catch {
		return err({ reason: "BOOKING_DELETE_FAILED" });
	}

	return ok({ deleted: true });
}

export type DeleteBookingResult = Awaited<ReturnType<typeof deleteBookingHandler>>;
```

The expected error codes live in the actual `return err({ reason: "..." })` lines. If a new `err(...)` return is added, the exported result type updates automatically.

If a catch block maps thrown expected errors into `err(...)`, keep the mapping close to the catch with clear guard clauses. Avoid tiny one-off helper functions unless the mapping is reused.

Convex typing preference: do not add temporary client-side `FunctionReference` casts to work around stale generated types. If Convex client types are stale, the user will run Convex codegen. If a named handler causes Convex to infer args as `EmptyObject`, keep the named handler for result inference but use a small inline wrapper in the Convex function: `handler: (ctx, args) => namedHandler(ctx, args)`.

## Client Handling Style

Handle the tuple result explicitly and keep exhaustive switches:

```ts
const [error] = await tryCatch<DeleteBookingResult>(deleteBooking({ bookingId }));

if (error !== null) {
	switch (error.reason) {
		case "NOT_AUTHENTICATED":
			toast.error("Please sign in first.");
			return;

		case "NOT_AUTHORIZED":
			toast.error("You do not have permission to delete bookings.");
			return;

		case "BOOKING_NOT_FOUND":
			toast.error("This booking no longer exists.");
			return;

		case "BOOKING_DELETE_FAILED":
			toast.error("Failed to delete booking.");
			return;

		case "UNEXPECTED_ERROR":
			toast.error("Something went wrong with deleting booking.");
			return;

		default: {
			const _exhaustive: never = error;
			return _exhaustive;
		}
	}
}

toast.success("Booking deleted");
```

If `error.reason` becomes plain `string`, import the inferred result type from the Convex module and call `tryCatch<ResultType>(...)`.

Toast preference: do not group specific expected write failures with `UNEXPECTED_ERROR`. Use a specific message for the known failure, such as “Failed to save availability settings.” Use a separate unexpected message, such as “Something went wrong with saving availability settings.”

Client message preference: keep expected error messages inline in the component switch where the action is handled. Do not add external error-message helpers for one converted action unless the same mapping is reused by multiple clients.

Client switches should keep messages inline and obvious. If the same message mapping is truly reused by multiple clients, then a helper is okay.

## Convex Mutation Safety

Convex mutations commit when they return and roll back when they throw. Because `err(...)` returns, do expected failure checks before writes.

Good:

```ts
if (somethingWouldFail) {
	return err({ reason: "SOMETHING_FAILED" });
}

await ctx.db.patch(bookingId, patch);
return ok({ saved: true });
```

Avoid returning `err(...)` after partial writes unless those writes should commit.

For one-write mutations, catching the write and returning a typed failure is okay:

```ts
try {
	await ctx.db.delete(booking._id);
} catch {
	return err({ reason: "BOOKING_DELETE_FAILED" });
}
```

## Auth Style

For converted public client-facing functions, prefer non-throwing checks instead of `requireAdmin` / `requireBookingInDb`:

```ts
const identity = await ctx.auth.getUserIdentity();

if (!identity) {
	return err({ reason: "NOT_AUTHENTICATED" });
}

if (!isAdminIdentity(identity)) {
	return err({ reason: "NOT_AUTHORIZED" });
}

const booking = await ctx.db.get(args.bookingId);

if (!booking) {
	return err({ reason: "BOOKING_NOT_FOUND" });
}
```

Keep throwing helpers where throwing is desired, especially internal/server-only paths or impossible states.

Unexpected invariant failures can still throw plain `Error`. Do not create a `ConvexError` code for failures the client should only treat as `UNEXPECTED_ERROR`, such as Stripe returning a successful embedded checkout session without a `client_secret`.

## Google Calendar / Node-only Helpers

Do not import Node-only Google client code from shared Convex helper files.

Pattern implemented for delete booking:

- `convex/lib/googleCalendarEvents.ts`
  - Shared/pure calendar event payload helpers only.
  - No `getGoogleCalendarClient`.
- `convex/lib/googleCalendarEventDeletion.ts`
  - Has `"use node"`.
  - Imports `getGoogleCalendarClient` and performs Google Calendar API deletion.
  - Returns tuple `Result` for expected Google failures.
- `convex/googleCalendar.ts`
  - Keeps auth and booking lookup in the action handler.
  - Calls `deleteBookingCalendarEvent({ booking })`.

Helper naming preference: use behavior names like `deleteBookingCalendarEvent`, not `try...` or `...ForAdmin` unless the helper actually enforces admin behavior.

## Converted Areas So Far

### Admin delete booking

Delete booking currently uses tuple results across:

1. `convex/googleCalendar.ts` public action `deleteBookingFromAdmin`.
2. Auth check returns `NOT_AUTHENTICATED` / `NOT_AUTHORIZED`.
3. Booking lookup returns `BOOKING_NOT_FOUND`.
4. Calendar deletion helper returns Google Calendar tuple errors.
5. Internal DB delete maps failures to `BOOKING_DELETE_FAILED`.
6. Client handles all reasons plus `UNEXPECTED_ERROR` through `tryCatch<DeleteBookingFromAdminResult>(...)`.

### Admin booking mutations

The following `convex/bookings.ts` mutations now use tuple `Result` returns with inferred exported result types:

- `updateBooking`
  - Returns auth, booking lookup, and `BOOKING_UPDATE_FAILED` reasons.
  - Client-side admin edit save still goes through `convex/googleCalendar.ts` `updateBookingFromAdmin`, so this direct mutation result type is available but not the main edit flow.
- `updateBookingStatus`
  - Returns auth, booking lookup, `INVALID_BOOKING_STATUS_TRANSITION`, and `BOOKING_STATUS_UPDATE_FAILED` reasons.
  - Client handles reasons explicitly in `BookingActions.tsx`.
- `updateBookingPaidRemainingBalance`
  - Returns auth, booking lookup, and `BOOKING_PAID_REMAINING_BALANCE_UPDATE_FAILED` reasons.
  - Client handles reasons explicitly in `BookingActions.tsx`.
- `updateBookingEditStatus`
  - Returns auth, booking lookup, and `BOOKING_EDIT_STATUS_UPDATE_FAILED` reasons.
  - Client handles reasons explicitly in `BookingActions.tsx`.
  - Deliverables email flow sends the email first, then handles status update result errors separately.
- `updateBookingRemainingBalanceAmount`
  - Returns auth, booking lookup, and `BOOKING_REMAINING_BALANCE_AMOUNT_UPDATE_FAILED` reasons.
  - Client handles reasons explicitly in `BookingActions.tsx`.
- `saveBookingInstagramHandle`
  - Returns `BOOKING_NOT_FOUND`, `BOOKING_NOT_CONFIRMED`, and `BOOKING_INSTAGRAM_HANDLE_SAVE_FAILED` reasons.
  - Client handles reasons explicitly in `InstagramRepostPrompt.tsx`.

### Admin Google Calendar update booking

- `convex/googleCalendar.ts` `updateBookingFromAdmin` now returns tuple `Result` values.
- Auth and booking lookup return `NOT_AUTHENTICATED`, `NOT_AUTHORIZED`, and `BOOKING_NOT_FOUND`.
- Google Calendar availability/create/update/auth/rate limit failures map to tuple reasons.
- `convex/lib/bookingAdminEdit.ts` returns `err(...)` at the point failures happen instead of throwing `ConvexError` and translating later.
- Client admin edit save handles `UpdateBookingFromAdminResult` explicitly in `BookingActions.tsx`.

### Admin availability settings

- `convex/bookingSettings.ts` `update` now returns tuple `Result` values.
- Auth checks return `NOT_AUTHENTICATED` and `NOT_AUTHORIZED`.
- Settings validation returns `INVALID_BOOKING_SETTINGS`.
- DB write failures return `BOOKING_SETTINGS_UPDATE_FAILED`.
- Client handles `UpdateBookingSettingsResult` explicitly in `AdminAvailabilitySettings.tsx`.
- Uses direct existing settings types/constants instead of one-line wrapper aliases.
- Uses an inline Convex handler wrapper to preserve generated argument inference without client-side `FunctionReference` casts.

### Admin deliverables email

- `convex/deliverablesEmail.ts` `sendBookingDeliverablesEmail` now returns tuple `Result` values.
- Auth checks return `NOT_AUTHENTICATED` and `NOT_AUTHORIZED`.
- Booking lookup returns `BOOKING_NOT_FOUND`.
- Invalid Drive links return `INVALID_DRIVE_LINK`.
- Email send failures return `DELIVERABLES_SEND_FAILED`.
- Client handles `SendBookingDeliverablesEmailResult` explicitly in `BookingActions.tsx`.
- The old ConvexError-to-message helper `booking-email-errors.ts` was removed.

Removed after conversion:

- `UpdateBookingStatusErrorData`
- `SaveBookingInstagramHandleErrorData`
- `AdminAuthErrorCode` helper type
- `getBookingStatusMutationErrorMessage` client helper

### Public booking checkout session

- `convex/stripe.ts` `createEmbeddedCheckoutSession` now returns tuple `Result` values.
- Invalid form input returns `BOOKING_INVALID_INPUT`.
- Invalid email domains return `BOOKING_EMAIL_DOMAIN_INVALID`.
- Booking rate limits return `BOOKING_RATE_LIMITED`.
- Availability/input validation failures from pending booking creation map to `BOOKING_TIME_UNAVAILABLE` or `BOOKING_INVALID_INPUT`.
- Client handles `CreateEmbeddedCheckoutSessionResult` through `tryCatch<CreateEmbeddedCheckoutSessionResult>(...)` in `src/routes/_public/book.tsx`.
- `convex/stripe.ts` `closeEmbeddedCheckoutSession` now returns tuple `Result` values.
- Stripe retrieve/expire failures return `STRIPE_CHECKOUT_CLOSE_FAILED`.
- Pending booking delete mismatch returns `STRIPE_SESSION_MISMATCH`.
- Client handles `CloseEmbeddedCheckoutSessionResult` through `tryCatch<CloseEmbeddedCheckoutSessionResult>(...)` in `src/routes/_public/book.tsx`.

## Rollout Targets

Continue converting one public client-facing function at a time.

Next targets to consider:

- remaining `convex/deliverablesEmail.ts` actions, if any are added
- other `convex/googleCalendar.ts` admin actions
- remaining `convex/stripe.ts` public actions, if any are added

Do not convert the whole app in one pass.

## Checks

After each small conversion, run:

```sh
bun run format
bun run lint
bunx tsc --noEmit
```

Per project instructions, do not run build or Convex codegen unless explicitly asked.
