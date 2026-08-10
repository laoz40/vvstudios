import type { UserIdentity } from "convex/server";
import { err, ok } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import { isAdminIdentity } from "#convex/lib/auth";

export type DeliverablesSessionAccess = { identity: UserIdentity; session: Doc<"bookings"> };

export function isEditorVisibleSession(session: Doc<"bookings">): boolean {
	const hasEligibleStatus = session.status === "confirmed" || session.status === "email_failed";
	return hasEligibleStatus && session.hiddenAt === undefined;
}

export function requireDeliverablesOwnership(access: DeliverablesSessionAccess) {
	if (
		!isAdminIdentity(access.identity) &&
		access.session.assignedEditorTokenIdentifier !== access.identity.tokenIdentifier
	) {
		return err({ reason: "SESSION_NOT_ASSIGNED_TO_EDITOR" as const });
	}

	return ok(access);
}

export function requireDeliverablesEligibility(access: DeliverablesSessionAccess) {
	const { session } = access;
	if (session.status !== "confirmed" && session.status !== "email_failed") {
		return err({ reason: "SESSION_NOT_CONFIRMED" as const });
	}

	if (session.hiddenAt !== undefined) {
		return err({ reason: "SESSION_ARCHIVED" as const });
	}

	if (session.sessionStartAt >= Date.now()) {
		return err({ reason: "SESSION_NOT_IN_PAST" as const });
	}

	return ok(session);
}

export function buildEditorSessionProjection(session: Doc<"bookings">) {
	return {
		_id: session._id,
		name: session.name,
		accountName: session.accountName,
		notes: session.notes,
		date: session.date,
		time: session.time,
		duration: session.duration,
		service: session.service,
		addons: session.addons,
		essentialEditQuantity: session.essentialEditQuantity,
		clipsPackageQuantity: session.clipsPackageQuantity,
		editStatus: session.editStatus
	};
}
