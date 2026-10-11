import { err, errAsync, ok, okAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { patchBookingInstagramHandle } from "#convex/booking/lib/confirmationSessionPatches";
import {
	searchBlobPatchForBookingAsync,
	type BookingSearchBlobPatch
} from "#convex/shared/lib/adminSearch/adminSearchBlob";

export function buildPublicSessionStatusResponse(session: Doc<"bookings">) {
	return {
		_id: session._id,
		status: session.status,
		bookingConfirmedAt: session.bookingConfirmedAt,
		bookingFailureCode: session.bookingFailureCode,
		pendingPaymentCreatedAt: session.pendingPaymentCreatedAt,
		paymentCompletedAt: session.paymentCompletedAt,
		date: session.date,
		time: session.time,
		duration: session.duration,
		service: session.service,
		addons: session.addons,
		essentialEditQuantity: session.essentialEditQuantity,
		completeEditQuantity: session.completeEditQuantity,
		clipsPackageQuantity: session.clipsPackageQuantity,
		handcraftedClipsQuantity: session.handcraftedClipsQuantity
	};
}

export function requireConfirmedBookingSession(session: Doc<"bookings">) {
	if (session.status !== "confirmed" && session.status !== "email_failed") {
		return err({ reason: "BOOKING_NOT_CONFIRMED" as const });
	}

	return ok(session);
}

export function nullIfMissingBooking(session: Doc<"bookings"> | null) {
	return session ?? null;
}

export function requirePublicRescheduleSession(session: Doc<"bookings"> | null) {
	if (!session) {
		return errAsync({ reason: "BOOKING_NOT_FOUND" as const });
	}

	return okAsync(buildPublicSessionStatusResponse(session));
}

export function publicStatusFromStripeLookup(session: Doc<"bookings"> | null) {
	return session === null ? null : buildPublicSessionStatusResponse(session);
}

export function buildInstagramSearchBlobPatch(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	instagramHandle: string
) {
	return searchBlobPatchForBookingAsync(ctx, session, { instagramHandle });
}

export function patchSessionInstagramHandle(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	instagramHandle: string,
	searchBlobPatch: BookingSearchBlobPatch
) {
	return patchBookingInstagramHandle(ctx, session, { instagramHandle, searchBlobPatch });
}
