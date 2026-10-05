import { ConvexError } from "convex/values";
import { err, ok } from "neverthrow";
import { searchBlobPatchForBookingAsync } from "#convex/lib/adminSearch/adminSearchBlob";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { patchBookingInstagramHandle } from "#convex/lib/booking/bookingConfirmationSessionPatches";
import { requirePermission } from "#convex/services/auth";
import { listAdminSessions, type AdminSessionsView } from "#convex/lib/listAdminSessions";

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

export async function listSessionsService(ctx: QueryCtx, args: ListSessionsArgs) {
	await requirePermission(ctx, "view:sensitive-booking-data").match(
		() => null,
		(authError) => {
			throw new ConvexError(authError);
		}
	);

	// usePaginatedQuery requires the raw Convex PaginationResult, not our Result tuple.
	// Auth failures throw above so the hook can keep native cursor/page handling.
	return listAdminSessions(ctx, args);
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

export function writeSessionInstagramHandle(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	instagramHandle: string
) {
	return searchBlobPatchForBookingAsync(ctx, session, { instagramHandle }).andThen(
		(searchBlobPatch) =>
			patchBookingInstagramHandle(ctx, session, { instagramHandle, searchBlobPatch })
	);
}
