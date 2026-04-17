"use node";

import { ConvexError, v } from "convex/values";
import { google } from "googleapis";
import { internal } from "./_generated/api";
import { type Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { env } from "./env";
import { buildEventWindow } from "./lib/bookingDateTime";

type BookingCalendarErrorCode =
	| "BOOKING_INVALID_DATE"
	| "BOOKING_INVALID_DURATION"
	| "BOOKING_INVALID_TIME"
	| "BOOKING_STORE_FAILED"
	| "GOOGLE_CALENDAR_AUTH_FAILED"
	| "GOOGLE_CALENDAR_CREATE_FAILED";

type BookingCalendarErrorData = {
	code: BookingCalendarErrorCode;
};

function createBookingCalendarError(code: BookingCalendarErrorCode) {
	return new ConvexError<BookingCalendarErrorData>({ code });
}

function getGoogleCalendarErrorCode(error: unknown): BookingCalendarErrorCode {
	const isObject = (value: unknown): value is Record<string, unknown> => {
		return typeof value === "object" && value !== null;
	};

	// Unknown/non-object throw values can't be inspected, so fall back to a generic code.
	if (!isObject(error)) {
		return "GOOGLE_CALENDAR_CREATE_FAILED";
	}

	// Google auth failures sometimes surface as "invalid_grant" in the error message.
	const message = typeof error.message === "string" ? error.message : "";
	if (message.includes("invalid_grant")) {
		return "GOOGLE_CALENDAR_AUTH_FAILED";
	}

	// Google API errors may also include an HTTP response with a status code.
	const response = isObject(error.response) ? error.response : null;
	const status = typeof response?.status === "number" ? response.status : null;

	// 401/403 mean auth failed or the client lacks calendar access.
	if (status === 401 || status === 403) {
		return "GOOGLE_CALENDAR_AUTH_FAILED";
	}

	// Everything else is treated as a generic event creation failure.
	return "GOOGLE_CALENDAR_CREATE_FAILED";
}

export const createBookingWithCalendarEvent = action({
	args: {
		name: v.string(),
		email: v.string(),
		date: v.string(),
		time: v.string(),
		duration: v.string(),
		service: v.string(),
		notes: v.optional(v.string()),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		bookingId: Id<"bookings">;
		googleEventId: string | null;
		htmlLink: string | null;
	}> => {
		try {
			const clientId = env.GOOGLE_CLIENT_ID;
			const clientSecret = env.GOOGLE_CLIENT_SECRET;
			const refreshToken = env.GOOGLE_REFRESH_TOKEN;
			const calendarId = env.GOOGLE_CALENDAR_ID ?? "primary";
			const timeZone = env.GOOGLE_CALENDAR_TIMEZONE ?? "Australia/Sydney";
			const hostEmails = (env.GOOGLE_CALENDAR_HOST_EMAILS ?? "")
				.split(",")
				.map((email) => email.trim())
				.filter(Boolean);

			const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
			oauth2Client.setCredentials({ refresh_token: refreshToken });

			const calendar = google.calendar({ version: "v3", auth: oauth2Client });
			const { startDateTime, endDateTime } = buildEventWindow(args.date, args.time, args.duration);

			let googleEventId: string | undefined;
			let htmlLink: string | null = null;
			try {
				const event = await calendar.events.insert({
					calendarId,
					sendUpdates: "all",
					requestBody: {
						summary: `${args.service} - ${args.name}`,
						description: [
							`Name: ${args.name}`,
							`Email: ${args.email}`,
							`Service: ${args.service}`,
							args.notes ? `Notes: ${args.notes}` : undefined,
						]
							.filter(Boolean)
							.join("\n"),
						start: {
							dateTime: startDateTime,
							timeZone,
						},
						end: {
							dateTime: endDateTime,
							timeZone,
						},
						attendees: [{ email: args.email }, ...hostEmails.map((email) => ({ email }))],
					},
				});

				googleEventId = event.data.id ?? undefined;
				htmlLink = event.data.htmlLink ?? null;
			} catch (error) {
				console.error("Google Calendar event insert failed", {
					error,
					bookingEmail: args.email,
					calendarId,
				});
				throw createBookingCalendarError(getGoogleCalendarErrorCode(error));
			}

			try {
				const bookingId: Id<"bookings"> = await ctx.runMutation(internal.bookings.storeBooking, {
					name: args.name,
					email: args.email,
					date: args.date,
					time: args.time,
					duration: args.duration,
					service: args.service,
					notes: args.notes,
					googleEventId,
					googleCalendarId: calendarId,
				});

				return {
					bookingId,
					googleEventId: googleEventId ?? null,
					htmlLink,
				};
			} catch (error) {
				console.error("Booking storage failed after Google Calendar event creation", {
					error,
					bookingEmail: args.email,
					calendarId,
					googleEventId: googleEventId ?? null,
				});
				throw createBookingCalendarError("BOOKING_STORE_FAILED");
			}
		} catch (error) {
			if (error instanceof ConvexError) {
				throw error;
			}

			console.error("Unexpected booking calendar error", {
				error,
				bookingEmail: args.email,
			});
			throw createBookingCalendarError("GOOGLE_CALENDAR_CREATE_FAILED");
		}
	},
});
