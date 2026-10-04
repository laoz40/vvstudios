import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { BOOKING_INVOICE_BUSINESS } from "#studio/features/booking-invoice/lib/constants";
import type { BookingAddonQuantitiesArgs } from "#convex/lib/booking/bookingAddonQuantities";
import {
	pickBookingAddonQuantities,
	type BookingAddon
} from "#studio/features/booking-form/lib/booking-form-model";
import { formatEditingAddonList } from "#studio/features/booking-form/lib/editing-addon-quantities";
import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import { calendarResultAsync } from "#convex/lib/googleCalendar/googleCalendarErrors";
import type { Id } from "#convex/_generated/dataModel";
import { tryPromise } from "#convex/lib/result";

import {
	buildEventWindow,
	formatCalendarEventDate,
	formatCalendarEventTime
} from "#convex/lib/sessions/sessionCalendarTime";
import {
	calendarErrorSchema,
	isCalendarEventNotFound,
	mapCalendarErrorCode
} from "#convex/lib/googleCalendar/googleCalendarErrors";

export type SessionCalendarEventDetails = {
	addons: BookingAddon[];
	duration: string;
	email: string;
	name: string;
	service: string;
} & BookingAddonQuantitiesArgs;

export type SessionCalendarEventRecord = {
	date: string;
	duration: string;
	email: string;
	googleCalendarId?: string;
	googleEventId?: string;
	name: string;
	time: string;
};

interface BuildSessionCalendarEventPayloadArgs {
	date: string;
	details: SessionCalendarEventDetails;
	time: string;
	timeZone: string;
}

export function buildSessionCalendarEventPayload({
	date,
	details,
	time,
	timeZone
}: BuildSessionCalendarEventPayloadArgs) {
	return buildEventWindow(date, time, details.duration, timeZone).map(
		({ startDateTime, endDateTime }) => {
			const bookingDate = formatCalendarEventDate(startDateTime, timeZone);
			const bookingTime = formatCalendarEventTime(startDateTime, timeZone);

			const addonsLine =
				details.addons.length > 0
					? formatEditingAddonList(details.addons, pickBookingAddonQuantities(details))
					: "None";

			const signoffName =
				BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;

			const payload = {
				summary: `Studio Hire | ${details.name} | ${details.duration}`,
				description: [
					`Hello, ${details.name}!`,
					"",
					"Your studio hire session has been confirmed!",
					"",
					`Recording Space: ${details.service}`,
					`Add-ons: ${addonsLine}`,
					`Session Duration: ${details.duration}`,
					"",
					`Date: ${bookingDate}`,
					`Time: ${bookingTime}`,
					`Timezone: ${timeZone}`,
					"",
					"Thanks,",
					signoffName,
					BOOKING_INVOICE_BUSINESS.locationLabel
				].join("\n"),
				location: BOOKING_INVOICE_BUSINESS.locationAddress,
				start: { dateTime: startDateTime },
				end: { dateTime: endDateTime },
				transparency: "opaque",
				attendees: [{ email: details.email }]
			} satisfies calendar_v3.Schema$Event;

			return payload;
		}
	);
}

export type GoogleCalendarEventClient = {
	calendar: Pick<calendar_v3.Calendar, "events">;
	calendarId: string;
	timeZone: string;
};

function isMatchingSessionCalendarEvent(
	event: calendar_v3.Schema$Event,
	session: SessionCalendarEventRecord
) {
	const attendeeMatches =
		event.attendees?.some((attendee) => attendee.email === session.email) ?? false;

	// This is used when the saved Google event id cannot be used, mainly to find
	// hidden Calendar events for invites the attendee has declined.
	// Calendar summaries are created as: "Studio Hire | {name} | {duration}".
	// Match the exact name segment so we do not delete a different event in the same time window.
	const summaryParts = event.summary?.split("|").map((part) => part.trim()) ?? [];
	const summaryName = summaryParts.length === 3 ? summaryParts[1] : null;
	const summaryMatches = summaryName === session.name;

	return attendeeMatches || summaryMatches;
}

