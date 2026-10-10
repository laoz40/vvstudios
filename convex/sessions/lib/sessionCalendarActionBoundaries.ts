"use node";

import type { ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/shared/lib/result";
import type {
	SaveAdminSessionUpdateArgs,
	SaveClientSessionRescheduleArgs
} from "#convex/sessions/lib/sessionSchedulingArgs";
import type { SessionReservation } from "#convex/sessions/lib/sessionReservations";
import type { AdminSessionUpdateError } from "#convex/sessions/lib/sessionAdminEdit";
import type { LockRescheduleLinkError } from "#convex/sessions/lib/sessionRescheduleLinks";
import type { RescheduleLinkLookupError } from "#convex/sessions/lib/sessionRescheduleLinks";

type UnlockRescheduleLinkError =
	| { reason: "RESCHEDULE_LINK_NOT_FOUND" }
	| { reason: "RESCHEDULE_LINK_USED" };

export type ValidRescheduleDetails = {
	session: Doc<"bookings">;
	link: Doc<"bookingRescheduleLinks">;
};

export function loadValidRescheduleLinkAndSession(
	ctx: ActionCtx,
	args: { token: string; now: number }
): ResultAsync<ValidRescheduleDetails, RescheduleLinkLookupError> {
	return fromConvexTuple(
		ctx.runQuery(internal.sessions.sessionReschedule.getValidRescheduleLinkAndSession, {
			now: args.now,
			token: args.token
		})
	);
}

export function lockRescheduleLink(
	ctx: ActionCtx,
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; now: number }
): ResultAsync<null, LockRescheduleLinkError> {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.sessionReschedule.lockRescheduleLink, {
			linkId: args.linkId,
			now: args.now
		})
	);
}

export function unlockRescheduleLink(
	ctx: ActionCtx,
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; lockedAt: number; expiresAt?: number }
): ResultAsync<null, UnlockRescheduleLinkError> {
	if (args.expiresAt === undefined) {
		return fromConvexTuple(
			ctx.runMutation(internal.sessions.sessionReschedule.unlockRescheduleLink, {
				linkId: args.linkId,
				lockedAt: args.lockedAt
			})
		);
	}

	return fromConvexTuple(
		ctx.runMutation(internal.sessions.sessionReschedule.unlockRescheduleLink, {
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
): ResultAsync<ReserveSessionSlotResult, AdminSessionUpdateError> {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.sessionScheduling.reserveSessionReservation, {
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
): ResultAsync<{ cleared: boolean } | null, AdminSessionUpdateError> {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.sessionScheduling.clearSessionReservation, {
			bookingId: args.bookingId,
			reservation: args.reservation
		})
	);
}

export function saveClientSessionReschedule(
	ctx: ActionCtx,
	saveArgs: SaveClientSessionRescheduleArgs
): ResultAsync<null, AdminSessionUpdateError> {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.sessionScheduling.saveClientSessionReschedule, saveArgs)
	);
}

export function saveAdminSessionUpdate(
	ctx: ActionCtx,
	saveArgs: SaveAdminSessionUpdateArgs
): ResultAsync<null, AdminSessionUpdateError> {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.sessionScheduling.saveAdminSessionUpdate, saveArgs)
	);
}
