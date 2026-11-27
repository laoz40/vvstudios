"use node";

import type { SessionReservation } from "#convex/sessions/lib/reservations";

export { reserveSessionReservation as reserveClaimedBookingSession } from "#convex/sessions/lib/slotReservationAction";

export type ReserveClaimedBookingSessionResult =
	| { outcome: "reserved"; reservation: SessionReservation }
	| { outcome: "unavailable" };
