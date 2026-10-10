"use node";

import { api } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";
import type { SessionReservation } from "#convex/lib/sessions/sessionReservations";
import type { SessionAvailabilitySettings } from "#convex/lib/sessions/sessionCalendarTime";

export { runReserveSessionReservation as reserveClaimedBookingSession } from "#convex/lib/sessions/sessionSlotReservationAction";

export function loadBookingAvailabilitySettings(
	ctx: ActionCtx
): ReturnType<typeof okOrThrow<SessionAvailabilitySettings>> {
	return okOrThrow(ctx.runQuery(api.booking.settings.get, {}));
}

export type ReserveClaimedBookingSessionResult =
	| { outcome: "reserved"; reservation: SessionReservation }
	| { outcome: "unavailable" };
