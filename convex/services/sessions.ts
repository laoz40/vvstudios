import { ConvexError } from "convex/values";
import { err, errAsync, ok } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { getAdminIdentity } from "#convex/lib/auth";
import {
	getCapacityConsumingPackageSessions,
	sessionConsumesPackageCapacity
} from "#convex/lib/packageScheduling";
import { okOrThrow } from "#convex/lib/result";
import { getSessionByStripeSessionId, getSessionFromDb } from "#convex/lib/sessionLookup";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";

type ListSessionsArgs = { paginationOpts: { numItems: number; cursor: string | null } };
type GetPublicRescheduleCompleteSessionArgs = { bookingId: string };
type SaveSessionInstagramHandleArgs = { stripeSessionId: string; instagramHandle: string };
type ArchiveSessionArgs = { bookingId: Id<"bookings">; archived: boolean };
type UpdateSessionPaidStatusArgs = { bookingId: Id<"bookings">; paidRemainingBalance: boolean };
type UpdateSessionEditStatusArgs = {
	bookingId: Id<"bookings">;
	editStatus: "to_edit" | "editing" | "completed";
};
type MarkSessionCalendarEventDeletedArgs = { bookingId: Id<"bookings"> };

export async function listSessionsService(ctx: QueryCtx, args: ListSessionsArgs) {
	await getAdminIdentity(ctx).match(
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

export function archiveSessionService(ctx: MutationCtx, args: ArchiveSessionArgs) {
	return getAdminIdentity(ctx)
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
	return getAdminIdentity(ctx)
		.andThen(() => getSessionFromDb(ctx, args.bookingId))
		.andThen((session) =>
			okOrThrow(
				ctx.db
					.patch(session._id, { paidRemainingBalance: args.paidRemainingBalance })
					.then(() => null)
			)
		);
}

export function updateSessionEditStatusService(
	ctx: MutationCtx,
	args: UpdateSessionEditStatusArgs
) {
	return getAdminIdentity(ctx)
		.andThen(() => getSessionFromDb(ctx, args.bookingId))
		.andThen((session) =>
			okOrThrow(ctx.db.patch(session._id, { editStatus: args.editStatus }).then(() => null))
		);
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
