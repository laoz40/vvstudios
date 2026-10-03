import type { Id } from "#convex/_generated/dataModel";
import type { AdminSessionUpdateArgs } from "#convex/lib/sessions/sessionAdminEdit";
import type { SessionReservation } from "#convex/lib/sessions/sessionReservations";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";

export type SaveAdminSessionUpdateArgs = AdminSessionUpdateArgs & {
	googleCalendarId?: string;
	googleEventId?: string;
	confirmBooking?: boolean;
	reservation?: SessionReservation;
};

export type SaveClientSessionRescheduleArgs = {
	bookingId: Id<"bookings">;
	date: string;
	time: string;
	service?: string;
	addons?: BookingAddon[];
	notes?: string;
	sessionStartAt: number;
	confirmBooking?: boolean;
	googleCalendarId?: string;
	googleEventId?: string;
	packageId?: Id<"packages">;
	reservation: SessionReservation;
};
