import { ConvexError } from "convex/values";
import { err, errAsync, ok } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { setBookingArchived } from "#convex/lib/archiveState";
import { requirePermission } from "#convex/lib/auth";
import {
	buildActiveEditorProjection,
	listActiveEditorProfiles,
	updateSessionEditorAssignment
} from "#convex/lib/editorAssignments";
import {
	buildEditorSessionProjection,
	detectDeliverablesCustomerType,
	isEditorVisibleSession,
	requireDeliverablesEligibility,
	requireDeliverablesOwnership,
	saveSessionAdminNotes,
	saveSessionEditorNotes,
	saveSessionEditStatus
} from "#convex/lib/editorSessions";
import {
	getCapacityConsumingPackageSessions,
	sessionConsumesPackageCapacity
} from "#convex/lib/packageScheduling";
import {
	getDriveStatus,
	getDriveWorkflowFailureForBooking,
	getEditorSessionDriveFolders
} from "#convex/lib/driveStatus";
import { okOrThrow } from "#convex/lib/result";
import { searchBlobPatchForBooking } from "#convex/lib/adminSearchBlob";
import { getSessionByStripeSessionId, getSessionFromDb } from "#convex/lib/sessionLookup";
import { listStripeInvoicesForBooking, summarizeStripeInvoices } from "#convex/lib/stripeInvoices";
import {
	paginateAdminSessionsWithoutSearch,
	paginateAdminSessionsWithSearch,
	type AdminSessionSearchArgs
} from "#convex/lib/adminBookingSearch";
import { parseTrimmedAdminSearchQuery } from "#convex/lib/adminSearchQuery";
import { passesAdminInboxStaleFilter, type AdminSessionsView } from "#convex/lib/adminSessionList";
import {
	archiveDeadCheckoutBooking,
	archivePastDeadCheckoutSessionsBatch,
	archiveSessionWhenFullyDone
} from "#convex/lib/sessionArchive";

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

type GetDeliverablesCustomerTypeArgs = { bookingId: Id<"bookings"> };

type SaveSessionInstagramHandleArgs = { stripeSessionId: string; instagramHandle: string };

type ArchiveSessionArgs = { bookingId: Id<"bookings">; archived: boolean };

type ArchivePastDeadCheckoutSessionsArgs = { cursor: string | null; numItems?: number };

type UpdateSessionEditStatusArgs = {
	bookingId: Id<"bookings">;
	editStatus: "to_edit" | "editing" | "review" | "completed";
};

type UpdateSessionNotesArgs = { bookingId: Id<"bookings">; editorNotes: string };

type UpdateSessionAdminNotesArgs = { bookingId: Id<"bookings">; adminNotes: string };

type MarkSessionCalendarEventDeletedArgs = { bookingId: Id<"bookings"> };

type GetDriveStatusArgs = { bookingId: Id<"bookings"> };

type AssignSessionEditorArgs = {
	bookingId: Id<"bookings">;
	editorTokenIdentifier: string | null;
	adminNotes: string;
};

export function getDriveStatusService(ctx: QueryCtx, args: GetDriveStatusArgs) {
	return requirePermission(ctx, "view:sensitive-booking-data").andThen(() =>
		getDriveStatus(ctx, args.bookingId)
	);
}

export function getDeliverablesCustomerTypeService(
	ctx: QueryCtx,
	args: GetDeliverablesCustomerTypeArgs
) {
	return requirePermission(ctx, "send:deliverables-email")
		.andThen((identity) =>
			getSessionFromDb(ctx, args.bookingId).map((session) => ({ identity, session }))
		)
		.andThen(requireDeliverablesOwnership)
		.andThen(requireDeliverablesEligibility)
		.andThen((session) => detectDeliverablesCustomerType(ctx, session));
}

export function listActiveEditorsService(ctx: QueryCtx) {
	return requirePermission(ctx, "assign:session-editor")
		.andThen(() => listActiveEditorProfiles(ctx))
		.andThen((editors) =>
			okOrThrow(Promise.all(editors.map((editor) => buildActiveEditorProjection(ctx, editor))))
		);
}

export function listEditorSessionsService(ctx: QueryCtx, args: ListEditorSessionsArgs) {
	return requirePermission(ctx, "view:sessions")
		.andThen((identity) =>
			okOrThrow(
				ctx.db
					.query("bookings")
					.withIndex("by_assignedEditorTokenIdentifier", (query) =>
						query.eq("assignedEditorTokenIdentifier", identity.tokenIdentifier)
					)
					.order("desc")
					.paginate(args.paginationOpts)
			)
		)
		.andThen((bookingsPage) => {
			const visibleSessions = bookingsPage.page.filter(isEditorVisibleSession);

			return okOrThrow(
				Promise.all(
					visibleSessions.map(async (session) =>
						buildEditorSessionProjection(session, await getEditorSessionDriveFolders(ctx, session))
					)
				)
			).map((page) => ({ ...bookingsPage, page }));
		});
}

