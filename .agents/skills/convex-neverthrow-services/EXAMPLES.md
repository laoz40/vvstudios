# Convex Neverthrow Service Examples

## Query or mutation service

Alias the tuple helpers so they cannot be confused with neverthrow constructors.

```ts
// convex/lib/bookingService.ts
import { err, ok, ResultAsync } from "neverthrow";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { nullResult } from "../lib/result";

export function archiveBookingService(ctx: MutationCtx, bookingId: Id<"bookings">) {
  return ResultAsync.fromSafePromise(ctx.db.get(bookingId))
    .andThen((booking) => {
      if (booking === null) return err({ reason: "BOOKING_NOT_FOUND" as const });
      if (booking.status === "cancelled") {
        return err({ reason: "BOOKING_ALREADY_CANCELLED" as const });
      }
      return ok(booking);
    })
    .andThen((booking) =>
      nullResult(ctx.db.patch(booking._id, { status: "cancelled" }))
    );
}
```

A Convex rejection from `get` or `patch` rejects the chain. It does not become an expected `Err`. `nullResult` discards the successful write value and returns `null`.

```ts
// convex/bookings.ts
import { v } from "convex/values";
import { err as tupleErr, ok as tupleOk } from "../src/lib/result";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { archiveBookingService } from "./lib/bookingService";

// args type here if long

export const archiveBooking = mutation({
  args: { bookingId: v.id("bookings") },
  handler: (ctx, args) => archiveBookingHandler(ctx, args)
});

function archiveBookingHandler(ctx: MutationCtx, args: { bookingId: Id<"bookings"> }) {
  return archiveBookingService(ctx, args.bookingId).match(tupleOk, tupleErr);
}

export type ArchiveBookingResult = Awaited<ReturnType<typeof archiveBookingHandler>>;
```

Use the same boundary for queries. Query services accept `QueryCtx`, perform no writes, and return expected lookup or authorization failures through neverthrow.

## Action and internal mutation

Actions cannot use `ctx.db`. Keep atomic persistence in an internal mutation and let the action service orchestrate it.

```ts
import { err, ok, ResultAsync } from "neverthrow";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";

export function completeBookingService(ctx: ActionCtx, bookingId: string) {
  return ResultAsync.fromSafePromise(
    ctx.runMutation(internal.bookings.claimCompletion, { bookingId })
  )
    .andThen(([claimError, claim]) => {
      if (claimError !== null) return err(claimError);
      return ok(claim);
    })
    .andThen((claim) => sendConfirmationEmail(claim))
    .map(() => ({ completed: true as const }));
}
```

- A thrown internal mutation rejects `runMutation` and escapes the action service.
- If an external side effect succeeds before a later step fails, design idempotency or compensation; an action is not one transaction.

The action handler still converts expected service failures to tuple values:

```ts
function completeBookingHandler(ctx: ActionCtx, args: CompleteBookingArgs) {
  return completeBookingService(ctx, args.bookingId).match(tupleOk, tupleErr);
}

export type CompleteBookingResult = Awaited<ReturnType<typeof completeBookingHandler>>;
```

## React caller

```ts
const [error] = await tryCatch<ArchiveBookingResult>(
  archiveBooking({ bookingId })
);

if (error !== null) {
  switch (error.reason) {
    case "BOOKING_NOT_FOUND":
      toast.error("The booking no longer exists.");
      return;
    case "BOOKING_ALREADY_CANCELLED":
      toast.info("The booking is already cancelled.");
      return;
    case "UNEXPECTED_ERROR":
      toast.error("Something went wrong.");
      return;
    default: {
      const _exhaustive: never = error;
      return _exhaustive;
    }
  }
}

closeArchiveDialog();
```

## Anti-patterns

### Converting Convex failures into expected errors

```ts
// Wrong: hides a genuine server failure in the business-error channel.
ResultAsync.fromPromise(ctx.db.get(bookingId), () => ({ reason: "BOOKING_READ_FAILED" as const }));
```

### Returning neverthrow through Convex

```ts
// Wrong: neverthrow instances are not the public wire format. Convex return values must be serializable values such as plain objects, arrays, strings, and numbers.
handler: (ctx, args) => archiveBookingService(ctx, args.bookingId)
```

### Throwing expected errors

```ts
// Wrong for this architecture: callers lose the inferred expected error union.
service.match(
  (value) => value,
  (error) => { throw new ConvexError(error); }
);
```

### Returning an error after a write

```ts
await ctx.db.patch(bookingId, patch);
return err({ reason: "LATE_VALIDATION_FAILED" as const }); // The patch commits.
```

Validate first or restructure the mutation so no unintended write precedes an expected `Err`.
