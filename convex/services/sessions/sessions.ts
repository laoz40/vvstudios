import { ConvexError } from "convex/values";
import { err, errAsync, ok, ResultAsync } from "neverthrow";
import { searchBlobPatchForBookingAsync } from "#convex/lib/adminSearch/adminSearchBlob";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { setBookingArchived } from "#convex/lib/archiveState";
import { getEditorByToken } from "#convex/lib/auth";
import { requirePermission } from "#convex/services/auth";
import {
	scheduleDeliverablesReviewHostEmail,
	shouldNotifyHostOfDeliverablesReview
} from "#convex/lib/editor/deliverablesReviewNotification";
import {
	buildActiveEditorProjection,
	listActiveEditorProfiles,
	updateSessionEditorAssignment
} from "#convex/lib/editor/editorAssignments";
import {
	buildEditorSessionProjection,
	isEditorVisibleSession,
	requireDeliverablesEligibility,
	requireDeliverablesOwnership,
	saveSessionAdminNotes,
	saveSessionEditorNotes,
	saveSessionEditStatus
} from "#convex/lib/editor/editorSessions";
import { getDriveStatus, getEditorSessionDriveFolders } from "#convex/lib/drive/driveStatus";
import { okOrThrow } from "#convex/lib/result";
import { getSessionByStripeSessionId, getSessionFromDb } from "#convex/lib/sessions/sessionLookup";
import { listAdminSessions, type AdminSessionsView } from "#convex/lib/listAdminSessions";
import {
	archiveDeadCheckoutBooking,
	archivePastDeadCheckoutSessionsBatch,
	archiveSessionWhenFullyDone
} from "#convex/lib/sessions/sessionArchive";

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

type ArchivePastDeadCheckoutSessionsArgs = { cursor: string | null; numItems?: number };

type UpdateSessionEditStatusArgs = {
	bookingId: Id<"bookings">;
	editStatus: "to_edit" | "editing" | "review" | "completed";
};

type UpdateSessionEditStatusError =
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "SESSION_NOT_ASSIGNED_TO_EDITOR" }
	| { reason: "SESSION_NOT_CONFIRMED" }
	| { reason: "SESSION_NOT_IN_PAST" };

type UpdateSessionNotesArgs = { bookingId: Id<"bookings">; editorNotes: string };

type UpdateSessionAdminNotesArgs = { bookingId: Id<"bookings">; adminNotes: string };

type MarkSessionCalendarEventDeletedArgs = { bookingId: Id<"bookings"> };

type GetDriveStatusArgs = { bookingId: Id<"bookings"> };

export function getDriveStatusService(ctx: QueryCtx, args: GetDriveStatusArgs) {
	return requirePermission(ctx, "view:sensitive-booking-data").andThen(() =>
		getDriveStatus(ctx, args.bookingId)
	);
}

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

export function archivePastDeadCheckoutSessionsService(
	ctx: MutationCtx,
	args: ArchivePastDeadCheckoutSessionsArgs
) {
	return requirePermission(ctx, "archive:sessions").andThen(() =>
		ResultAsync.fromPromise(
			archivePastDeadCheckoutSessionsBatch(ctx, args.cursor, args.numItems),
			() => ({ reason: "SESSION_ARCHIVE_FAILED" as const })
		)
	);
}

export function updateSessionAdminNotesService(
	ctx: MutationCtx,
	args: UpdateSessionAdminNotesArgs
) {
	return requirePermission(ctx, "assign:session-editor")
		.andThen(() => getSessionFromDb(ctx, args.bookingId))
		.andThen((session) => saveSessionAdminNotes(ctx, session, args.adminNotes));
}

export function updateSessionNotesService(ctx: MutationCtx, args: UpdateSessionNotesArgs) {
	return requirePermission(ctx, "update:deliverables")
		.andThen((identity) =>
			getSessionFromDb(ctx, args.bookingId).map((session) => ({ identity, session }))
		)
		.andThen(requireDeliverablesOwnership)
		.andThen(({ session }) => saveSessionEditorNotes(ctx, session, args.editorNotes));
}

export function updateSessionEditStatusService(
	ctx: MutationCtx,
	args: UpdateSessionEditStatusArgs
): ResultAsync<null, UpdateSessionEditStatusError> {
	return requirePermission(ctx, "update:deliverables")
		.andThen((identity) =>
			getSessionFromDb(ctx, args.bookingId).map((session) => ({ identity, session }))
		)
		.andThen(requireDeliverablesOwnership)
		.andThen((access) => requireDeliverablesEligibility(access).map(() => access))
		.andThen(({ identity, session }) => {
			const shouldNotifyHost = shouldNotifyHostOfDeliverablesReview({
				identity,
				previousEditStatus: session.editStatus,
				nextEditStatus: args.editStatus
			});

			return saveSessionEditStatus(ctx, session, args.editStatus).andThen(() => {
				if (!shouldNotifyHost) {
					return archiveSessionWhenFullyDone(ctx, args.bookingId);
				}

				return getEditorByToken(ctx, identity.tokenIdentifier)
					.andThen((editor) => {
						const editorName = editor?.displayName ?? identity.name ?? "An editor";

						return scheduleDeliverablesReviewHostEmail(ctx, {
							bookingId: args.bookingId,
							clientName: session.name,
							editorName,
							sessionDate: session.date,
							idempotencyKey: `deliverables-review:${args.bookingId}:${Date.now()}`
						});
					})
					.andThen(() => archiveSessionWhenFullyDone(ctx, args.bookingId));
			});
		});
}

export function markSessionCalendarEventDeletedService(
	ctx: MutationCtx,
	args: MarkSessionCalendarEventDeletedArgs
) {
	return getSessionFromDb(ctx, args.bookingId).andThen(() =>
		archiveDeadCheckoutBooking(ctx, args.bookingId, {
			bookingFailureCode: undefined,
			googleCalendarId: undefined,
			googleEventId: undefined,
			status: "cancelled"
		})
	);
}
