import { ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { PackageLookupError } from "#convex/lib/packages/packageLookup";
import { calculatePackageAmounts } from "#studio/features/booking-form/lib/booking-pricing";
import { createPackageInvoiceLineItemSnapshot } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import type { PackageInvoiceInput } from "#studio/features/booking-invoice/lib/booking-artifacts";
import type { ParsedPackageRequest } from "#convex/lib/packages/packageUpdates";
import { fromConvexTuple } from "#convex/lib/result";

export type PaidPackageResult = {
	expiresAt: number;
	paidAt: number;
	packageRecord: Doc<"packages">;
	token: string;
};

export type PackagePaidEmailContext = {
	expiresAt: number;
	leadTimeMinutes: number;
	packageRecord: Doc<"packages">;
	paidAt: number;
	scheduleUrl: string;
};

export function buildPackageScheduleUrl(baseUrl: string, token: string) {
	const url = new URL(`/package-schedule/${encodeURIComponent(token)}`, baseUrl);

	return url.toString();
}

export function createPendingPackage(
	ctx: ActionCtx,
	args: ParsedPackageRequest
): ResultAsync<PackageInvoiceInput & { _id: Id<"packages"> }, never> {
	const amounts = calculatePackageAmounts(args);

	const invoiceLineItems = createPackageInvoiceLineItemSnapshot({
		addons: args.addons,
		clipsPackageQuantity: args.clipsPackageQuantity || undefined,
		completeEditQuantity: args.completeEditQuantity || undefined,
		discountAmount: amounts.discountAmount,
		discountPercent: amounts.discountPercent,
		duration: args.duration,
		essentialEditQuantity: args.essentialEditQuantity || undefined,
		handcraftedClipsQuantity: args.handcraftedClipsQuantity || undefined,
		packageSize: args.packageSize
	});

	return fromConvexTuple(
		ctx.runMutation(internal.packages.createPendingPackage, {
			...args,
			abn: args.abn || undefined,
			clipsPackageQuantity: args.clipsPackageQuantity || undefined,
			completeEditQuantity: args.completeEditQuantity || undefined,
			essentialEditQuantity: args.essentialEditQuantity || undefined,
			handcraftedClipsQuantity: args.handcraftedClipsQuantity || undefined,
			notes: args.notes || undefined,
			...amounts,
			invoiceLineItems
		})
	).map((createResult) => createResult.packageRecord);
}

export function refreshPackageScheduleToken(ctx: ActionCtx, packageId: Id<"packages">) {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.refreshPackageScheduleToken, { packageId })
	);
}

export function markPackagePaid(
	ctx: ActionCtx,
	packageId: Id<"packages">,
	paidAt: number
): ResultAsync<PaidPackageResult, PackageLookupError | { reason: "PACKAGE_ALREADY_PAID" }> {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.markPackagePaidAndCreateScheduleToken, { packageId, paidAt })
	);
}

export function buildPackagePaidEmailContext(
	paymentResult: PaidPackageResult,
	leadTimeMinutes: number,
	origin: string
): PackagePaidEmailContext {
	return {
		expiresAt: paymentResult.expiresAt,
		leadTimeMinutes,
		packageRecord: paymentResult.packageRecord,
		paidAt: paymentResult.paidAt,
		scheduleUrl: buildPackageScheduleUrl(origin, paymentResult.token)
	};
}
