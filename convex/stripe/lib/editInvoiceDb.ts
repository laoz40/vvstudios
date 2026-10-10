import { okAsync, ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { QueryCtx, MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";

export type EditInvoiceTarget =
	| { kind: "booking"; bookingId: Id<"bookings"> }
	| { kind: "package"; packageId: Id<"packages"> };

export function loadEditInvoiceRecord(
	ctx: QueryCtx,
	target: EditInvoiceTarget
): ResultAsync<Doc<"bookings"> | Doc<"packages"> | null, never> {
	return target.kind === "booking"
		? okOrThrow(ctx.db.get("bookings", target.bookingId))
		: okOrThrow(ctx.db.get("packages", target.packageId));
}

export function listPackageBookingsForEditInvoice(ctx: QueryCtx, packageId: Id<"packages">) {
	return ResultAsync.combine(
		(["confirmed", "email_failed"] as const).map((status) =>
			okOrThrow(
				ctx.db
					.query("bookings")
					.withIndex("by_packageId_and_status_and_sessionStartAt", (q) =>
						q.eq("packageId", packageId).eq("status", status)
					)
					.take(13)
			)
		)
	).map((groups) => groups.flat());
}

export function listCheckoutPaymentPage(
	ctx: QueryCtx,
	table: "bookings" | "packages",
	cursor: string | null
) {
	return okOrThrow(ctx.db.query(table).paginate({ numItems: 100, cursor }));
}

export function patchOriginalPaidAmount(
	ctx: MutationCtx,
	record: Doc<"bookings"> | Doc<"packages">,
	amount: number
) {
	return "packageSize" in record
		? okOrThrow(
				ctx.db.patch("packages", record._id, { originalPaidAmount: amount }).then(() => null)
			)
		: okOrThrow(
				ctx.db.patch("bookings", record._id, { originalPaidAmount: amount }).then(() => null)
			);
}

export function cacheOriginalPaymentIfMissing(
	ctx: MutationCtx,
	record: Doc<"bookings"> | Doc<"packages"> | null,
	args: { amount: number; stripeSessionId: string }
) {
	if (!record) return okAsync(null);

	if (record.stripeSessionId !== args.stripeSessionId) return okAsync(null);

	if (record.originalPaidAmount !== undefined) return okAsync(null);

	return patchOriginalPaidAmount(ctx, record, args.amount);
}
