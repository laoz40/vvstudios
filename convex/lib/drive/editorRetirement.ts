import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { ResultAsync } from "neverthrow";
import { loadEditorAssetPermissionRetirementInfo } from "#convex/lib/drive/driveEditor";

export type EditorRetirementSessionRows = {
	permissionSessions: Doc<"driveSessions">[];
	failedRemovalSessions: Doc<"driveSessions">[];
	assignedBookings: Doc<"bookings">[];
};

export function getCompletedEditorBookingIds(bookings: Doc<"bookings">[]) {
	return bookings.flatMap((booking) => (booking.editStatus === "completed" ? [booking._id] : []));
}

export function mergeEditorRetirementSessions(
	retirementRows: EditorRetirementSessionRows,
	pendingSessions: (Doc<"driveSessions"> | null)[]
) {
	const { permissionSessions, failedRemovalSessions } = retirementRows;
	const sessions = new Map(permissionSessions.map((session) => [session._id, session]));

	for (const session of failedRemovalSessions) sessions.set(session._id, session);

	for (const session of pendingSessions) {
		if (session !== null) sessions.set(session._id, session);
	}

	return [...sessions.values()];
}

export function loadEditorRetirementAssetInfos(
	ctx: QueryCtx,
	permissions: Doc<"driveClientEditorPermissions">[]
) {
	return ResultAsync.combine(
		permissions.map((permission) => loadEditorAssetPermissionRetirementInfo(ctx, permission))
	);
}
