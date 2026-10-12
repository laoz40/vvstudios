import { ok, ResultAsync, safeTry } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import {
	availableFolderNumberAtIndex,
	clientIdForSessionFolderNumberRows,
	clientRequestForSessionFolderPlan,
	chooseSessionFolderNumber,
	formatSessionFolderDisplayName,
	loadDriveClientIfRequested,
	loadPackageBookingsIfRequested,
	loadSessionRowsForScheduledBookings,
	loadStandaloneBookingsIfClientExists,
	packageIdForSessionFolderNumberRows,
	packageIdForSessionFolderPlan,
	resolveBookingDriveClientIdIfRequested,
	savedClientNumbers,
	savedPackageNumbers,
	scheduledSessionIndex,
	sessionFolderNumberPlan,
	sortScheduledSessions,
	type DriveFolderNumberCtx,
	type SessionFolderNumberPlan
} from "#convex/drive/lib/sessionFolderNumbers";
import type { Id } from "#convex/_generated/dataModel";

function computePackageFolderNumber(ctx: DriveFolderNumberCtx, plan: SessionFolderNumberPlan) {
	return safeTry(async function* () {
		const bookings = sortScheduledSessions(
			yield* loadPackageBookingsIfRequested(ctx, packageIdForSessionFolderPlan(plan))
		);

		const number = yield* computeAvailablePackageNumber(ctx, plan, bookings);

		return ok(number);
	});
}

function loadClientStandaloneBookings(
	ctx: DriveFolderNumberCtx,
	driveClientId: Id<"driveClients"> | undefined
) {
	return safeTry(async function* () {
		const client = yield* loadDriveClientIfRequested(ctx, driveClientId);
		const bookings = yield* loadStandaloneBookingsIfClientExists(ctx, driveClientId, client);

		return ok(bookings);
	});
}

function computeAvailablePackageNumber(
	ctx: DriveFolderNumberCtx,
	plan: SessionFolderNumberPlan,
	bookings: Doc<"bookings">[]
) {
	const index = scheduledSessionIndex(bookings, plan.booking);

	return safeTry(async function* () {
		const allPackageBookings = yield* loadPackageBookingsIfRequested(
			ctx,
			packageIdForSessionFolderNumberRows(plan, index)
		);

		const rows = yield* loadSessionRowsForScheduledBookings(ctx, allPackageBookings, index);

		return ok(availableFolderNumberAtIndex(index, savedPackageNumbers(rows)));
	});
}

function computeAvailableClientNumber(
	ctx: DriveFolderNumberCtx,
	plan: SessionFolderNumberPlan,
	driveClientId: Id<"driveClients"> | undefined,
	bookings: Doc<"bookings">[]
) {
	const index = scheduledSessionIndex(bookings, plan.booking);

	return safeTry(async function* () {
		const allStandaloneBookings = yield* loadClientStandaloneBookings(
			ctx,
			clientIdForSessionFolderNumberRows(driveClientId, index)
		);

		const rows = yield* loadSessionRowsForScheduledBookings(ctx, allStandaloneBookings, index);

		return ok(availableFolderNumberAtIndex(index, savedClientNumbers(rows)));
	});
}

function computeClientFolderNumber(ctx: DriveFolderNumberCtx, plan: SessionFolderNumberPlan) {
	return safeTry(async function* () {
		const driveClientId = yield* resolvePlannedClientDriveId(ctx, plan);
		const number = yield* computeClientNumberForDriveClient(ctx, plan, driveClientId);

		return ok(number);
	});
}

function resolvePlannedClientDriveId(ctx: DriveFolderNumberCtx, plan: SessionFolderNumberPlan) {
	const request = clientRequestForSessionFolderPlan(plan);

	return resolveBookingDriveClientIdIfRequested(ctx, request.booking, request.driveClientId);
}

function computeClientNumberForDriveClient(
	ctx: DriveFolderNumberCtx,
	plan: SessionFolderNumberPlan,
	driveClientId: Id<"driveClients"> | undefined
) {
	return safeTry(async function* () {
		const bookings = yield* loadClientStandaloneBookings(ctx, driveClientId);

		const number = yield* computeAvailableClientNumber(
			ctx,
			plan,
			driveClientId,
			sortScheduledSessions(bookings)
		);

		return ok(number);
	});
}

function chooseSessionFolderNumberWithClient(
	ctx: DriveFolderNumberCtx,
	plan: SessionFolderNumberPlan,
	packageNumber: number | undefined
) {
	return safeTry(async function* () {
		const clientNumber = yield* computeClientFolderNumber(ctx, plan);

		return ok(chooseSessionFolderNumber(plan, packageNumber, clientNumber));
	});
}

export function computeSessionFolderNumber(
	ctx: DriveFolderNumberCtx,
	plan: SessionFolderNumberPlan
): ResultAsync<number | undefined, never> {
	return safeTry(async function* () {
		const packageNumber = yield* computePackageFolderNumber(ctx, plan);
		const number = yield* chooseSessionFolderNumberWithClient(ctx, plan, packageNumber);

		return ok(number);
	});
}

export function resolveSessionFolderDisplayName(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings">,
	session: Doc<"driveSessions"> | null
): ResultAsync<string, never> {
	const plan = sessionFolderNumberPlan(booking, session);

	return safeTry(async function* () {
		const number = yield* computeSessionFolderNumber(ctx, plan);

		return ok(formatSessionFolderDisplayName(booking, number));
	});
}
