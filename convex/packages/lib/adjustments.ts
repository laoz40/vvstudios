import { err, ok } from "neverthrow";
import { okOrThrow } from "#convex/shared/lib/result";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { ADDON_PRICES } from "#/domain/booking/price-constants";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";

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

export function lookupPackageAdjustmentRow(
	ctx: QueryCtx | MutationCtx,
	adjustmentId: Id<"packageAdjustments">
) {
	return okOrThrow(ctx.db.get("packageAdjustments", adjustmentId));
}

export function lookupPackageAdjustmentByPackageId(
	ctx: QueryCtx | MutationCtx,
	packageId: Id<"packages">
) {
	return okOrThrow(
		ctx.db
			.query("packageAdjustments")
			.withIndex("by_packageId", (indexQuery) => indexQuery.eq("packageId", packageId))
			.unique()
	);
}

export function requirePackageAdjustmentInvoiceRow(adjustment: Doc<"packageAdjustments">) {
	if (adjustment.outcome !== "invoice_required") {
		return err({ reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" as const });
	}

	return ok(adjustment);
}

export function requirePackageAdjustmentPaymentEligibility(
	adjustment: Extract<Doc<"packageAdjustments">, { outcome: "invoice_required" }>,
	now: number
) {
	const isSentOrOverdue = adjustment.invoiceEmailStatus === "sent" || now > adjustment.invoiceDueAt;

	if (!isSentOrOverdue) {
		return err({ reason: "PACKAGE_ADJUSTMENT_INVOICE_NOT_SENT" as const });
	}

	return ok(adjustment);
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

export type PackageAdjustmentSession = Pick<
	Doc<"bookings">,
	"_id" | "duration" | "sessionStartAt" | "addons"
>;

export function evaluatePackageAdjustment(
	bookings: PackageAdjustmentSession[],
	now: number
): PackageAdjustmentEvaluation {
	const completedBookings: PackageAdjustmentSession[] = [];
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

	const remotePodcastBookingIds = completedBookings.flatMap((booking) =>
		booking.addons.includes("Remote Podcast") ? [booking._id] : []
	);

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

type ReadyPackageAdjustment = Extract<PackageAdjustmentEvaluation, { kind: "ready" }>;

type PackageAdjustmentRecordArgs = {
	packageId: Id<"packages">;
	trigger: Doc<"packageAdjustments">["trigger"];
	createdAt: number;
};

export function insertNoChargePackageAdjustment(
	ctx: MutationCtx,
	args: PackageAdjustmentRecordArgs
) {
	return okOrThrow(
		ctx.db.insert("packageAdjustments", {
			...args,
			outcome: "no_charge",
			remotePodcastBookingIds: [],
			quantity: 0,
			rate: REMOTE_PODCAST_ADJUSTMENT_RATE,
			totalAmount: 0
		})
	).map(() => null);
}

export function insertPackageAdjustmentInvoice(
	ctx: MutationCtx,
	args: PackageAdjustmentRecordArgs,
	evaluation: ReadyPackageAdjustment
) {
	return okOrThrow(
		ctx.db.insert("packageAdjustments", {
			...args,
			outcome: "invoice_required",
			remotePodcastBookingIds: evaluation.remotePodcastBookingIds,
			quantity: evaluation.quantity,
			rate: REMOTE_PODCAST_ADJUSTMENT_RATE,
			totalAmount: evaluation.totalAmount,
			invoiceNumber: "pending",
			invoiceDueAt: args.createdAt + PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS,
			invoiceEmailStatus: "pending",
			paymentStatus: "unpaid"
		})
	);
}

export function patchPackageAdjustmentInvoiceNumber(
	ctx: MutationCtx,
	adjustmentId: Id<"packageAdjustments">,
	createdAt: number
) {
	return okOrThrow(
		ctx.db.patch("packageAdjustments", adjustmentId, {
			invoiceNumber: formatBookingInvoiceNumber(adjustmentId, createdAt)
		})
	).map(() => adjustmentId);
}

export function patchPackageAdjustmentInvoiceEmailClaimed(
	ctx: MutationCtx,
	adjustmentId: Id<"packageAdjustments">,
	claimedAt: number
) {
	return okOrThrow(
		ctx.db.patch("packageAdjustments", adjustmentId, { invoiceEmailClaimedAt: claimedAt })
	);
}

export function patchPackageAdjustmentInvoiceEmailFailed(
	ctx: MutationCtx,
	adjustmentId: Id<"packageAdjustments">
) {
	return okOrThrow(
		ctx.db
			.patch("packageAdjustments", adjustmentId, {
				invoiceEmailStatus: "failed",
				invoiceEmailClaimedAt: undefined
			})
			.then(() => null)
	);
}

export function patchPackageAdjustmentInvoiceEmailSent(
	ctx: MutationCtx,
	adjustmentId: Id<"packageAdjustments">,
	stripeInvoiceId: string
) {
	return okOrThrow(
		ctx.db
			.patch("packageAdjustments", adjustmentId, {
				invoiceEmailStatus: "sent",
				invoiceEmailClaimedAt: undefined,
				stripeInvoiceId
			})
			.then(() => ({ updated: true }))
	);
}

export function patchPackageAdjustmentPaymentStatus(
	ctx: MutationCtx,
	adjustmentId: Id<"packageAdjustments">,
	paymentStatus: "paid" | "unpaid"
) {
	return okOrThrow(
		ctx.db.patch("packageAdjustments", adjustmentId, { paymentStatus }).then(() => null)
	);
}
