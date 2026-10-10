"use node";

import { api } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";
import type { SessionReservation } from "#convex/sessions/lib/reservations";
import type { SessionAvailabilitySettings } from "#convex/sessions/lib/calendarTime";

export { runReserveSessionReservation as reserveClaimedBookingSession } from "#convex/sessions/lib/slotReservationAction";

export function loadBookingAvailabilitySettings(
	ctx: ActionCtx
): ReturnType<typeof okOrThrow<SessionAvailabilitySettings>> {
	return okOrThrow(ctx.runQuery(api.booking.settings.get, {}));
}

export type ReserveClaimedBookingSessionResult =
	| { outcome: "reserved"; reservation: SessionReservation }
	| { outcome: "unavailable" };
