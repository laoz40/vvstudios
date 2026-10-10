import type { Id } from "#convex/_generated/dataModel";
import type { AdminSessionUpdateArgs } from "#convex/sessions/lib/adminEdit";
import type { SessionReservation } from "#convex/sessions/lib/reservations";
import type { BookingAddon } from "#/domain/booking/catalog";

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
