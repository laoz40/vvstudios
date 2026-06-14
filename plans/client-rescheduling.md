# Client Rescheduling Plan

## Goal

Add client self-service rescheduling from a private link in the booking invoice email.

Flow:

1. Invoice email includes a secure reschedule link.
2. Client opens `/reschedule/$token`.
3. Page shows current booking summary, date picker, and time picker.
4. Client chooses a new date/time.
5. App enforces normal availability rules.
6. App updates Google Calendar + Convex booking.
7. Used link expires.
8. Updated invoice email is sent with a fresh link.

## Rules

- Link is a long random token, like a password reset link. Do not use predictable IDs.
- Store only `tokenHash` in Convex, not the raw token.
- Hashing = one-way fingerprint. Server hashes incoming token and compares it to DB hash.
- Anyone with the raw link can reschedule until it is used or expired, so do not log raw tokens.
- Link is valid only when:
  - link exists,
  - status is `active`,
  - now is before link `expiresAt`,
  - now is before booking `sessionStartAt`.
- Clients can reschedule multiple times, but only with the newest active link.
- When creating a new active link, mark old active links for that booking as `used`.
- Client can only change `date` and `time`.
- Keep duration, service, addons, customer details, and pricing locked.
- Client availability must ignore the booking's current Google Calendar event so it does not block itself.
- Admin and client rescheduling should share the same Google Calendar update logic.
- Difference: admin can bypass availability; client must enforce normal availability.
- If Google Calendar update fails, do not patch Convex.
- If invoice email fails after Google Calendar + Convex succeed, do not roll back. Log/show warning so admin can resend invoice.

## Existing Code To Reuse

- `convex/googleCalendar.ts`
- `convex/bookings.ts`
- `convex/lib/bookingAdminEdit.ts`
- `convex/lib/bookingCalendarTime.ts`
- `convex/lib/googleCalendarAvailability.ts`
- `convex/lib/googleCalendarEvents.ts`
- `convex/lib/email.ts`
- `src/sites/studio/features/booking-form/components/BookingDateTimeSection.tsx`
- `src/sites/studio/features/booking-invoice/email/BookingInvoiceEmail.tsx`

Useful existing logic:

- `getBookingSessionStartAt`
- `validateBookingTimingEdit`
- `updateBookingFromAdminWithGoogleCalendar`

## Implementation Steps

### Step 1: Schema

Add `bookingRescheduleLinks` to `convex/schema.ts`:

```ts
bookingRescheduleLinks: defineTable({
	bookingId: v.id("bookings"),
	tokenHash: v.string(),
	status: v.union(v.literal("active"), v.literal("used"), v.literal("expired")),
	expiresAt: v.number(),
	usedAt: v.optional(v.number()),
	createdAt: v.number()
})
	.index("by_tokenHash", ["tokenHash"])
	.index("by_bookingId_and_status", ["bookingId", "status"]);
```

Check after step:

- Schema is valid.
- No generated Convex files are manually edited.

### Step 2: Link Helpers

Create `convex/lib/bookingRescheduleLinks.ts` for pure helpers only:

- `generateRescheduleToken()` - strong random bytes.
- `hashRescheduleToken(token)`.
- `buildRescheduleUrl(token)`.
- `isRescheduleLinkExpired(link, booking, now)`.

Create `convex/bookingRescheduleLinks.ts` for Convex internal mutations that do DB writes:

- create a new active link for a booking,
- mark old active links for that booking as `used`,
- mark a used link as `used` with `usedAt`.

Expected lookup failures should return tuple `Result`, for example missing booking or missing link. Unexpected DB/runtime failures may throw so Convex rolls back the mutation.

Check after step:

- Raw token is returned only when newly created.
- DB stores only `tokenHash`.
- Creating a new link invalidates old active links for that booking.

### Step 3: Invoice Email URL Plumbing

Update invoice data shape to accept:

```ts
rescheduleUrl?: string
```

Update `BookingInvoiceEmail.tsx` to render a “Reschedule booking” button when `rescheduleUrl` exists.

Important:

- React email rendering should stay pure.
- Do not create DB tokens inside React email/artifact rendering.
- Convex/server code creates the link first, then passes finished `rescheduleUrl` into invoice artifact generation.

Check after step:

- Email renders with button when URL exists.
- Email still renders without button when URL is missing.

### Step 4: Invoice Sending Creates Fresh Link

Update booking invoice sending flow in Convex/server code.

Before rendering/sending the customer invoice email:

1. Create fresh reschedule link for booking.
2. Build URL.
3. Pass `rescheduleUrl` into invoice data/artifacts.

Check after step:

- Sending invoice creates one active link.
- Re-sending invoice marks old active links used and creates a new active link.
- Updated invoice contains new URL.

### Step 5: Public Link Lookup

Add `convex/bookingRescheduling.ts`.

Public function:

```ts
getRescheduleBookingByToken({ token });
```

Use Result tuple.

Return only safe data:

```ts
{
  booking: {
    date: string,
    time: string,
    duration: string,
    service: string,
    addons: string[],
    name: string
  },
  expiresAt: number
}
```

Do not return email, phone, ABN, Stripe IDs, Google IDs, or bookingId.

