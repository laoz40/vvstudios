import { ConvexError } from "convex/values";
import { err, errAsync, ok, ResultAsync } from "neverthrow";
import { searchBlobPatchForBookingAsync } from "#convex/lib/adminSearch/adminSearchBlob";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { requirePermission } from "#convex/services/auth";
import {
	buildActiveEditorProjection,
	listActiveEditorProfiles
} from "#convex/lib/editor/editorAssignments";
import {
	buildEditorSessionProjection,
	isEditorVisibleSession
} from "#convex/lib/editor/editorSessions";
import { getEditorSessionDriveFolders } from "#convex/lib/drive/driveStatus";
import { okOrThrow } from "#convex/lib/result";
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

type ListEditorSessionsArgs = PaginationArgs;

type GetPublicRescheduleCompleteSessionArgs = { bookingId: string };

export function listActiveEditorsService(ctx: QueryCtx) {
	return requirePermission(ctx, "assign:session-editor")
		.andThen(() => listActiveEditorProfiles(ctx))
		.andThen((editors) =>
			ResultAsync.combine(editors.map((editor) => buildActiveEditorProjection(ctx, editor)))
		);
}

export function listEditorSessionsService(ctx: QueryCtx, args: ListEditorSessionsArgs) {
	return requirePermission(ctx, "view:sessions")
		.andThen((identity) =>
			okOrThrow(
				ctx.db
					.query("bookings")
					.withIndex("by_assignedEditorTokenIdentifier_and_driveClientId", (query) =>
						query.eq("assignedEditorTokenIdentifier", identity.tokenIdentifier)
					)
					.order("desc")
					.paginate(args.paginationOpts)
			)
		)
		.andThen((bookingsPage) => {
			const visibleSessions = bookingsPage.page.filter(isEditorVisibleSession);

			return ResultAsync.combine(
				visibleSessions.map((session) =>
					ResultAsync.fromPromise(getEditorSessionDriveFolders(ctx, session), () => null).map(
						(driveFolders) => buildEditorSessionProjection(session, driveFolders)
					)
				)
			).map((page) => ({ ...bookingsPage, page }));
		});
}

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

export function getPublicRescheduleCompleteSessionService(
	ctx: QueryCtx,
	args: GetPublicRescheduleCompleteSessionArgs
) {
	const bookingId = ctx.db.normalizeId("bookings", args.bookingId);

	if (bookingId === null) {
		return errAsync({ reason: "BOOKING_NOT_FOUND" as const });
	}

	return okOrThrow(ctx.db.get("bookings", bookingId)).andThen((session) => {
		if (!session) {
			return err({ reason: "BOOKING_NOT_FOUND" as const });
		}

		return ok(buildPublicSessionStatusResponse(session));
	});
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
			okOrThrow(
				ctx.db
					.patch("bookings", session._id, { instagramHandle, ...searchBlobPatch })
					.then(() => null)
			)
	);
}
