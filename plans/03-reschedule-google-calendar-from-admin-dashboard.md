# Reschedule Google Calendar Event from Admin Dashboard

## Goal

When an admin edits a booking from the dashboard, keep the linked Google Calendar event in sync. Date/time edits should reschedule the event, and event-represented booking details should update the event summary/description/attendees.

## Decisions

- Use Google Calendar API when admin edits a confirmed booking.
- Patch all Google event-represented fields:
  - `date`, `time`, `duration` -> event `start` / `end`
  - `name`, `duration` -> event `summary`
  - `name`, `service`, `addons`, `date`, `time`, `duration` -> event `description`
  - `email` -> event `attendees`
- Use `sendUpdates: "all"` for Google Calendar updates.
- If Google update/create fails, block the Convex save.
- Patch/create Google before saving Convex.
- If Convex save fails after Google succeeds, surface/log the error; do not add rollback/retry complexity now.
- Do not add calendar sync status/audit fields.

## Booking Status Behavior

### Confirmed bookings

Confirmed bookings should have a Google Calendar event, but edge cases are handled:

- If `googleEventId`/`googleCalendarId` exists and Google finds the event:
  - Patch the existing event.
  - Save the booking in Convex.
- If the booking has no stored Google event ID:
  - Create a new Google Calendar event.
  - Save the new `googleEventId`/`googleCalendarId` to Convex.
  - Save the booking changes.
  - Keep the edit dialog open with an acknowledgement message explaining a replacement event was created.
- If the stored Google event ID exists but Google returns not found/deleted:
  - Create a replacement Google Calendar event.
  - Relink Convex to the new event ID/calendar ID.
  - Save the booking changes.
  - Keep the edit dialog open with an acknowledgement message explaining the old event was missing and a replacement was created.

### Failed bookings

For failed bookings:

- If an admin edits the booking to a valid date/time/duration:
  - Validate availability.
  - Create a Google Calendar event.
  - Save the new `googleEventId`/`googleCalendarId` to Convex.
  - Set `status` to `confirmed`.
  - Clear the previous booking failure code.
- If the edited timing is invalid or unavailable, block the save.

### Other non-confirmed bookings

For pending, expired, and abandoned bookings:

- Save Convex only.
- Do not create or patch Google Calendar events.

## Availability Validation

Run availability validation only when timing changes:

- `date`
- `time`
- `duration`

Validation applies to all booking statuses when timing changes.

Rules:

- Validate booking settings: lead time, max days ahead, and opening hours.
- Check busy conflicts against all configured availability calendars.
- For confirmed bookings with an existing Google event, ignore that booking’s own event while checking conflicts.
- If duration changes without date/time changes, still validate because it changes the event end time.
- If only non-timing fields change, skip availability validation.
- If editing an old/past booking without timing changes, do not block the save due to past date.

## Admin Confirmation UX

Before saving, show a confirmation dialog when edits affect pricing or Google Calendar event details.

The confirmation should warn that:

- Google Calendar event details will be updated.
- Pricing/remaining balance may be recalculated when priced fields change.
- The admin must send any new invoice email manually using the existing manual invoice email option.

If no warning-relevant fields changed, save directly.

## Success UX

- Normal successful save: close edit dialog and show a success toast.
- Replacement Google event created: keep edit dialog open and show an in-dialog success/warning message with an acknowledge/close action.

## Error UX

Map known errors to user-friendly messages, including:

- Not authenticated / not authorized.
- Booking not found.
- Invalid date/time/duration.
- Outside opening hours.
- Too soon / too far ahead.
- Time unavailable due to calendar conflict.
- Google Calendar auth/update/create failure.

If Google fails, do not save Convex changes.

## Implementation Shape

- Add a new Google Calendar action for admin booking updates/reschedules.
- Keep reusable Google Calendar logic as shared helper functions in the nearest appropriate file, not as a separate internal action for now.
- The admin action should:
  1. Require admin auth.
  2. Load the existing booking.
  3. Determine changed fields.
  4. Validate availability if timing changed.
  5. For confirmed bookings, patch or create/recreate the Google Calendar event; for failed bookings edited to a valid time, create a Google Calendar event and mark the booking confirmed.
  6. Save all edited booking fields to Convex in one operation.
  7. Return outcome metadata such as whether a replacement event was created.
- Keep non-date/time/details mutations focused and avoid duplicating booking update logic where possible.

## Files Likely Involved

- `convex/googleCalendar.ts`
  - New admin action.
  - Google event patch/create helpers.
  - Missing/deleted event handling.
- `convex/bookings.ts`
  - Internal mutation to save admin booking edits and optionally update Google event IDs.
  - Existing `updateBooking` may be reused/refactored carefully.
- `convex/lib/bookingCalendarTime.ts`
  - Availability helper reuse; possibly helper for excluding own event from busy windows.
- `convex/lib/googleCalendarAvailability.ts`
  - Busy window lookup behavior, if own-event exclusion requires event IDs/details.
- `convex/lib/googleCalendarErrors.ts`
  - Add/update error code mapping for patch/not-found cases.
- `src/sites/studio/features/admin/components/BookingActions.tsx`
  - Use new action when needed.
  - Handle confirmation dialog flow.
  - Handle replacement-event acknowledgement result.
- `src/sites/studio/features/admin/components/BookingEditDialog.tsx`
  - Confirmation or acknowledgement UI may live here or in a small extracted component.
- `src/sites/studio/features/admin/lib/booking-action-errors.ts`
  - Add admin-facing error messages.

## Out of Scope

- Customer self-rescheduling UI/API.
- Automatic invoice emailing.
- Automatic custom invoice artifact creation.
- Calendar sync audit trail/status fields.
- Rollback of Google Calendar after rare Convex post-Google failure.
