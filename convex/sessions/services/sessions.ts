import { err, ok } from "neverthrow";
import {
	searchBlobPatchForBookingAsync,
	type BookingSearchBlobPatch
} from "#convex/shared/lib/adminSearch/adminSearchBlob";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { patchBookingInstagramHandle } from "#convex/booking/lib/bookingConfirmationSessionPatches";
import { requirePermission } from "#convex/shared/services/auth";
import { listAdminSessions, type AdminSessionsView } from "#convex/shared/lib/listAdminSessions";

type PaginationArgs = { paginationOpts: { numItems: number; cursor: string | null } };

type SessionListSortBy = "session" | "createdAt";

type SessionListSortDirection = "asc" | "desc";

type ListSessionsArgs = PaginationArgs & {
	sortBy?: SessionListSortBy;
	sortDirection?: SessionListSortDirection;
	view?: AdminSessionsView;
	includeStale?: boolean;
	searchQuery?: string;
};

export function listSessionsService(ctx: QueryCtx, args: ListSessionsArgs) {
	return requirePermission(ctx, "view:sensitive-booking-data").map(() =>
		listAdminSessions(ctx, args)
	);
}

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

function patchInstagramHandleStep(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	instagramHandle: string,

	searchBlobPatch: BookingSearchBlobPatch
) {
	return patchBookingInstagramHandle(ctx, session, { instagramHandle, searchBlobPatch });
}

export function writeSessionInstagramHandle(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	instagramHandle: string
) {
	return searchBlobPatchForBookingAsync(ctx, session, { instagramHandle }).andThen(
		(searchBlobPatch: BookingSearchBlobPatch) =>
			patchInstagramHandleStep(ctx, session, instagramHandle, searchBlobPatch)
	);
}
