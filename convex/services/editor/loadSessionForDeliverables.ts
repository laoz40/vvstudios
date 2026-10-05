import type { UserIdentity } from "convex/server";
import { type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx, QueryCtx } from "#convex/_generated/server";
import { requirePermission } from "#convex/services/auth";
import { requirePermissionActions } from "#convex/services/requirePermissionActions";
import {
	detectDeliverablesCustomerType,
	type DeliverablesCustomerType,
	requireDeliverablesEligibility,
	requireDeliverablesOwnership
} from "#convex/lib/editor/editorSessions";
import { getSessionFromDb, getSessionFromQuery } from "#convex/services/sessions/sessionLookup";

export type LoadSessionForDeliverablesError =
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "SESSION_NOT_ASSIGNED_TO_EDITOR" }
	| { reason: "SESSION_NOT_CONFIRMED" }
	| { reason: "SESSION_NOT_IN_PAST" };

function attachIdentityToSession(identity: UserIdentity) {
	return (session: Doc<"bookings">) => ({ identity, session });
}

function withDeliverablesAccess(
	identity: UserIdentity,
	session: ResultAsync<Doc<"bookings">, { reason: "BOOKING_NOT_FOUND" }>
): ResultAsync<Doc<"bookings">, LoadSessionForDeliverablesError> {
	return session
		.map(attachIdentityToSession(identity))
		.andThen(requireDeliverablesOwnership)
		.andThen(requireDeliverablesEligibility);
}

function loadDeliverablesSessionWithIdentity(
	ctx: QueryCtx,
	identity: UserIdentity,
	bookingId: Id<"bookings">
) {
	return withDeliverablesAccess(identity, getSessionFromDb(ctx, bookingId));
}

function loadDeliverablesSessionForIdentity(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return (identity: UserIdentity) => loadDeliverablesSessionWithIdentity(ctx, identity, bookingId);
}

export function loadSessionForDeliverables(
	ctx: QueryCtx,
	bookingId: Id<"bookings">
): ResultAsync<Doc<"bookings">, LoadSessionForDeliverablesError> {
	return requirePermission(ctx, "send:deliverables-email").andThen(
		loadDeliverablesSessionForIdentity(ctx, bookingId)
	);
}

function detectDeliverablesCustomerTypeForSession(ctx: QueryCtx) {
	return (session: Doc<"bookings">) => detectDeliverablesCustomerType(ctx, session);
}

export function loadDeliverablesCustomerTypeForBooking(
	ctx: QueryCtx,
	bookingId: Id<"bookings">
): ResultAsync<DeliverablesCustomerType, LoadSessionForDeliverablesError> {
	return loadSessionForDeliverables(ctx, bookingId).andThen(
		detectDeliverablesCustomerTypeForSession(ctx)
	);
}

function loadDeliverablesSessionWithIdentityFromAction(
	ctx: ActionCtx,
	identity: UserIdentity,
	bookingId: Id<"bookings">
) {
	return withDeliverablesAccess(identity, getSessionFromQuery(ctx, bookingId));
}

function loadDeliverablesSessionForIdentityFromAction(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return (identity: UserIdentity) =>
		loadDeliverablesSessionWithIdentityFromAction(ctx, identity, bookingId);
}

export function loadSessionForDeliverablesFromAction(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<Doc<"bookings">, LoadSessionForDeliverablesError> {
	return requirePermissionActions(ctx, "send:deliverables-email").andThen(
		loadDeliverablesSessionForIdentityFromAction(ctx, bookingId)
	);
}
