import { err, ok, ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { ADDON_PRICES } from "#studio/features/booking-form/lib/booking-pricing";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import { getCapacityConsumingPackageSessions } from "./packageScheduling";

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
// Prevent concurrent sends; a stalled send becomes failed so an admin can retry it.
export const PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS = 15 * 60 * 1000;
export const PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS = 7 * 24 * MILLISECONDS_PER_HOUR;
export const REMOTE_PODCAST_ADJUSTMENT_RATE = ADDON_PRICES["Remote Podcast"];

export type PackageAdjustmentEmailClaim = { attempt: "automatic" | "retry"; now: number };

export function validatePackageAdjustmentEmailClaim(
	adjustment: Extract<Doc<"packageAdjustments">, { outcome: "invoice_required" }>,
	claim: PackageAdjustmentEmailClaim
) {
	if (adjustment.invoiceEmailStatus === "sent") {
		return err({ reason: "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE" as const });
	}

	const emailSendIsInProgress =
		adjustment.invoiceEmailClaimedAt !== undefined &&
		claim.now - adjustment.invoiceEmailClaimedAt < PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS;

	if (emailSendIsInProgress) {
		return err({ reason: "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE" as const });
	}

	const expectedStatus = claim.attempt === "automatic" ? "pending" : "failed";

	if (adjustment.invoiceEmailStatus !== expectedStatus) {
		return err({ reason: "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE" as const });
	}

	return ok(adjustment);
}

export function getPackageAdjustmentInvoice(
	ctx: QueryCtx | MutationCtx,
	adjustmentId: Id<"packageAdjustments">
) {
	return ResultAsync.fromSafePromise(ctx.db.get(adjustmentId)).andThen((adjustment) => {
		if (!adjustment || adjustment.outcome !== "invoice_required") {
			return err({ reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" as const });
		}

		return ok(adjustment);
	});
}

export function getSentPackageAdjustmentInvoice(
	ctx: QueryCtx | MutationCtx,
	adjustmentId: Id<"packageAdjustments">
) {
	return getPackageAdjustmentInvoice(ctx, adjustmentId).andThen((adjustment) => {
		if (adjustment.invoiceEmailStatus !== "sent") {
			return err({ reason: "PACKAGE_ADJUSTMENT_INVOICE_NOT_SENT" as const });
		}

		return ok(adjustment);
	});
}

type PackageAdjustmentEvaluation =
	| { kind: "wait_for_sessions_to_end"; nextCheckAt: number }
	| { kind: "invalid_duration" }
	| {
			kind: "ready";
			remotePodcastBookingIds: Id<"bookings">[];
			quantity: number;
			totalAmount: number;
	  };

export function evaluatePackageAdjustment(
	bookings: Doc<"bookings">[],
	now: number
): PackageAdjustmentEvaluation {
	const completedBookings: Doc<"bookings">[] = [];
	let latestOngoingSessionEndAt = 0;

	for (const booking of bookings) {
		const sessionEndAt = getPackageSessionEndAt(booking);

		if (sessionEndAt === null) {
			return { kind: "invalid_duration" };
		}

		if (sessionEndAt > now) {
			latestOngoingSessionEndAt = Math.max(latestOngoingSessionEndAt, sessionEndAt);
			continue;
		}

		completedBookings.push(booking);
	}

	if (latestOngoingSessionEndAt > 0) {
		return { kind: "wait_for_sessions_to_end", nextCheckAt: latestOngoingSessionEndAt };
	}

	const remotePodcastBookingIds = completedBookings
		.filter((booking) => booking.addons.includes("Remote Podcast"))
		.map((booking) => booking._id);
	const quantity = remotePodcastBookingIds.length;

	return {
		kind: "ready",
		remotePodcastBookingIds,
		quantity,
		totalAmount: quantity * REMOTE_PODCAST_ADJUSTMENT_RATE
	};
}

function getPackageSessionEndAt(booking: Pick<Doc<"bookings">, "duration" | "sessionStartAt">) {
	switch (booking.duration) {
		case "1h":
			return booking.sessionStartAt + MILLISECONDS_PER_HOUR;
		case "2h":
			return booking.sessionStartAt + 2 * MILLISECONDS_PER_HOUR;
		case "3h":
			return booking.sessionStartAt + 3 * MILLISECONDS_PER_HOUR;
		default:
			return null;
	}
}

export type ProcessPackageAdjustmentArgs =
	| { trigger: "all_sessions_completed"; multiBookingId: Id<"multiBookingPackages"> }
	| {
			trigger: "package_expired";
			multiBookingId: Id<"multiBookingPackages">;
			expectedExpiresAt: number;
	  };

export async function processPackageAdjustment(
	ctx: MutationCtx,
	args: ProcessPackageAdjustmentArgs
) {
	const multiBooking = await getPackageEligibleForAdjustment(ctx, args);

	if (!multiBooking) return null;

	const existingAdjustment = await ctx.db
		.query("packageAdjustments")
		.withIndex("by_multiBookingId", (indexQuery) =>
			indexQuery.eq("multiBookingId", args.multiBookingId)
		)
		.unique();

	if (existingAdjustment) return null;

	const bookings = await getCapacityConsumingPackageSessions(
		ctx,
		multiBooking._id,
		multiBooking.packageSize
	);

	// Closing before expiry requires every package session to be scheduled.
	if (args.trigger === "all_sessions_completed" && bookings.length !== multiBooking.packageSize) {
		return null;
	}

	const now = Date.now();
	return handlePackageAdjustmentEvaluation(
		ctx,
		args,
		evaluatePackageAdjustment(bookings, now),
		now
	);
}

async function getPackageEligibleForAdjustment(
	ctx: MutationCtx,
	args: ProcessPackageAdjustmentArgs
) {
	const multiBooking = await ctx.db.get(args.multiBookingId);

	if (!multiBooking) return null;

	const hasAdjustableStatus =
		multiBooking.status === "paid" || multiBooking.status === "schedule_email_failed";

	if (!hasAdjustableStatus) return null;

	if (args.trigger === "package_expired") {
		// Ignore stale expiry jobs and jobs that run before the package expires.
		if (multiBooking.expiresAt !== args.expectedExpiresAt || Date.now() < args.expectedExpiresAt) {
			return null;
		}
	}

	return multiBooking;
}

async function handlePackageAdjustmentEvaluation(
	ctx: MutationCtx,
	args: ProcessPackageAdjustmentArgs,
	evaluation: ReturnType<typeof evaluatePackageAdjustment>,
	now: number
) {
	switch (evaluation.kind) {
		case "wait_for_sessions_to_end":
			return schedulePackageAdjustmentReevaluation(ctx, args, evaluation.nextCheckAt);
		case "invalid_duration":
			console.error("Package adjustment could not parse a session duration", {
				multiBookingId: args.multiBookingId
			});
			return null;
		case "ready":
			return savePackageAdjustment(ctx, args, evaluation, now);
		default: {
			const _exhaustive: never = evaluation;
			return _exhaustive;
		}
	}
}

async function schedulePackageAdjustmentReevaluation(
	ctx: MutationCtx,
	args: ProcessPackageAdjustmentArgs,
	nextCheckAt: number
) {
	// Re-evaluate when the final session ends.
	if (args.trigger === "package_expired") {
		await ctx.scheduler.runAt(
			nextCheckAt,
			internal.packageScheduling.processPackageAdjustmentAtExpiry,
			args
		);
		return null;
	}

	await ctx.scheduler.runAt(
		nextCheckAt,
		internal.packageScheduling.processPackageAdjustmentWhenSessionsComplete,
		args
	);
	return null;
}

async function savePackageAdjustment(
	ctx: MutationCtx,
	args: ProcessPackageAdjustmentArgs,
	evaluation: Extract<ReturnType<typeof evaluatePackageAdjustment>, { kind: "ready" }>,
	createdAt: number
) {
	if (evaluation.quantity === 0) {
		await ctx.db.insert("packageAdjustments", {
			outcome: "no_charge",
			multiBookingId: args.multiBookingId,
			trigger: args.trigger,
			remotePodcastBookingIds: [],
			quantity: 0,
			rate: REMOTE_PODCAST_ADJUSTMENT_RATE,
			totalAmount: 0,
			createdAt
		});
		return null;
	}

	const adjustmentId = await ctx.db.insert("packageAdjustments", {
		outcome: "invoice_required",
		multiBookingId: args.multiBookingId,
		trigger: args.trigger,
		remotePodcastBookingIds: evaluation.remotePodcastBookingIds,
		quantity: evaluation.quantity,
		rate: REMOTE_PODCAST_ADJUSTMENT_RATE,
		totalAmount: evaluation.totalAmount,
		invoiceNumber: "pending",
		createdAt,
		invoiceDueAt: createdAt + PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS,
		invoiceEmailStatus: "pending",
		paymentStatus: "unpaid"
	});

	await ctx.db.patch(adjustmentId, {
		invoiceNumber: formatBookingInvoiceNumber(adjustmentId, createdAt)
	});
	await ctx.scheduler.runAfter(0, internal.packageAdjustmentInvoices.sendPackageAdjustmentInvoice, {
		adjustmentId,
		attempt: "automatic"
	});
	return null;
}
