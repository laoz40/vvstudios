# Package scheduling refactor: bookings as the source of truth

## Goal

Remove fixed package slots. A package defines only its capacity; every scheduled package session is a normal booking linked to that package.

```ts
multiBookingPackages {
  packageSize: 4 | 8 | 12;
  // remove sessions
}

bookings {
  multiBookingPackageId: Id<"multiBookingPackages">;
  // remove multiBookingSlotNumber
}
```

Cancelled bookings remain in the database for history and admin filtering, but no longer consume package capacity or appear on the customer scheduling page.

## Core invariant

For every customer-token operation:

1. Resolve the package from the secure scheduling token.
2. Validate that the package is paid, scheduling is active, and it has not expired.
3. For booking-ID operations, verify `booking.multiBookingPackageId === package._id`.

A package may have at most `packageSize` capacity-consuming bookings.

## Capacity-consuming statuses

Use one shared helper to define this rule. Do not rely on ad-hoc checks such as `status !== "cancelled"`.

| Booking status | Consumes capacity | Customer page |
| --- | --- | --- |
| `confirmed` | Yes | Show |
| `email_failed` | Yes | Show |
| `cancelled` | No | Hide |
| `pending_payment` | No | Hide |
| `failed` | No | Hide |
| `expired` | No | Hide |
| `abandoned` | No | Hide |

Package-created sessions should normally be `confirmed`. `email_failed` remains capacity-consuming because the session exists even when its email delivery failed.

## Schema and query changes

1. Remove `multiBookingPackages.sessions`.
2. Remove `bookings.multiBookingSlotNumber`.
3. Remove `by_multiBookingPackageId_and_multiBookingSlotNumber`.
4. Keep `bookings.multiBookingPackageId`.
5. Replace slot lookups with a package-booking query that returns only capacity-consuming package bookings ordered by `sessionStartAt`.
6. Ensure the query/index design does not require loading an unbounded cancellation history. A package can have only 4, 8, or 12 active sessions, but can have arbitrarily many cancelled booking rows over time.
7. Keep a separate admin-history query/filter path that can include cancelled package bookings.

Because there is no live data, change the schema directly; no migration is needed.

## Shared helpers

Create or adapt shared package-scheduling helpers for:

- determining whether a booking consumes package capacity;
- retrieving package bookings for the customer page, ordered by `sessionStartAt`;
- calculating `remainingSessions = packageSize - activeBookingCount`;
- verifying a booking belongs to the package resolved by a token;
- generating the dynamic package progress label for admin UI.

Do not persist a display position. It is derived from the current date order.

## Customer scheduling page

### Data model for the page

1. Fetch the package through the token.
2. Fetch capacity-consuming bookings linked to it, ascending by `sessionStartAt`.
3. Derive the display rows:
   - actual booking rows, each keyed by its booking `_id`;
   - `packageSize - activeBookingCount` temporary empty rows.

The empty rows are presentation-only and have no booking ID or durable identity.

### UI behavior

- Keep the existing visual presentation of a full package of session rows.
- Replace “2 of 8 sessions scheduled” with “You have 6 sessions left to schedule.”
- Show active bookings in ascending date/time order, followed by empty scheduling rows.
- After create, reschedule, or unschedule, refetch/recompute the rows from bookings. The UI then naturally rearranges by date and preserves correct booking IDs.
- A cancelled session disappears and creates one new empty row.

## Create a session

1. Customer chooses date and time from an empty UI row.
2. Backend resolves the package from the secure token.
3. Validate package state, availability, lead time, expiry, and remaining capacity.
4. Create the Google Calendar event.
5. In the final database mutation, re-resolve/revalidate the package and capacity, then insert a `confirmed` booking with `multiBookingPackageId`.
6. Return the new booking `_id`.

### Calendar/capacity race handling

Two requests can both observe one remaining session before either inserts its booking. Both could create a Calendar event, but only the first may save the final booking.

Therefore:

- the final database mutation must recheck capacity transactionally;
- if it rejects or otherwise fails after Calendar creation, delete the newly created Calendar event as compensation;
- return the failure only after the cleanup attempt, logging any cleanup failure for follow-up.

This prevents orphan Calendar events without corresponding bookings.

## Reschedule a session

1. UI sends `bookingId`, date, and time.
2. Backend resolves package from token.
3. Load booking and verify it belongs to that package.
4. Verify it is capacity-consuming and not cancelled.
5. Enforce locking, availability, lead-time, expiry, and Calendar rules.
6. Update that booking and its existing Calendar event.
7. Refetch/recompute the date-ordered UI.

A cancelled booking is not reactivated by reschedule. Scheduling after cancellation creates a new booking, preserving cancellation history.

## Unschedule a session

1. UI sends `bookingId`.
2. Backend resolves package from token and verifies booking ownership.
3. Verify the booking is currently capacity-consuming and allowed to be changed by locking rules.
4. Delete its Google Calendar event.
5. Patch booking status to `cancelled` and clear Calendar/reminder state as appropriate.
6. Refetch/recompute the UI.

The row then disappears from the customer page and capacity becomes available. The booking remains available to admins as cancellation history.

## Admin behavior

- Keep cancelled booking rows for audit/history and existing cancelled filtering.
- Package association stays on `multiBookingPackageId`.
- Keep an admin progress label such as `2/8`, but derive it dynamically:
  1. select capacity-consuming package bookings;
  2. sort by `sessionStartAt` ascending;
  3. use the booking’s current one-based date-order position and the package size.

This is an informational position, not a stable slot number. Rescheduling can change it.

## Remove and replace

Remove slot-oriented concepts:

- `sessions` on packages;
- `multiBookingSlotNumber`;
- package-slot index;
- `slotNumber` arguments/types;
- `getEditablePackageSlot`;
- `savePackageSlot` and `clearPackageSlot` APIs;
- slot confirmation/modal state;
- slot-based accordion logic;
- package and admin mappings that read `multiBookingPackage.sessions` or `multiBookingSlotNumber`.

Replace with booking-ID APIs and date-derived presentation:

- customer package-booking query;
- capacity helper;
- create, reschedule, and unschedule actions that use `bookingId` where applicable;
- customer UI based on real bookings plus temporary empty rows;
- dynamic admin `currentPosition/packageSize` label.

## Verification

Test at least:

1. Creating sessions fills capacity and returns booking IDs.
2. Concurrent attempts for the final capacity leave only one persisted booking and no orphan Calendar event.
3. Rescheduling changes order and correct dynamic admin progress labels.
4. Cancelling hides the booking from customer UI, retains it for admins, and restores capacity.
5. Token-based booking-ID actions reject a booking from a different package.
6. Expired, unpaid, inactive, locked, and unavailable cases are rejected.
7. Customer query remains bounded/efficient even with many historical cancelled rows.
