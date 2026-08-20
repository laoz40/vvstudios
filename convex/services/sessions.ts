import { ConvexError } from "convex/values";
import { err, errAsync, ok } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
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
	saveSessionEditStatus,
	saveSessionReview
} from "#convex/lib/editorSessions";
import {
	getCapacityConsumingPackageSessions,
	sessionConsumesPackageCapacity
} from "#convex/lib/packageScheduling";
import { buildDriveStatus } from "#convex/lib/driveRecords";
import { okOrThrow } from "#convex/lib/result";
import { getSessionByStripeSessionId, getSessionFromDb } from "#convex/lib/sessionLookup";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";

type PaginationArgs = { paginationOpts: { numItems: number; cursor: string | null } };
type ListSessionsArgs = PaginationArgs;
type ListEditorSessionsArgs = PaginationArgs;
type GetPublicRescheduleCompleteSessionArgs = { bookingId: string };
type GetDeliverablesCustomerTypeArgs = { bookingId: Id<"bookings"> };
type SaveSessionInstagramHandleArgs = { stripeSessionId: string; instagramHandle: string };
type ArchiveSessionArgs = { bookingId: Id<"bookings">; archived: boolean };
type UpdateSessionPaidStatusArgs = { bookingId: Id<"bookings">; paidRemainingBalance: boolean };
type UpdateSessionEditStatusArgs = {
	bookingId: Id<"bookings">;
	editStatus: "to_edit" | "editing" | "review" | "completed";
};
type SubmitSessionForReviewArgs = {
	bookingId: Id<"bookings">;
	driveLink: string;
	clientNotes: string;
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
		okOrThrow(
			ctx.db
				.query("driveSessions")
				.withIndex("by_bookingId", (query) => query.eq("bookingId", args.bookingId))
				.unique()
		).map(buildDriveStatus)
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
		.map((bookingsPage) => ({
			...bookingsPage,
			page: bookingsPage.page.filter(isEditorVisibleSession).map(buildEditorSessionProjection)
		}));
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
	const bookingsPage = await ctx.db
		.query("bookings")
		.withIndex("by_pendingPaymentCreatedAt")
		.order("desc")
		.paginate(args.paginationOpts);

	const page = await Promise.all(
		bookingsPage.page.map(async (session) => {
			if (!session.multiBookingPackageId) {
				return session;
			}

			const multiBookingPackage = await ctx.db.get(session.multiBookingPackageId);
			if (!multiBookingPackage) return session;
			const packageSessions = await getCapacityConsumingPackageSessions(
				ctx,
				multiBookingPackage._id,
				multiBookingPackage.packageSize
			);

			return {
				...session,
				multiBookingInvoiceNumber: formatBookingInvoiceNumber(
					multiBookingPackage._id,
					multiBookingPackage.createdAt
				),
				multiBookingPackageSize: multiBookingPackage.packageSize,
				multiBookingPackageSessionPosition: sessionConsumesPackageCapacity(session)
					? packageSessions.findIndex(({ _id }) => _id === session._id) + 1
					: undefined
			};
		})
	);

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
				ctx.db.patch(session._id, { instagramHandle: args.instagramHandle }).then(() => null)
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
			okOrThrow(
				ctx.db
					.patch(args.bookingId, { hiddenAt: args.archived ? Date.now() : undefined })
					.then(() => null)
			)
		);
}

export function updateSessionPaidStatusService(
	ctx: MutationCtx,
	args: UpdateSessionPaidStatusArgs
) {
	return requirePermission(ctx, "update:payment-status")
		.andThen(() => getSessionFromDb(ctx, args.bookingId))
		.andThen((session) =>
			okOrThrow(
				ctx.db
					.patch(session._id, { paidRemainingBalance: args.paidRemainingBalance })
					.then(() => null)
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

export function submitSessionForReviewService(ctx: MutationCtx, args: SubmitSessionForReviewArgs) {
	return requirePermission(ctx, "update:deliverables")
		.andThen((identity) =>
			getSessionFromDb(ctx, args.bookingId).map((session) => ({ identity, session }))
		)
		.andThen(requireDeliverablesOwnership)
		.andThen(requireDeliverablesEligibility)
		.andThen((session) => saveSessionReview(ctx, session, args.driveLink, args.clientNotes));
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
		.andThen((session) => saveSessionEditStatus(ctx, session, args.editStatus));
}

export function markSessionCalendarEventDeletedService(
	ctx: MutationCtx,
	args: MarkSessionCalendarEventDeletedArgs
) {
	return getSessionFromDb(ctx, args.bookingId).andThen(() =>
		okOrThrow(
			ctx.db
				.patch(args.bookingId, {
					bookingFailureCode: undefined,
					googleCalendarId: undefined,
					googleEventId: undefined,
					status: "cancelled"
				})
				.then(() => null)
		)
	);
}
