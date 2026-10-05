"use node";

import type { AdminSessionUpdateError } from "#convex/lib/sessions/sessionAdminEdit";

export type { GetAvailableRescheduleTimesError } from "#convex/services/googleCalendar/sessionCalendarAvailabilityWorkflow";

export type { RescheduleSessionError } from "#convex/services/googleCalendar/sessionRescheduleWorkflow";

export type CancelBookingFromAdminError = {
	reason:
		| "NOT_AUTHENTICATED"
		| "NOT_AUTHORIZED"
		| "BOOKING_NOT_FOUND"
		| "GOOGLE_CALENDAR_AUTH_FAILED"
		| "GOOGLE_CALENDAR_DELETE_FAILED"
		| "GOOGLE_CALENDAR_RATE_LIMITED";
};

export type UpdateSessionFromAdminError =
	| AdminSessionUpdateError
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "BOOKING_NOT_FOUND" };
