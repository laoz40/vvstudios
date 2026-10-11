import { type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	clientSessionNumberAllocation,
	packageSessionNumberAllocation,
	requireSessionFolderNumber,
	linkBookingDriveClientForNewClientSession,
	saveClientSessionNumber as saveClientSessionNumberLib,
	type ClientSessionNumberAllocation,
	type ClientSessionNumberError,
	type PackageSessionNumberAllocation,
	type PackageSessionNumberError,
	type StandaloneBooking
} from "#convex/drive/lib/sessionFolders/allocateNumbers";
import {
	packageSessionFolderNumberPlan,
	standaloneSessionFolderNumberPlan
} from "#convex/drive/lib/sessionFolderNumbers";
import { computeSessionFolderNumber } from "#convex/drive/services/sessionFolderNames";

export function clientSessionNumberFromExistingSession(
	ctx: MutationCtx,
	existingSession: Doc<"driveSessions"> | null,
	standaloneBooking: StandaloneBooking
): ResultAsync<ClientSessionNumberAllocation, ClientSessionNumberError> {
	return computeSessionFolderNumber(
		ctx,
		standaloneSessionFolderNumberPlan(
			standaloneBooking.booking,
			standaloneBooking.driveClientId,
			existingSession
		)
	)
		.andThen(requireSessionFolderNumber)
		.map((number) => clientSessionNumberAllocation(standaloneBooking, existingSession, number));
}

export function saveClientSessionNumber(
	ctx: MutationCtx,
	allocation: ClientSessionNumberAllocation
) {
	return saveClientSessionNumberLib(ctx, allocation)
		.andThen((_number) => linkBookingDriveClientForNewClientSession(ctx, allocation))
		.map(() => allocation.number);
}

export type PackageBooking = { booking: Doc<"bookings">; packageId: Id<"packages"> };

export function packageSessionNumberFromExistingSession(
	ctx: MutationCtx,
	existingSession: Doc<"driveSessions"> | null,
	packageBooking: PackageBooking
): ResultAsync<PackageSessionNumberAllocation, PackageSessionNumberError> {
	return computeSessionFolderNumber(
		ctx,
		packageSessionFolderNumberPlan(
			packageBooking.booking,
			packageBooking.packageId,
			existingSession
		)
	)
		.andThen(requireSessionFolderNumber)
		.map((number) => packageSessionNumberAllocation(packageBooking, existingSession, number));
}
