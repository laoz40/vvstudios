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

When one UI handler performs multiple operations, keep each operation's error handling separate. Do not wrap a tuple-result call and a later unrelated action in one broad `try/catch`. Handle the first `Result`, return on error, then handle the next operation with its own `Result` or small `try/catch`.

If a shared client helper used by the converted flow has expected failures, prefer converting that helper to tuple `Result` too instead of keeping a parallel `{ success: boolean, message?: string }` API. Update all current callers in the same pass so there is one error-handling style for that helper.

Keep creation and download responsibilities clear in handlers. For example, creating a custom invoice is a DB mutation, while downloading an invoice PDF is a separate client-side operation. They may stay as separate functions, but both should return typed tuple results when they have expected failures.

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

- `convex/googleCalendar.ts` `deleteBookingFromAdmin` now returns tuple `Result` values for auth, booking lookup, calendar deletion, and DB delete failures.

### Admin booking mutations

- `convex/bookings.ts` admin/public client-facing mutations now return tuple `Result` values for expected auth, booking lookup, validation/transition, and DB write failures.
- Converted mutations: `updateBooking`, `updateBookingStatus`, `updateBookingPaidRemainingBalance`, `updateBookingEditStatus`, `updateBookingRemainingBalanceAmount`, and `saveBookingInstagramHandle`.

### Admin Google Calendar update booking

- `convex/googleCalendar.ts` `updateBookingFromAdmin` and related admin edit helpers now return tuple `Result` values for expected auth, booking lookup, calendar, and edit-save failures.

### Admin availability settings

- `convex/bookingSettings.ts` `update` now returns tuple `Result` values for auth, settings validation, and DB write failures.
- Keeps existing settings types/constants and uses an inline Convex handler wrapper to preserve generated argument inference.

### Admin deliverables email

- `convex/deliverablesEmail.ts` `sendBookingDeliverablesEmail` now returns tuple `Result` values for auth, booking lookup, Drive link validation, and email send failures.

### Admin custom invoices

- `convex/customInvoices.ts` `createCustomInvoice` now returns tuple `Result` values for auth and booking lookup failures.
- Admin invoice PDF download helper now returns tuple `Result` values for expected validation failures.
- Creation and PDF download are handled as separate operations with separate result handling.

### Public booking checkout session

- `convex/stripe.ts` embedded checkout create/close functions now return tuple `Result` values for expected input, rate-limit, availability, Stripe close, and session mismatch failures.

### Public feedback submit

- `convex/feedback.ts` `submit` now returns tuple `Result` values for empty message, rate-limit, and email send failures.

### Public invoice PDF download

- `convex/invoices.ts` `getBookingInvoicePdfByStripeSessionId` now returns tuple `Result` values for expected booking lookup, booking status, expiry, invoice data validation, and invoice generation failures.
- `convex/lib/bookingInvoiceArtifacts.ts` `createBookingInvoiceEmailArtifactsForBooking` now returns tuple `Result` values for invoice data validation failures instead of throwing `ConvexError`.
- `convex/lib/email.ts` `sendBookingInvoiceEmailsForBooking` now returns tuple `Result` values for invoice data validation and email send failures.
- Client `BookingResult.tsx` handles each invoice download error reason inline.

### Admin invoice email

- `convex/googleCalendar.ts` `sendBookingInvoiceForBooking` now returns tuple `Result` values for auth, booking lookup, email send, and invoice-email-sent marker failures.
- Client `BookingActions.tsx` handles each invoice email error reason inline.

### Public calendar availability

- `convex/googleCalendar.ts` `getBookableRangeBusyWindows` and `getAvailableBookingTimes` now return tuple `Result` values for Google Calendar auth, availability, and rate-limit failures.
- Client public booking page handles monthly availability errors inline.
- Removed unused throwing Google Calendar Convex error mapper; shared Google Calendar error mapping now returns codes.

### Admin cleanup old bookings

- `convex/bookings.ts` `cleanupOldPendingAndExpiredBookings` now returns tuple `Result` values for auth and cleanup failures.
- Client `AdminDashboard.tsx` handles cleanup errors inline.
  Removed after conversion:

- `UpdateBookingStatusErrorData`
- `SaveBookingInstagramHandleErrorData`
- `AdminAuthErrorCode` helper type
- `getBookingStatusMutationErrorMessage` client helper
- `getBookingMutationErrorMessage` client helper
- `getBookingInvoiceEmailErrorMessage` client helper
- `src/sites/studio/features/admin/lib/booking-action-errors.ts`
- `src/sites/studio/features/booking-form/lib/booking-errors.ts`

## Rollout Targets

Continue converting one public client-facing function at a time.

Next public client-facing targets:

- Continue remaining public client-facing functions that still use throwing helpers or `try/catch` error-message helpers.
- Then convert shared helper throws only where callers can safely consume tuple results.

Shared/internal helpers still throwing and not necessarily required to convert:

- `convex/lib/auth.ts` `requireAdmin` / `requireBookingInDb`
  - Keep for internal/server-only paths where throwing behavior is desired.
- `convex/lib/bookingCalendarTime.ts` date/time validation helpers
  - These are shared validators used by multiple flows. Convert only when a public caller needs direct tuple results, or map their thrown `ConvexError`s at the boundary.
- `convex/lib/googleCalendarErrors.ts` Google Calendar error mapping
  - Still supports older Google Calendar actions. Remove or replace only after all callers move to tuple mapping.
- `convex/lib/email.ts` Resend failure throw
  - Can stay as a low-level throw when callers catch and map to tuple errors.

Plain unexpected/invariant throws that should probably stay as throws:

- `convex/stripe.ts` `Stripe checkout session missing client secret`.
- `convex/googleCalendar.ts` internal `completeClaimedBooking` errors: `Booking not found`, `Booking confirmation was not claimed`.
  Do not convert the whole app in one pass.

## Checks

After each small conversion, run:

```sh
bun run format
bun run lint
bunx tsc --noEmit
```

Per project instructions, do not run build or Convex codegen unless explicitly asked.
