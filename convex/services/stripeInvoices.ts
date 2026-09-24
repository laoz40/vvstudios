import { okAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { requirePermission } from "#convex/lib/auth";
import { okOrThrow } from "#convex/lib/result";
import {
	archivePackageWhenFullyDone,
	unarchivePackageForNewUnpaidInvoice
} from "#convex/lib/packageArchive";
import {
	archiveSessionWhenFullyDone,
	unarchiveSessionForNewUnpaidInvoice
} from "#convex/lib/sessionArchive";
import type { StripeInvoiceLineItem } from "#convex/lib/stripeInvoice";
import {
	listStripeInvoicesForBooking,
	listStripeInvoicesForPackage,
	markStripeInvoicePaid,
	recordBookingStripeInvoice,
	recordPackageAdjustmentStripeInvoice,
	recordPackageStripeInvoice
} from "#convex/lib/stripeInvoices";

export function listStripeInvoicesForBookingService(
	ctx: QueryCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return requirePermission(ctx, "view:sensitive-booking-data").andThen(() =>
		listStripeInvoicesForBooking(ctx, args.bookingId)
	);
}

export function listStripeInvoicesForPackageService(
	ctx: QueryCtx,
	args: { packageId: Id<"packages"> }
) {
	return requirePermission(ctx, "view:sensitive-booking-data").andThen(() =>
		listStripeInvoicesForPackage(ctx, args.packageId)
	);
}

export function recordBookingStripeInvoiceService(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		stripeInvoiceId: string;
		lineItems: StripeInvoiceLineItem[];
		requestId: string;
		createdBy?: string;
	}
) {
	return recordBookingStripeInvoice(ctx, args).andThen((insertResult) => {
		if (!insertResult.created) {
			return okAsync(insertResult);
		}

		return okOrThrow(ctx.db.get(args.bookingId)).andThen((booking) => {
			if (booking === null) {
				return okAsync(insertResult);
			}

			return unarchiveSessionForNewUnpaidInvoice(ctx, booking).map(() => insertResult);
		});
	});
}

export function recordPackageStripeInvoiceService(
	ctx: MutationCtx,
	args: {
		packageId: Id<"packages">;
		stripeInvoiceId: string;
		lineItems: StripeInvoiceLineItem[];
		requestId: string;
		createdBy?: string;
	}
) {
	return recordPackageStripeInvoice(ctx, args).andThen((insertResult) => {
		if (!insertResult.created) {
			return okAsync(insertResult);
		}

		return okOrThrow(ctx.db.get(args.packageId)).andThen((packageRecord) => {
			if (packageRecord === null) {
				return okAsync(insertResult);
			}

			return unarchivePackageForNewUnpaidInvoice(ctx, packageRecord).map(() => insertResult);
		});
	});
}

export function recordPackageAdjustmentStripeInvoiceService(
	ctx: MutationCtx,
	args: {
		packageId: Id<"packages">;
		packageAdjustmentId: Id<"packageAdjustments">;
		stripeInvoiceId: string;
		lineItems: StripeInvoiceLineItem[];
		totalAmount: number;
	}
) {
	return recordPackageAdjustmentStripeInvoice(ctx, args).andThen((insertResult) => {
		if (!insertResult.created) {
			return okAsync(insertResult);
		}

		return okOrThrow(ctx.db.get(args.packageId)).andThen((packageRecord) => {
			if (packageRecord === null) {
				return okAsync(insertResult);
			}

			return unarchivePackageForNewUnpaidInvoice(ctx, packageRecord).map(() => insertResult);
		});
	});
}

export function markStripeInvoicePaidService(
	ctx: MutationCtx,
	args: { stripeInvoiceId: string; paidAt: number }
) {
	return markStripeInvoicePaid(ctx, args).andThen((claim) => {
		if (claim.outcome === "not_found") {
			return okAsync(claim);
		}

		return okOrThrow(
			ctx.db
				.query("stripeInvoices")
				.withIndex("by_stripeInvoiceId", (indexQuery) =>
					indexQuery.eq("stripeInvoiceId", args.stripeInvoiceId)
				)
				.unique()
		).andThen((stripeInvoice) => {
			if (stripeInvoice?.bookingId !== undefined) {
				return archiveSessionWhenFullyDone(ctx, stripeInvoice.bookingId, args.paidAt).map(
					() => claim
				);
			}

			if (stripeInvoice?.packageId !== undefined) {
				return archivePackageWhenFullyDone(ctx, stripeInvoice.packageId, args.paidAt).map(
					() => claim
				);
			}

			return okAsync(claim);
		});
	});
}
