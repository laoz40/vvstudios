import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { err, err as tupleErr, ok, ok as tupleOk } from "#/lib/result";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import type { Doc, Id } from "./_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	mutation,
	query,
	type MutationCtx,
	type QueryCtx
} from "./_generated/server";
import { getAdminIdentity } from "./lib/auth";
import {
	archiveSessionService,
	markSessionCalendarEventDeletedService,
	saveSessionInstagramHandleService,
	updateSessionEditStatusService,
	updateSessionPaidStatusService
} from "./services/sessions";
import {
	sessionConsumesPackageCapacity,
	getCapacityConsumingPackageSessions
} from "./lib/packageScheduling";

export const getSessionById = internalQuery({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.bookingId);
	}
});

export const listSessions = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: (ctx, args) => listSessionsHandler(ctx, args)
});

async function listSessionsHandler(
	ctx: QueryCtx,
	args: { paginationOpts: { numItems: number; cursor: string | null } }
) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		throw new ConvexError(authError);
	}

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
			const packageBookings = await getCapacityConsumingPackageSessions(
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
					? packageBookings.findIndex(({ _id }) => _id === session._id) + 1
					: undefined
			};
		})
	);

	return { ...bookingsPage, page };
}

function buildPublicSessionStatusResponse(session: Doc<"bookings">) {
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
		clipsPackageQuantity: session.clipsPackageQuantity
	};
}

export const getPublicRescheduleCompleteSession = query({
	args: { bookingId: v.string() },
	handler: (ctx, args) => getPublicRescheduleCompleteSessionHandler(ctx, args)
});

async function getPublicRescheduleCompleteSessionHandler(
	ctx: QueryCtx,
	args: { bookingId: string }
) {
	const bookingId = ctx.db.normalizeId("bookings", args.bookingId);

	if (bookingId === null) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	const session = await ctx.db.get(bookingId);

	if (!session) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	return ok(buildPublicSessionStatusResponse(session));
}

export type GetPublicRescheduleCompleteSessionResult = Awaited<
	ReturnType<typeof getPublicRescheduleCompleteSessionHandler>
>;

export const getSessionStatusByStripeSessionId = query({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) => {
		const session = await ctx.db
			.query("bookings")
			.withIndex("by_stripeSessionId", (indexQuery) =>
				indexQuery.eq("stripeSessionId", args.stripeSessionId)
			)
			.unique();

		if (!session) return null;

		return buildPublicSessionStatusResponse(session);
	}
});

export const saveSessionInstagramHandle = mutation({
	args: { stripeSessionId: v.string(), instagramHandle: v.string() },
	handler: (ctx, args) => saveSessionInstagramHandleHandler(ctx, args)
});

function saveSessionInstagramHandleHandler(
	ctx: MutationCtx,
	args: { stripeSessionId: string; instagramHandle: string }
) {
	return saveSessionInstagramHandleService(ctx, args).match(tupleOk, tupleErr);
}

export type SaveSessionInstagramHandleResult = Awaited<
	ReturnType<typeof saveSessionInstagramHandleHandler>
>;

export const archiveSession = mutation({
	args: { bookingId: v.id("bookings"), archived: v.boolean() },
	handler: (ctx, args) => archiveSessionHandler(ctx, args)
});

function archiveSessionHandler(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; archived: boolean }
) {
	return archiveSessionService(ctx, args).match(tupleOk, tupleErr);
}

export type ArchiveSessionResult = Awaited<ReturnType<typeof archiveSessionHandler>>;

export const updateSessionPaidStatus = mutation({
	args: { bookingId: v.id("bookings"), paidRemainingBalance: v.boolean() },
	handler: (ctx, args) => updateSessionPaidStatusHandler(ctx, args)
});

function updateSessionPaidStatusHandler(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; paidRemainingBalance: boolean }
) {
	return updateSessionPaidStatusService(ctx, args).match(tupleOk, tupleErr);
}

export type UpdateSessionPaidStatusResult = Awaited<
	ReturnType<typeof updateSessionPaidStatusHandler>
>;

export const updateSessionEditStatus = mutation({
	args: {
		bookingId: v.id("bookings"),
		editStatus: v.union(v.literal("to_edit"), v.literal("editing"), v.literal("completed"))
	},
	handler: (ctx, args) => updateSessionEditStatusHandler(ctx, args)
});

function updateSessionEditStatusHandler(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editStatus: "to_edit" | "editing" | "completed" }
) {
	return updateSessionEditStatusService(ctx, args).match(tupleOk, tupleErr);
}

export type UpdateSessionEditStatusResult = Awaited<
	ReturnType<typeof updateSessionEditStatusHandler>
>;

export const markSessionCalendarEventDeleted = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => markSessionCalendarEventDeletedHandler(ctx, args)
});

function markSessionCalendarEventDeletedHandler(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return markSessionCalendarEventDeletedService(ctx, args).match(tupleOk, tupleErr);
}

export type MarkSessionCalendarEventDeletedResult = Awaited<
	ReturnType<typeof markSessionCalendarEventDeletedHandler>
>;
