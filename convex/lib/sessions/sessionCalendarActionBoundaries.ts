"use node";

import type { ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/lib/result";
import type {
	SaveAdminSessionUpdateArgs,
	SaveClientSessionRescheduleArgs
} from "#convex/lib/sessions/sessionSchedulingArgs";
import type { SessionReservation } from "#convex/lib/sessions/sessionReservations";
import type { RescheduleLinkLookupError } from "#convex/services/sessions/sessionReschedule";

export type ValidRescheduleDetails = {
	session: Doc<"bookings">;
	link: Doc<"bookingRescheduleLinks">;
};

export function loadValidRescheduleLinkAndSession(
	ctx: ActionCtx,
	args: { token: string; now: number }
): ResultAsync<ValidRescheduleDetails, RescheduleLinkLookupError> {
	return fromConvexTuple(
		ctx.runQuery(internal.sessionReschedule.getValidRescheduleLinkAndSession, {
			now: args.now,
			token: args.token
		})
	);
}

export function lockRescheduleLink(
	ctx: ActionCtx,
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; now: number }
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionReschedule.lockRescheduleLink, {
			linkId: args.linkId,
			now: args.now
		})
	);
}

export function unlockRescheduleLink(
	ctx: ActionCtx,
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; lockedAt: number; expiresAt?: number }
) {
	if (args.expiresAt === undefined) {
		return fromConvexTuple(
			ctx.runMutation(internal.sessionReschedule.unlockRescheduleLink, {
				linkId: args.linkId,
				lockedAt: args.lockedAt
			})
		);
	}

	return fromConvexTuple(
		ctx.runMutation(internal.sessionReschedule.unlockRescheduleLink, {
			linkId: args.linkId,
			lockedAt: args.lockedAt,
			expiresAt: args.expiresAt
		})
	);
}

export type ReserveSessionSlotResult =
	| { outcome: "reserved"; reservation: SessionReservation }
	| { outcome: "unavailable" };

export function reserveSessionSlot(
	ctx: ActionCtx,
	args: {
		bookingId: Id<"bookings">;
		duration: string;
		eventBufferMinutes: number;
		sessionStartAt: number;
	}
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionScheduling.reserveSessionReservation, {
			bookingId: args.bookingId,
			duration: args.duration,
			eventBufferMinutes: args.eventBufferMinutes,
			now: Date.now(),
			sessionStartAt: args.sessionStartAt
		})
	);
}

export function clearSessionSlotReservation(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; reservation: SessionReservation }
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionScheduling.clearSessionReservation, {
			bookingId: args.bookingId,
			reservation: args.reservation
		})
	);
}

export function saveClientSessionReschedule(
	ctx: ActionCtx,
	saveArgs: SaveClientSessionRescheduleArgs
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionScheduling.saveClientSessionReschedule, saveArgs)
	);
}

export function saveAdminSessionUpdate(ctx: ActionCtx, saveArgs: SaveAdminSessionUpdateArgs) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionScheduling.saveAdminSessionUpdate, saveArgs)
	);
}