async function loadAdminSessionListRows(ctx: QueryCtx, sessionsPage: Doc<"bookings">[]) {
	return Promise.all(
		sessionsPage.map(async (session) => {
			const [hasDriveWorkflowFailure, stripeInvoicesResult] = await Promise.all([
				getDriveWorkflowFailureForBooking(ctx, session),
				listStripeInvoicesForBooking(ctx, session._id)
			]);

			const stripeInvoicesSummary = summarizeStripeInvoices(stripeInvoicesResult.unwrapOr([]));

			if (!session.packageId) {
				return { ...session, hasDriveWorkflowFailure, stripeInvoicesSummary };
			}

			const packageRecord = await ctx.db.get(session.packageId);

			if (!packageRecord) {
				return { ...session, hasDriveWorkflowFailure, stripeInvoicesSummary };
			}

			const packageSessions = await getCapacityConsumingPackageSessions(
				ctx,
				packageRecord._id,
				packageRecord.packageSize
			);

			return {
				...session,
				hasDriveWorkflowFailure,
				stripeInvoicesSummary,
				linkedPackageSize: packageRecord.packageSize,
				packageStripeCustomerId: packageRecord.stripeCustomerId,
				packageSessionPosition: sessionConsumesPackageCapacity(session)
					? packageSessions.findIndex(({ _id }) => _id === session._id) + 1
					: undefined
			};
		})
	);
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
	const sortBy = args.sortBy ?? "session";
	const sortDirection = args.sortDirection ?? "asc";
	const view = args.view ?? "inbox";
	const includeStale = args.includeStale ?? true;
	const parsedSearchQuery = parseTrimmedAdminSearchQuery(args.searchQuery);

	const searchContext: Omit<AdminSessionSearchArgs, "parsedQuery"> = {
		sortBy,
		sortDirection,
		view,
		includeStale,
		paginationOpts: args.paginationOpts
	};

	const bookingsPage = parsedSearchQuery
		? await paginateAdminSessionsWithSearch(ctx, {
				...searchContext,
				parsedQuery: parsedSearchQuery
			})
		: await paginateAdminSessionsWithoutSearch(ctx, searchContext);

	const sessionsPage = !includeStale
		? bookingsPage.page.filter((session) => passesAdminInboxStaleFilter(session, includeStale))
		: bookingsPage.page;

	const page = await loadAdminSessionListRows(ctx, sessionsPage);

	return { ...bookingsPage, page };
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

	return okOrThrow(ctx.db.get(bookingId)).andThen((session) => {
		if (!session) {
			return err({ reason: "BOOKING_NOT_FOUND" as const });
		}

		return ok(buildPublicSessionStatusResponse(session));
	});
}

export function saveSessionInstagramHandleService(
	ctx: MutationCtx,
	args: SaveSessionInstagramHandleArgs
) {
	return getSessionByStripeSessionId(ctx, args.stripeSessionId)
		.andThen((session) => {
			if (session.status !== "confirmed" && session.status !== "email_failed") {
				return err({ reason: "BOOKING_NOT_CONFIRMED" as const });
			}

			return ok(session);
		})
		.andThen((session) =>
			okOrThrow(
				searchBlobPatchForBooking(ctx, session, { instagramHandle: args.instagramHandle }).then(
					(searchBlobPatch) =>
						ctx.db
							.patch(session._id, { instagramHandle: args.instagramHandle, ...searchBlobPatch })
							.then(() => null)
				)
			)
		);
}

export function assignSessionEditorService(ctx: MutationCtx, args: AssignSessionEditorArgs) {
	return requirePermission(ctx, "assign:session-editor")
		.andThen(() => getSessionFromDb(ctx, args.bookingId))
		.andThen((session) =>
			updateSessionEditorAssignment(ctx, session, args.editorTokenIdentifier, args.adminNotes)
		);
}

export function archiveSessionService(ctx: MutationCtx, args: ArchiveSessionArgs) {
	return requirePermission(ctx, "archive:sessions")
		.andThen(() => getSessionFromDb(ctx, args.bookingId))
		.andThen(() =>
			okOrThrow(setBookingArchived(ctx, args.bookingId, args.archived).then(() => null))
		);
}

export function archivePastDeadCheckoutSessionsService(
	ctx: MutationCtx,
	args: ArchivePastDeadCheckoutSessionsArgs
) {
	return requirePermission(ctx, "archive:sessions").andThen(() =>
		okOrThrow(
			archivePastDeadCheckoutSessionsBatch(ctx, args.cursor, args.numItems).then((batch) => batch)
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
) {
	return requirePermission(ctx, "update:deliverables")
		.andThen((identity) =>
			getSessionFromDb(ctx, args.bookingId).map((session) => ({ identity, session }))
		)
		.andThen(requireDeliverablesOwnership)
		.andThen(requireDeliverablesEligibility)
		.andThen((session) => saveSessionEditStatus(ctx, session, args.editStatus))
		.andThen(() => archiveSessionWhenFullyDone(ctx, args.bookingId));
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
