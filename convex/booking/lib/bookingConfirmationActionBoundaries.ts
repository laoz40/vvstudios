"use node";

import { api } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";
import type { SessionReservation } from "#convex/sessions/lib/sessionReservations";
import type { SessionAvailabilitySettings } from "#convex/sessions/lib/sessionCalendarTime";

export { runReserveSessionReservation as reserveClaimedBookingSession } from "#convex/sessions/lib/sessionSlotReservationAction";

export function loadBookingAvailabilitySettings(
	ctx: ActionCtx
): ReturnType<typeof okOrThrow<SessionAvailabilitySettings>> {
	return okOrThrow(ctx.runQuery(api.booking.settings.get, {}));
}

export type ReserveClaimedBookingSessionResult =
	| { outcome: "reserved"; reservation: SessionReservation }
	| { outcome: "unavailable" };
