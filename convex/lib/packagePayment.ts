import { err, ok, ResultAsync } from "neverthrow";
import { api, internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { PackageLookupError, PaidPackageResult } from "#convex/services/packages";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import { calculatePackageAmounts } from "#studio/features/booking-form/lib/booking-pricing";
import { createPackageInvoiceLineItemSnapshot } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import type { ParsedPackageRequest } from "#convex/lib/packageUpdates";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";
import { sendPackageInvoiceEmail, sendPackageScheduleEmail } from "#convex/lib/email";

type PackageScheduleEmailArgs = Parameters<typeof sendPackageScheduleEmail>[0];

type PackageScheduleEmailResult = ResultAsync<
	null,
	| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED_AND_STATUS_UPDATE_FAILED" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_SENT_STATUS_UPDATE_FAILED" }
>;

export function buildPackageScheduleUrl(baseUrl: string, token: string) {
	const url = new URL(`/package-schedule/${encodeURIComponent(token)}`, baseUrl);

	return url.toString();
}

type PackageInvoiceInput = Parameters<typeof sendPackageInvoiceEmail>[0];

export function createPendingPackage(
	ctx: ActionCtx,
	args: ParsedPackageRequest
): ResultAsync<PackageInvoiceInput, never> {
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

	return okOrThrow(
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

export function sendPackageInvoice(ctx: ActionCtx, packageFromDb: PackageInvoiceInput) {
	return okOrThrow<BookingAvailabilitySettings>(ctx.runQuery(api.bookingSettings.get, {}))
		.andThen((bookingSettings) =>
			okOrThrow(
				sendPackageInvoiceEmail(packageFromDb, { leadTimeMinutes: bookingSettings.leadTimeMinutes })
			).andThen((emailResult) => emailResult)
		)
		.map((emailResult) => ({
			packageId: packageFromDb._id,
			invoiceNumber: emailResult.invoiceNumber,
			status: "sent" as const
		}))
		.orElse((emailError) =>
			ok({
				packageId: packageFromDb._id,
				status: "failed" as const,
				failureCode: emailError.reason
			})
		)
		.andThen((emailAttempt) =>
			fromConvexTuple(
				ctx.runMutation(internal.packages.markPackageInvoiceEmailAttempt, emailAttempt)
			).map(() => emailAttempt.status)
		);
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

export function sendAndRecordPackageScheduleEmail(
	ctx: ActionCtx,
	packageId: Id<"packages">,
	email: PackageScheduleEmailArgs
): PackageScheduleEmailResult {
	return ResultAsync.fromSafePromise(sendPackageScheduleEmail(email)).andThen((emailResult) => {
		if (emailResult.isErr()) {
			// Record the failed email so an admin can retry the paid package lifecycle.
			return recordPackageScheduleEmailAttempt(ctx, packageId, "failed")
				.mapErr(() => ({
					reason: "PACKAGE_SCHEDULE_EMAIL_FAILED_AND_STATUS_UPDATE_FAILED" as const
				}))
				.andThen(() => err({ reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" as const }));
		}

		// Translate a failed status write into the workflow error the admin can act on.
		return recordPackageScheduleEmailAttempt(ctx, packageId, "sent").mapErr(() => ({
			reason: "PACKAGE_SCHEDULE_EMAIL_SENT_STATUS_UPDATE_FAILED" as const
		}));
	});
}

function recordPackageScheduleEmailAttempt(
	ctx: ActionCtx,
	packageId: Id<"packages">,
	status: "sent" | "failed"
): ResultAsync<null, { reason: "PACKAGE_NOT_FOUND" }> {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.markPackageScheduleEmailAttempt, { packageId, status })
	);
}
