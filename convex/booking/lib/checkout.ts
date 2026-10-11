import { okAsync, type ResultAsync } from "neverthrow";
import { formatDriveClientFolderName } from "#studio/lib/bookingdatetime";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	type CreatePendingCheckoutSessionArgs,
	buildPendingPaymentBookingFields,
	insertPendingPaymentBooking
} from "#convex/sessions/lib/pendingCheckoutSession";
import { mergeDeadCheckoutBookingUpdates, patchBookingFields } from "#convex/sessions/lib/archive";
import type {
	DeletePendingSessionDecision,
	DeletePendingSessionSuccess,
	ExpireSessionDecision
} from "#convex/sessions/lib/checkout";
import {
	validatePendingSessionDeletion,
	validateSessionExpiry
} from "#convex/sessions/lib/checkout";

export function buildCheckoutDriveClientInput(args: CreatePendingCheckoutSessionArgs) {
	return {
		email: args.email,
		displayName: formatDriveClientFolderName({
			accountName: args.accountName,
			contactName: args.name
		})
	};
}

export function insertPendingCheckoutBookingFields(
	ctx: MutationCtx,
	args: CreatePendingCheckoutSessionArgs,
	sessionStartAt: number,
	driveClientId: Id<"driveClients">
) {
	return insertPendingPaymentBooking(
		ctx,
		buildPendingPaymentBookingFields(args, sessionStartAt, driveClientId)
	);
}

export function validateSessionExpiryWithBooking(booking: Doc<"bookings"> | null) {
	return validateSessionExpiry(booking).map((decision) => ({ booking, decision }));
}

export function validatePendingSessionDeletionWithBooking(
	booking: Doc<"bookings"> | null,
	stripeSessionId: string
) {
	return validatePendingSessionDeletion(booking, stripeSessionId).map((decision) => ({
		booking,
		decision
	}));
}

export function writeDeadCheckoutBookingStatusForRow(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	status: "expired" | "abandoned",
	now: number,
	session: Doc<"bookings"> | null
): ResultAsync<null, never> {
	if (session === null) return okAsync(null);

	return patchBookingFields(
		ctx,
		bookingId,
		mergeDeadCheckoutBookingUpdates(session, { status }, now)
	);
}

export function expireBookingAfterValidate(
	ctx: MutationCtx,
	step: { booking: Doc<"bookings"> | null; decision: ExpireSessionDecision }
): ResultAsync<{ alreadyExpired: boolean }, never> {
	const { booking, decision } = step;

	if (decision.kind === "complete") {
		return okAsync({ alreadyExpired: decision.alreadyExpired });
	}

	return writeDeadCheckoutBookingStatusForRow(
		ctx,
		decision.bookingId,
		"expired",
		Date.now(),
		booking
	).map(() => ({ alreadyExpired: false as const }));
}

export function abandonBookingAfterValidate(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	step: { booking: Doc<"bookings"> | null; decision: DeletePendingSessionDecision }
): ResultAsync<DeletePendingSessionSuccess, never> {
	const { booking, decision } = step;

	if (decision.kind === "complete") return okAsync(decision.value);

	return writeDeadCheckoutBookingStatusForRow(ctx, bookingId, "abandoned", Date.now(), booking).map(
		() => ({ outcome: "abandoned" as const })
	);
}
