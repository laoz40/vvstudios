import type { UserIdentity } from "convex/server";
import { type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx, QueryCtx } from "#convex/_generated/server";
import { requirePermission } from "#convex/shared/services/auth";
import { requirePermissionActions } from "#convex/shared/services/requirePermissionActions";
import {
	detectDeliverablesCustomerType,
	type DeliverablesCustomerType,
	requireDeliverablesEligibility,
	requireDeliverablesOwnership
} from "#convex/editor/lib/editorSessions";
import { getSessionFromDb, getSessionFromQuery } from "#convex/sessions/services/lookup";

export type LoadSessionForDeliverablesError =
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "SESSION_NOT_ASSIGNED_TO_EDITOR" }
	| { reason: "SESSION_NOT_CONFIRMED" }
	| { reason: "SESSION_NOT_IN_PAST" };

function withDeliverablesAccess(
	identity: UserIdentity,
	session: ResultAsync<Doc<"bookings">, { reason: "BOOKING_NOT_FOUND" }>
): ResultAsync<Doc<"bookings">, LoadSessionForDeliverablesError> {
	return session
		.map((bookingRow: Doc<"bookings">) => ({ identity, session: bookingRow }))
		.andThen(requireDeliverablesOwnership)
		.andThen(requireDeliverablesEligibility);
}

export function loadSessionForDeliverables(
	ctx: QueryCtx,
	bookingId: Id<"bookings">
): ResultAsync<Doc<"bookings">, LoadSessionForDeliverablesError> {
	return requirePermission(ctx, "send:deliverables-email").andThen((identity: UserIdentity) =>
		withDeliverablesAccess(identity, getSessionFromDb(ctx, bookingId))
	);
}

export function loadDeliverablesCustomerTypeForBooking(
	ctx: QueryCtx,
	bookingId: Id<"bookings">
): ResultAsync<DeliverablesCustomerType, LoadSessionForDeliverablesError> {
	return loadSessionForDeliverables(ctx, bookingId).andThen((session: Doc<"bookings">) =>
		detectDeliverablesCustomerType(ctx, session)
	);
}

export function loadSessionForDeliverablesFromAction(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<Doc<"bookings">, LoadSessionForDeliverablesError> {
	return requirePermissionActions(ctx, "send:deliverables-email").andThen(
		(identity: UserIdentity) =>
			withDeliverablesAccess(identity, getSessionFromQuery(ctx, bookingId))
	);
}
