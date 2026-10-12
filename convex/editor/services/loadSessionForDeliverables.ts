import type { UserIdentity } from "convex/server";
import { ok, safeTry, type ResultAsync } from "neverthrow";
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
	return safeTry(async function* () {
		const bookingRow = yield* session;
		const access = yield* requireDeliverablesOwnership({ identity, session: bookingRow });
		const eligibleSession = yield* requireDeliverablesEligibility(access);

		return ok(eligibleSession);
	});
}

export function loadSessionForDeliverables(
	ctx: QueryCtx,
	bookingId: Id<"bookings">
): ResultAsync<Doc<"bookings">, LoadSessionForDeliverablesError> {
	return safeTry(async function* () {
		const identity = yield* requirePermission(ctx, "send:deliverables-email");
		const session = yield* withDeliverablesAccess(identity, getSessionFromDb(ctx, bookingId));

		return ok(session);
	});
}

export function loadDeliverablesCustomerTypeForBooking(
	ctx: QueryCtx,
	bookingId: Id<"bookings">
): ResultAsync<DeliverablesCustomerType, LoadSessionForDeliverablesError> {
	return safeTry(async function* () {
		const session = yield* loadSessionForDeliverables(ctx, bookingId);

		const customerType: DeliverablesCustomerType = yield* detectDeliverablesCustomerType(
			ctx,
			session
		);

		return ok(customerType);
	});
}

export function loadSessionForDeliverablesFromAction(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<Doc<"bookings">, LoadSessionForDeliverablesError> {
	return safeTry(async function* () {
		const identity = yield* requirePermissionActions(ctx, "send:deliverables-email");
		const session = yield* withDeliverablesAccess(identity, getSessionFromQuery(ctx, bookingId));

		return ok(session);
	});
}
