import { ResultAsync } from "neverthrow";
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
	return loadPackageBookingsIfRequested(ctx, packageIdForSessionFolderPlan(plan))
		.map(sortScheduledSessions)
		.andThen((bookings) => computeAvailablePackageNumber(ctx, plan, bookings));
}

function loadClientStandaloneBookings(
	ctx: DriveFolderNumberCtx,
	driveClientId: Id<"driveClients"> | undefined
) {
	return loadDriveClientIfRequested(ctx, driveClientId).andThen((client) =>
		loadStandaloneBookingsIfClientExists(ctx, driveClientId, client)
	);
}

function computeAvailablePackageNumber(
	ctx: DriveFolderNumberCtx,
	plan: SessionFolderNumberPlan,
	bookings: Doc<"bookings">[]
) {
	const index = scheduledSessionIndex(bookings, plan.booking);

	return loadPackageBookingsIfRequested(ctx, packageIdForSessionFolderNumberRows(plan, index))
		.andThen((allPackageBookings) =>
			loadSessionRowsForScheduledBookings(ctx, allPackageBookings, index)
		)
		.map((rows) => availableFolderNumberAtIndex(index, savedPackageNumbers(rows)));
}

function computeAvailableClientNumber(
	ctx: DriveFolderNumberCtx,
	plan: SessionFolderNumberPlan,
	driveClientId: Id<"driveClients"> | undefined,
	bookings: Doc<"bookings">[]
) {
	const index = scheduledSessionIndex(bookings, plan.booking);

	return loadClientStandaloneBookings(ctx, clientIdForSessionFolderNumberRows(driveClientId, index))
		.andThen((allStandaloneBookings) =>
			loadSessionRowsForScheduledBookings(ctx, allStandaloneBookings, index)
		)
		.map((rows) => availableFolderNumberAtIndex(index, savedClientNumbers(rows)));
}

function computeClientFolderNumber(ctx: DriveFolderNumberCtx, plan: SessionFolderNumberPlan) {
	return resolvePlannedClientDriveId(ctx, plan).andThen((driveClientId) =>
		computeClientNumberForDriveClient(ctx, plan, driveClientId)
	);
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
	return loadClientStandaloneBookings(ctx, driveClientId).andThen((bookings) =>
		computeAvailableClientNumber(ctx, plan, driveClientId, sortScheduledSessions(bookings))
	);
}

function chooseSessionFolderNumberWithClient(
	ctx: DriveFolderNumberCtx,
	plan: SessionFolderNumberPlan,
	packageNumber: number | undefined
) {
	return computeClientFolderNumber(ctx, plan).map((clientNumber) =>
		chooseSessionFolderNumber(plan, packageNumber, clientNumber)
	);
}

export function computeSessionFolderNumber(
	ctx: DriveFolderNumberCtx,
	plan: SessionFolderNumberPlan
): ResultAsync<number | undefined, never> {
	return computePackageFolderNumber(ctx, plan).andThen((packageNumber) =>
		chooseSessionFolderNumberWithClient(ctx, plan, packageNumber)
	);
}

export function resolveSessionFolderDisplayName(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings">,
	session: Doc<"driveSessions"> | null
): ResultAsync<string, never> {
	const plan = sessionFolderNumberPlan(booking, session);

	return computeSessionFolderNumber(ctx, plan).map((number) =>
		formatSessionFolderDisplayName(booking, number)
	);
}
