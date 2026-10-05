"use node";

import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { okAsync } from "neverthrow";
import { okOrThrow } from "#convex/lib/result";
import { runReserveSessionReservation } from "#convex/lib/sessions/sessionSlotReservationAction";
import type { SessionReservation } from "#convex/lib/sessions/sessionReservations";
import type { SessionAvailabilitySettings } from "#convex/lib/sessions/sessionCalendarTime";

export function loadBookingAvailabilitySettings(
	ctx: ActionCtx
): ReturnType<typeof okOrThrow<SessionAvailabilitySettings>> {
	return okOrThrow(ctx.runQuery(api.bookingSettings.get, {}));
}

export type ReserveClaimedBookingSessionResult =
	| { outcome: "reserved"; reservation: SessionReservation }
	| { outcome: "unavailable" };

export function reserveClaimedBookingSession(
	ctx: ActionCtx,
	args: {
		bookingId: Id<"bookings">;
		duration: string;
		eventBufferMinutes: number;
		sessionStartAt: number;
	}
) {
	return runReserveSessionReservation(ctx, args)
		.orElse(() => okAsync({ outcome: "unavailable" as const }))
		.andThen((reservationResult) => {
			if (reservationResult.outcome === "unavailable") {
				return okAsync({ outcome: "unavailable" as const });
			}

			return okAsync({ outcome: "reserved" as const, reservation: reservationResult.reservation });
		});
}
