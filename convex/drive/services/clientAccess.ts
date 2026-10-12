import { ok, safeTry } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	claimClientAssetsEmailFromRows,
	requireClientAssetsEmailBooking,
	requireDriveClient,
	requireDriveSession,
	saveClientAssetsEmailResultForSession,
	writeClientDrivePermission,
	writeClientDrivePermissionsStatusForSession
} from "#convex/drive/lib/driveClientAccess";
import {
	loadBookingRow,
	loadClientAssetsEmailRows,
	loadDriveClientRow,
	loadDriveSessionRowByBookingId
} from "#convex/drive/lib/driveBookingDriveClient";

export function saveClientDrivePermission(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		name: "Client folder" | "Assets";
		permission: Parameters<typeof writeClientDrivePermission>[2]["permission"];
	}
) {
	return safeTry(async function* () {
		const driveSession = yield* loadDriveSessionRowByBookingId(ctx, args.bookingId);
		const permission = yield* writeClientDrivePermissionForSession(ctx, args, driveSession);

		return ok(permission);
	});
}

function writeClientDrivePermissionForSession(
	ctx: MutationCtx,
	args: Parameters<typeof saveClientDrivePermission>[1],
	driveSession: Doc<"driveSessions"> | null
) {
	return safeTry(async function* () {
		const session = yield* requireDriveSession(driveSession);
		const driveClient = yield* loadDriveClientRow(ctx, session.driveClientId);
		const client = yield* requireDriveClient(driveClient);
		const permission = yield* writeClientDrivePermission(ctx, client, args);

		return ok(permission);
	});
}

export function saveClientDrivePermissionsStatus(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; status: "failed" | "ready" | "skipped" }
) {
	return safeTry(async function* () {
		const driveSession = yield* loadDriveSessionRowByBookingId(ctx, args.bookingId);
		const status = yield* saveClientDrivePermissionsStatusForLoadedSession(ctx, args, driveSession);

		return ok(status);
	});
}

function saveClientDrivePermissionsStatusForLoadedSession(
	ctx: MutationCtx,
	args: Parameters<typeof saveClientDrivePermissionsStatus>[1],
	driveSession: Doc<"driveSessions"> | null
) {
	return safeTry(async function* () {
		const session = yield* requireDriveSession(driveSession);
		const status = yield* writeClientDrivePermissionsStatusForSession(ctx, session, args.status);

		return ok(status);
	});
}

export function claimClientAssetsEmail(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; attempt: "automatic" | "retry"; now: number }
) {
	return safeTry(async function* () {
		const booking = yield* loadBookingRow(ctx, args.bookingId);
		const claim = yield* claimClientAssetsEmailForLoadedBooking(ctx, args, booking);

		return ok(claim);
	});
}

function claimClientAssetsEmailForLoadedBooking(
	ctx: MutationCtx,
	args: Parameters<typeof claimClientAssetsEmail>[1],
	booking: Doc<"bookings"> | null
) {
	return safeTry(async function* () {
		const validBooking = yield* requireClientAssetsEmailBooking(booking);

		const rows = yield* loadClientAssetsEmailRows(ctx, {
			bookingId: args.bookingId,
			driveClientId: validBooking.driveClientId
		});

		const claim = yield* claimClientAssetsEmailFromRows(ctx, args, validBooking.booking, rows);

		return ok(claim);
	});
}

export function saveClientAssetsEmailResult(
	ctx: MutationCtx,
	args: {
		assetsFolderId: string;
		bookingId: Id<"bookings">;
		claimedAt: number;
		status: "sent" | "failed";
	}
) {
	return safeTry(async function* () {
		const driveSession = yield* loadDriveSessionRowByBookingId(ctx, args.bookingId);
		const result = yield* saveClientAssetsEmailResultForSession(ctx, driveSession, args);

		return ok(result);
	});
}