export type OrphanedSessionCalendarEventCleanupError = {
	reason:
		| "GOOGLE_CALENDAR_DELETE_FAILED"
		| "GOOGLE_CALENDAR_AUTH_FAILED"
		| "GOOGLE_CALENDAR_RATE_LIMITED";
};

export function removeOrphanedSessionCalendarEvent({
	bookingId,
	calendar,
	calendarId,
	googleEventId
}: {
	bookingId: Id<"bookings">;
	calendar: Pick<calendar_v3.Calendar, "events">;
	calendarId: string;
	googleEventId: string;
}): ResultAsync<void, OrphanedSessionCalendarEventCleanupError> {
	return tryPromise({
		try: () => calendar.events.delete({ calendarId, eventId: googleEventId, sendUpdates: "all" }),
		catch: (error) => {
			console.error("Orphaned session Calendar event cleanup failed", {
				bookingId,
				googleEventId,
				error
			});

			const parsedError = calendarErrorSchema.safeParse(error);

			return {
				reason: parsedError.success
					? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_DELETE_FAILED")
					: "GOOGLE_CALENDAR_DELETE_FAILED"
			};
		}
	}).map(() => undefined);
}

async function deleteCalendarEventIfFound(
	calendar: Pick<calendar_v3.Calendar, "events">,
	calendarId: string,
	eventId: string
) {
	try {
		await calendar.events.delete({ calendarId, eventId, sendUpdates: "all" });

		return true;
	} catch (error) {
		const parsedError = calendarErrorSchema.safeParse(error);

		if (parsedError.success && isCalendarEventNotFound(parsedError.data)) {
			return false;
		}

		throw error;
	}
}

type DeleteSessionCalendarEventError = {
	reason:
		| "GOOGLE_CALENDAR_DELETE_FAILED"
		| "GOOGLE_CALENDAR_AUTH_FAILED"
		| "GOOGLE_CALENDAR_RATE_LIMITED";
};

function deleteCalendarEventIfFoundAsync(
	calendar: Pick<calendar_v3.Calendar, "events">,
	calendarId: string,
	eventId: string
): ResultAsync<boolean, DeleteSessionCalendarEventError> {
	return tryPromise({
		try: () => deleteCalendarEventIfFound(calendar, calendarId, eventId),
		catch: (cause) => {
			const parsedError = calendarErrorSchema.safeParse(cause);

			if (parsedError.success && isCalendarEventNotFound(parsedError.data)) {
				return { reason: "GOOGLE_CALENDAR_DELETE_FAILED" as const };
			}

			return {
				reason: parsedError.success
					? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_DELETE_FAILED")
					: ("GOOGLE_CALENDAR_DELETE_FAILED" as const)
			};
		}
	});
}

function findSessionCalendarEventIncludingDeclinedAsync({
	session,
	calendar,
	calendarId,
	timeZone
}: {
	session: SessionCalendarEventRecord;
	calendar: Pick<calendar_v3.Calendar, "events">;
	calendarId: string;
	timeZone: string;
}): ResultAsync<calendar_v3.Schema$Event | null, DeleteSessionCalendarEventError> {
	const eventWindowResult = buildEventWindow(
		session.date,
		session.time,
		session.duration,
		timeZone
	);

	if (eventWindowResult.isErr()) {
		return errAsync({ reason: "GOOGLE_CALENDAR_DELETE_FAILED" as const });
	}

	const { startDateTime, endDateTime } = eventWindowResult.value;

	return calendarResultAsync(
		calendar.events
			.list({
				calendarId,
				singleEvents: true,
				showDeleted: false,
				showHiddenInvitations: true,
				timeMax: endDateTime,
				timeMin: startDateTime
			})
			.then(
				(events) =>
					events.data.items?.find((event) => isMatchingSessionCalendarEvent(event, session)) ?? null
			),
		"GOOGLE_CALENDAR_DELETE_FAILED"
	);
}