Use a helper named clearly, for example:

```ts
getValidRescheduleLinkAndBooking(ctx, token, now);
```

Expected errors:

- `RESCHEDULE_LINK_NOT_FOUND`
- `RESCHEDULE_LINK_USED`
- `RESCHEDULE_LINK_EXPIRED`
- `BOOKING_NOT_FOUND`
- `BOOKING_NOT_RESCHEDULABLE`

Check after step:

- Valid token returns safe booking summary.
- Invalid/used/expired token returns typed error.
- No private booking fields are exposed.

### Step 6: Reschedule Availability

Add public action:

```ts
getAvailableRescheduleTimes({ token, date });
```

Backend loads booking from token and uses booking duration/current Google event.

Return:

```ts
ok({ timeZone, times });
```

Rules:

- Client must follow normal availability settings.
- Ignore current Google event during busy-window check.
- Do not expose Google event IDs.

Check after step:

- Current booking slot does not block itself.
- Other busy events still block times.
- Invalid token cannot fetch times.

### Step 7: Shared Google Calendar Timing Update

Refactor admin edit logic if needed so both admin and client can call shared timing update code.

Shared helper should handle:

- patch existing Google Calendar event,
- create replacement if event is deleted/cancelled,
- return replacement `googleEventId`/`googleCalendarId` when needed.

Admin path:

- can bypass availability.

Client path:

- must validate availability before calling update.

Check after step:

- Existing admin edit still works.
- Client code can reuse same calendar update path.
- No duplicate calendar patch logic is added.

### Step 8: Internal Save Mutation

Add internal mutation:

```ts
saveClientBookingRescheduleInternal;
```

Args:

```ts
{
  bookingId: v.id("bookings"),
  date: v.string(),
  time: v.string(),
  sessionStartAt: v.number(),
  googleCalendarId: v.optional(v.string()),
  googleEventId: v.optional(v.string())
}
```

Patch only:

- `date`
- `time`
- `sessionStartAt`
- `googleCalendarId` if provided
- `googleEventId` if provided
- clear reminder fields:
  - `reminderEmailClaimedAt`
  - `reminderEmailSentAt`
  - `reminderEmailFailureCode`

Check after step:

- Does not change customer fields, service, addons, duration, or pricing.
- Reminder fields clear when date/time changes.

### Step 9: Submit Reschedule Action

Add public action:

```ts
rescheduleBooking({ token, date, time });
```

Keep action as orchestrator. Use helpers:

1. `getValidRescheduleLinkAndBooking(ctx, token, now)`.
2. `buildClientRescheduleTiming(booking, date, time)`.
3. `validateClientRescheduleAvailability(...)`.
4. shared Google Calendar timing update helper.
5. `saveClientBookingRescheduleInternal(...)`.
6. mark link `used`.
7. send updated invoice with fresh link.
8. return success, with warning if invoice send failed.

Expected errors:

- `RESCHEDULE_LINK_NOT_FOUND`
- `RESCHEDULE_LINK_USED`
- `RESCHEDULE_LINK_EXPIRED`
- `BOOKING_NOT_FOUND`
- `BOOKING_NOT_RESCHEDULABLE`
- `BOOKING_INVALID_DATE`
- `BOOKING_INVALID_TIME`
- `BOOKING_TIME_UNAVAILABLE`
- `GOOGLE_CALENDAR_AUTH_FAILED`
- `GOOGLE_CALENDAR_AVAILABILITY_FAILED`
- `GOOGLE_CALENDAR_RATE_LIMITED`
- `GOOGLE_CALENDAR_UPDATE_FAILED`

Check after step:

- Google failure leaves Convex unchanged.
- Successful submit updates Google Calendar and Convex.
- Used link cannot be reused.
- New invoice/link is generated.
- Invoice failure does not roll back successful reschedule.

### Step 10: Public Reschedule Page

Add route:

```txt
src/routes/_public/reschedule.$token.tsx
```

UI:

- current booking summary at top,
- date picker,
- time picker,
- submit button.

Reuse/extract from `BookingDateTimeSection` where practical. Avoid duplicating date/time behaviour.

States:

- loading,
- invalid/used/expired,
- booking not reschedulable,
- valid form,
- submitting,
- success,
- submit error/warning.

Copy:

- Success: `Your booking has been rescheduled. We’ve emailed you an updated invoice.`
- Invalid/expired: `This reschedule link is no longer valid. Please contact if you need help changing your booking.`

Check after step:

- Valid link loads page.
- Invalid/used/expired links show correct state.
- Date/time UI works with reschedule availability action.
- Submit success shows success state.

### Step 11: Final Checks

Manual tests:

- Valid link opens page.
- Invalid token fails safely.
- Used token fails safely.
- Expired booking fails safely.
- Current booking time does not block itself.
- Other events block times.
- Successful reschedule updates Convex date/time/sessionStartAt.
- Successful reschedule updates Google Calendar.
- Reminder fields clear.
- Old link is used.
- New invoice has new link.
- New link works.
- Google failure does not patch Convex.
- Invoice failure does not roll back reschedule.

Then run format and lint.

Do not run build or Convex codegen.
