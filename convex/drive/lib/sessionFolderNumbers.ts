import { okAsync, ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import {
	loadBookingsByDriveClientId,
	loadBookingsByEmail,
	loadPackageBookings
} from "#convex/drive/lib/driveLookup";
import {
	loadDriveClientRow,
	loadDriveSessionRowByBookingId
} from "#convex/drive/lib/driveBookingDriveClient";
import { loadDriveClientByNormalizedEmail } from "#convex/drive/lib/driveFolders";
import {
	formatDriveNumberedSessionFolderName,
	formatDriveSessionFolderName
} from "#studio/lib/bookingdatetime";

export type DriveFolderNumberCtx = Pick<QueryCtx, "db">;

export function sortScheduledSessions(bookings: Doc<"bookings">[]) {
	return bookings
		.filter((booking) => booking.status !== "cancelled")
		.toSorted((a, b) => a.sessionStartAt - b.sessionStartAt);
}

export function savedPackageNumbers(rows: (Doc<"driveSessions"> | null)[]) {
	return new Set(
		rows.flatMap((row) =>
			row?.packageSessionNumber === undefined ? [] : [row.packageSessionNumber]
		)
	);
}

export function savedClientNumbers(rows: (Doc<"driveSessions"> | null)[]) {
	return new Set(
		rows.flatMap((row) => (row?.clientSessionNumber === undefined ? [] : [row.clientSessionNumber]))
	);
}

export function availableFolderNumber(sessionIndex: number, saved: Set<number>) {
	let number = sessionIndex + 1;

	while (saved.has(number)) number += 1;

	return number;
}

export function availableFolderNumberAtIndex(index: number | undefined, saved: Set<number>) {
	return index === undefined ? undefined : availableFolderNumber(index, saved);
}

export function scheduledSessionIndex(sessions: Doc<"bookings">[], booking: Doc<"bookings">) {
	const index = sessions.findIndex((row) => row._id === booking._id);

	return index === -1 ? undefined : index;
}

export type SessionFolderNumberPlan =
	| {
			kind: "saved";
			booking: Doc<"bookings">;
			number: number;
			packageId?: never;
			clientDriveClientId?: never;
	  }
	| {
			kind: "package";
			booking: Doc<"bookings">;
			packageId: Id<"packages">;
			clientDriveClientId?: never;
	  }
	| { kind: "client"; booking: Doc<"bookings">; packageId?: never; clientDriveClientId?: never }
	| {
			kind: "known_client";
			booking: Doc<"bookings">;
			clientDriveClientId: Id<"driveClients">;
			packageId?: never;
	  };

export function sessionFolderNumberPlan(
	booking: Doc<"bookings">,
	session: Doc<"driveSessions"> | null
): SessionFolderNumberPlan {
	if (booking.packageId !== undefined) {
		const existingNumber = session?.packageSessionNumber;

		return existingNumber === undefined
			? { kind: "package", booking, packageId: booking.packageId }
			: { kind: "saved", booking, number: existingNumber };
	}

	const existingNumber = session?.clientSessionNumber;

	return existingNumber !== undefined
		? { kind: "saved", booking, number: existingNumber }
		: { kind: "client", booking };
}

export function standaloneSessionFolderNumberPlan(
	booking: Doc<"bookings">,
	driveClientId: Id<"driveClients">,
	session: Doc<"driveSessions"> | null
): SessionFolderNumberPlan {
	const existingNumber = session?.clientSessionNumber;

	return existingNumber !== undefined
		? { kind: "saved", booking, number: existingNumber }
		: { kind: "known_client", booking, clientDriveClientId: driveClientId };
}

export function packageSessionFolderNumberPlan(
	booking: Doc<"bookings">,
	packageId: Id<"packages">,
	session: Doc<"driveSessions"> | null
): SessionFolderNumberPlan {
	return session?.packageSessionNumber === undefined
		? { kind: "package", booking, packageId }
		: { kind: "saved", booking, number: session.packageSessionNumber };
}

export function packageIdForSessionFolderPlan(plan: SessionFolderNumberPlan) {
	return plan.kind === "package" ? plan.packageId : undefined;
}

export function packageIdForSessionFolderNumberRows(
	plan: SessionFolderNumberPlan,
	index: number | undefined
) {
	return index === undefined ? undefined : packageIdForSessionFolderPlan(plan);
}

export function clientRequestForSessionFolderPlan(plan: SessionFolderNumberPlan) {
	if (plan.kind === "client") {
		return { booking: plan.booking, driveClientId: plan.booking.driveClientId };
	}

	if (plan.kind === "known_client") {
		return { booking: undefined, driveClientId: plan.clientDriveClientId };
	}

	return { booking: undefined, driveClientId: undefined };
}

export function clientIdForSessionFolderNumberRows(
	driveClientId: Id<"driveClients"> | undefined,
	index: number | undefined
) {
	return index === undefined ? undefined : driveClientId;
}

export function chooseSessionFolderNumber(
	plan: SessionFolderNumberPlan,
	packageNumber: number | undefined,
	clientNumber: number | undefined
) {
	return plan.kind === "saved" ? plan.number : (packageNumber ?? clientNumber);
}

export function resolveBookingDriveClientId(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings">
): ResultAsync<Id<"driveClients"> | undefined, never> {
	if (booking.driveClientId !== undefined) return okAsync(booking.driveClientId);

	return loadDriveClientByNormalizedEmail(ctx, booking.email.trim().toLowerCase()).map(
		(client) => client?._id
	);
}

export function resolveBookingDriveClientIdIfRequested(
	ctx: DriveFolderNumberCtx,
	booking: Doc<"bookings"> | undefined,
	driveClientId?: Id<"driveClients">
) {
	if (driveClientId !== undefined) return okAsync<Id<"driveClients"> | undefined>(driveClientId);

	if (booking === undefined) return okAsync<Id<"driveClients"> | undefined>(undefined);

	return resolveBookingDriveClientId(ctx, booking);
}

export function mergeStandaloneBookings([byClient, byEmail]: [
	Doc<"bookings">[],
	Doc<"bookings">[]
]) {
	const rows = new Map<Id<"bookings">, Doc<"bookings">>();

	for (const row of [...byClient, ...byEmail])
		if (row.packageId === undefined) rows.set(row._id, row);

	return [...rows.values()];
}

export function loadPackageBookingsIfRequested(
	ctx: DriveFolderNumberCtx,
	packageId: Id<"packages"> | undefined
) {
	return packageId === undefined
		? okAsync<Doc<"bookings">[]>([])
		: loadPackageBookings(ctx, packageId);
}

export function loadDriveClientIfRequested(
	ctx: DriveFolderNumberCtx,
	driveClientId: Id<"driveClients"> | undefined
) {
	return driveClientId === undefined
		? okAsync<Doc<"driveClients"> | null>(null)
		: loadDriveClientRow(ctx, driveClientId);
}

export function loadStandaloneBookingsIfClientExists(
	ctx: DriveFolderNumberCtx,
	driveClientId: Id<"driveClients"> | undefined,
	client: Doc<"driveClients"> | null
) {
	if (driveClientId === undefined || client === null) return okAsync<Doc<"bookings">[]>([]);

	return ResultAsync.combine([
		loadBookingsByDriveClientId(ctx, driveClientId),
		loadBookingsByEmail(ctx, client.normalizedEmail)
	]).map(mergeStandaloneBookings);
}

export function loadSessionRowsForScheduledBookings(
	ctx: DriveFolderNumberCtx,
	bookings: Doc<"bookings">[],
	index: number | undefined
) {
	return index === undefined
		? okAsync<(Doc<"driveSessions"> | null)[]>([])
		: ResultAsync.combine(
				bookings.map((booking) => loadDriveSessionRowByBookingId(ctx, booking._id))
			);
}

export function formatSessionFolderDisplayName(
	booking: Doc<"bookings">,
	number: number | undefined
) {
	return number === undefined
		? formatDriveSessionFolderName(booking.sessionStartAt)
		: formatDriveNumberedSessionFolderName(number, booking.sessionStartAt);
}