function deleteSessionCalendarEventAfterLookup({
	session,
	client,
	calendarId
}: {
	session: SessionCalendarEventRecord;
	client: GoogleCalendarEventClient;
	calendarId: string;
}): ResultAsync<{ calendarEventDeleted: boolean }, DeleteSessionCalendarEventError> {
	return findSessionCalendarEventIncludingDeclinedAsync({
		session,
		calendar: client.calendar,
		calendarId,
		timeZone: client.timeZone
	}).andThen((foundEvent) => {
		const foundEventId = foundEvent?.id ?? null;

		if (!foundEventId) {
			return okAsync({ calendarEventDeleted: false });
		}

		return deleteCalendarEventIfFoundAsync(client.calendar, calendarId, foundEventId).map(
			(wasFoundEventDeleted) => ({ calendarEventDeleted: wasFoundEventDeleted })
		);
	});
}

export function deleteSessionCalendarEvent({
	session,
	client
}: {
	session: SessionCalendarEventRecord;
	client: GoogleCalendarEventClient;
}): ResultAsync<{ calendarEventDeleted: boolean }, DeleteSessionCalendarEventError> {
	const calendarId = session.googleCalendarId ?? client.calendarId;
	const savedEventId = session.googleEventId ?? null;

	if (!savedEventId) {
		return deleteSessionCalendarEventAfterLookup({ session, client, calendarId });
	}

	return deleteCalendarEventIfFoundAsync(client.calendar, calendarId, savedEventId).andThen(
		(wasDeleted) =>
			wasDeleted
				? okAsync({ calendarEventDeleted: true })
				: deleteSessionCalendarEventAfterLookup({ session, client, calendarId })
	);
}

export type SessionCalendarTimingUpdateError = {
	reason:
		| "GOOGLE_CALENDAR_AUTH_FAILED"
		| "GOOGLE_CALENDAR_CREATE_FAILED"
		| "GOOGLE_CALENDAR_RATE_LIMITED"
		| "GOOGLE_CALENDAR_UPDATE_FAILED";
};

export type SessionCalendarTimingUpdateResult = {
	googleCalendarId?: string;
	googleEventId?: string;
	outcome?: "replacementCreated";
};

type SessionCalendarEventMissing = { kind: "missing" };

type SessionCalendarEventLookupCatch =
	| SessionCalendarEventMissing
	| SessionCalendarTimingUpdateError;

function isMissingSessionCalendarEvent(
	value: SessionCalendarEventLookupCatch
): value is SessionCalendarEventMissing {
	return "kind" in value;
}

function sessionCalendarTimingUpdateErrorFromCause(
	cause: unknown
): SessionCalendarTimingUpdateError {
	const parsedError = calendarErrorSchema.safeParse(cause);

	return {
		reason: parsedError.success
			? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_UPDATE_FAILED")
			: "GOOGLE_CALENDAR_UPDATE_FAILED"
	};
}

