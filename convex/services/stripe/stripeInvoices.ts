import { okAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { requirePermission } from "#convex/lib/auth";
import { okOrThrow } from "#convex/lib/result";
import {
	archivePackageWhenFullyDone,
	unarchivePackageForNewUnpaidInvoice
} from "#convex/lib/packages/packageArchive";
import {
	archiveSessionWhenFullyDone,
	unarchiveSessionForNewUnpaidInvoice
} from "#convex/lib/sessions/sessionArchive";
import type { StripeInvoiceLineItem } from "#convex/lib/stripe/stripeInvoice";
import {
	applyUnarchiveWhenNewStripeInvoice,
	listStripeInvoicesForBooking,
	listStripeInvoicesForPackage,
	markStripeInvoicePaid,
	recordBookingStripeInvoice,
	recordPackageAdjustmentStripeInvoice,
	recordPackageStripeInvoice
} from "#convex/lib/stripe/stripeInvoices";

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

function recordStripeInvoiceWithPackageUnarchive(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	record: () => ReturnType<typeof recordPackageStripeInvoice>
) {
	return record().andThen((insertResult) =>
		applyUnarchiveWhenNewStripeInvoice(
			insertResult,
			() => okOrThrow(ctx.db.get("packages", packageId)),
			(packageRecord) => unarchivePackageForNewUnpaidInvoice(ctx, packageRecord)
		)
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
	return recordBookingStripeInvoice(ctx, args).andThen((insertResult) =>
		applyUnarchiveWhenNewStripeInvoice(
			insertResult,
			() => okOrThrow(ctx.db.get("bookings", args.bookingId)),
			(booking) => unarchiveSessionForNewUnpaidInvoice(ctx, booking)
		)
	);
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
	return recordStripeInvoiceWithPackageUnarchive(ctx, args.packageId, () =>
		recordPackageStripeInvoice(ctx, args)
	);
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
	return recordStripeInvoiceWithPackageUnarchive(ctx, args.packageId, () =>
		recordPackageAdjustmentStripeInvoice(ctx, args)
	);
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
