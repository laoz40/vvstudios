import { okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";

export const DRIVE_EMAIL_CLAIM_TIMEOUT_MS = 15 * 60 * 1000;

export type DriveSetupInfo = {
	booking: Doc<"bookings">;
	driveClient: Doc<"driveClients"> | null;
	driveSession: Doc<"driveSessions"> | null;
	packageRecord: Doc<"packages"> | null;
	sharedPackageFolder: Doc<"driveSessions">["packageFolder"] | undefined;
};

export function resolveDriveClientForBooking(
	ctx: QueryCtx,
	driveSession: Doc<"driveSessions"> | null,
	driveClientFromBooking: Doc<"driveClients"> | null
): ResultAsync<Doc<"driveClients"> | null, never> {
	if (driveSession?.driveClientId !== undefined) {
		return okOrThrow(ctx.db.get("driveClients", driveSession.driveClientId)).map((sessionClient) =>
			sessionClient !== null ? sessionClient : driveClientFromBooking
		);
	}

	return okAsync(driveClientFromBooking);
}

export function loadPackageBookings(ctx: Pick<QueryCtx, "db">, packageId: Id<"packages">) {
	return okOrThrow(
		ctx.db
			.query("bookings")
			.withIndex("by_packageId_and_status_and_sessionStartAt", (query) =>
				query.eq("packageId", packageId)
			)
			.collect()
	);
}