function patchExistingSessionCalendarEvent({
	client,
	date,
	details,
	googleCalendarId,
	googleEventId,
	time
}: {
	client: GoogleCalendarEventClient;
	date: string;
	details: SessionCalendarEventDetails;
	googleCalendarId: string;
	googleEventId: string;
	time: string;
}): ResultAsync<SessionCalendarTimingUpdateResult, SessionCalendarTimingUpdateError> {
	const payloadResult = buildSessionCalendarEventPayload({
		date,
		details,
		time,
		timeZone: client.timeZone
	});

	if (payloadResult.isErr()) {
		return errAsync({ reason: "GOOGLE_CALENDAR_UPDATE_FAILED" as const });
	}

	return tryPromise({
		try: () =>
			client.calendar.events.patch({
				calendarId: googleCalendarId,
				eventId: googleEventId,
				sendUpdates: "all",
				requestBody: payloadResult.value
			}),
		catch: (cause): SessionCalendarEventLookupCatch => {
			const parsedError = calendarErrorSchema.safeParse(cause);

			if (parsedError.success && isCalendarEventNotFound(parsedError.data)) {
				return { kind: "missing" };
			}

			return sessionCalendarTimingUpdateErrorFromCause(cause);
		}
	})
		.map(() => ({} satisfies SessionCalendarTimingUpdateResult))
		.orElse(
			(
				patchError
			): ResultAsync<SessionCalendarTimingUpdateResult, SessionCalendarTimingUpdateError> =>
				isMissingSessionCalendarEvent(patchError)
					? createSessionCalendarEvent({ client, date, details, time })
					: errAsync(patchError)
		);
}

export function updateSessionCalendarEventTiming({
	session,
	client,
	date,
	details,
	time,
	createMissingEvent = false
}: {
	session: SessionCalendarEventRecord;
	client: GoogleCalendarEventClient;
	date: string;
	details: SessionCalendarEventDetails;
	time: string;
	createMissingEvent?: boolean;
}): ResultAsync<SessionCalendarTimingUpdateResult, SessionCalendarTimingUpdateError> {
	// Some reschedulable failed bookings never created a Google event in the original flow.
	// When requested, create that missing event before saving the new session time.
	if (!session.googleEventId || !session.googleCalendarId) {
		if (createMissingEvent) {
			return createSessionCalendarEvent({ client, date, details, time });
		}

		return okAsync({});
	}

	const googleCalendarId = session.googleCalendarId;
	const googleEventId = session.googleEventId;

	return tryPromise({
		try: () =>
			client.calendar.events.get({
				calendarId: googleCalendarId,
				eventId: googleEventId
			}),
		catch: (cause): SessionCalendarEventLookupCatch => {
			const parsedError = calendarErrorSchema.safeParse(cause);

			if (parsedError.success && isCalendarEventNotFound(parsedError.data)) {
				return { kind: "missing" };
			}

			return sessionCalendarTimingUpdateErrorFromCause(cause);
		}
	})
		.andThen((existingGoogleEvent) =>
			existingGoogleEvent.data.status === "cancelled"
				? createSessionCalendarEvent({ client, date, details, time })
				: patchExistingSessionCalendarEvent({
						client,
						date,
						details,
						googleCalendarId,
						googleEventId,
						time
					})
		)
		.orElse(
			(
				lookupError
			): ResultAsync<SessionCalendarTimingUpdateResult, SessionCalendarTimingUpdateError> =>
				isMissingSessionCalendarEvent(lookupError)
					? createSessionCalendarEvent({ client, date, details, time })
					: errAsync(lookupError)
		);
}

export function createSessionCalendarEvent({
	client,
	date,
	details,
	time
}: {
	client: GoogleCalendarEventClient;
	date: string;
	details: SessionCalendarEventDetails;
	time: string;
}): ResultAsync<SessionCalendarTimingUpdateResult, SessionCalendarTimingUpdateError> {
	const payloadResult = buildSessionCalendarEventPayload({
		date,
		details,
		time,
		timeZone: client.timeZone
	});

	if (payloadResult.isErr()) {
		return errAsync({ reason: "GOOGLE_CALENDAR_CREATE_FAILED" as const });
	}

	return calendarResultAsync(
		client.calendar.events.insert({
			calendarId: client.calendarId,
			sendUpdates: "all",
			requestBody: payloadResult.value
		}),
		"GOOGLE_CALENDAR_CREATE_FAILED"
	).map((replacementEvent) => ({
		googleCalendarId: client.calendarId,
		googleEventId: replacementEvent.data.id ?? undefined,
		outcome: "replacementCreated" as const
	}));
}
