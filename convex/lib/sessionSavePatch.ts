import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";

type SessionCalendarConfirmationPatchArgs = {
	confirmBooking?: boolean;
	googleCalendarId?: string;
	googleEventId?: string;
};

export type SessionCalendarConfirmationPatch = {
	bookingConfirmedAt?: number;
	bookingFailureCode?: undefined;
	googleCalendarId?: string;
	googleEventId?: string;
	status?: "confirmed";
};

export function buildSessionCalendarConfirmationPatch(
	args: SessionCalendarConfirmationPatchArgs
): SessionCalendarConfirmationPatch {
	const patch: SessionCalendarConfirmationPatch = {};

	if (args.googleCalendarId) {
		patch.googleCalendarId = args.googleCalendarId;
	}

	if (args.googleEventId) {
		patch.googleEventId = args.googleEventId;
	}

	if (args.confirmBooking) {
		patch.status = "confirmed";
		patch.bookingConfirmedAt = Date.now();
		patch.bookingFailureCode = undefined;
	}

	return patch;
}

type ClientRescheduleFieldPatchArgs = { addons?: BookingAddon[]; notes?: string; service?: string };

type ClientRescheduleFieldPatch = { addons?: BookingAddon[]; notes?: string; service?: string };

export function buildClientRescheduleFieldPatch(
	args: ClientRescheduleFieldPatchArgs
): ClientRescheduleFieldPatch {
	const patch: ClientRescheduleFieldPatch = {};

	if (args.service !== undefined) {
		patch.service = args.service;
	}

	if (args.addons !== undefined) {
		patch.addons = args.addons;
	}

	if (args.notes !== undefined) {
		patch.notes = args.notes;
	}

	return patch;
}

type ClientSessionRescheduleOptionalPatchArgs = ClientRescheduleFieldPatchArgs &
	SessionCalendarConfirmationPatchArgs;

export function buildClientSessionRescheduleOptionalPatch(
	args: ClientSessionRescheduleOptionalPatchArgs
) {
	return {
		...buildClientRescheduleFieldPatch(args),
		...buildSessionCalendarConfirmationPatch(args)
	};
}
