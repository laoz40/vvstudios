import { err, errAsync, ok } from "neverthrow";
import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, internalQuery, query } from "#convex/_generated/server";
import {
	buildPublicPackageStatusResponse,
	validatePackageExpiry,
	validatePendingPackageAbandonment,
	type AbandonPendingPackageSuccess
} from "#convex/lib/packages/packageCheckout";
import {
	getPackageCheckoutClaimStatus,
	validatePackageClaimStripeSession
} from "#convex/lib/packages/packageCheckoutClaim";
import { archiveDeadPackage } from "#convex/lib/packages/packageArchive";
import { getPackageFromDb } from "#convex/lib/packages/packageLookup";
import { okOrThrow } from "#convex/lib/result";

export const setPackageStripeSessionId = internalMutation({
	args: { packageId: v.id("packages"), stripeSessionId: v.string(), stripeCustomerId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db.patch("packages", args.packageId, {
			stripeSessionId: args.stripeSessionId,
			stripeCustomerId: args.stripeCustomerId
		});
	}
});

export const claimPackageCheckoutPayment = internalMutation({
	args: {
		packageId: v.string(),
		stripeSessionId: v.string(),
		stripePaymentIntentId: v.optional(v.string())
	},
	handler: (ctx, args) => {
		const normalizedPackageId = ctx.db.normalizeId("packages", args.packageId);

		if (!normalizedPackageId) {
			return errAsync({ reason: "PACKAGE_NOT_FOUND" as const }).match(tupleOk, tupleErr);
		}

		return getPackageFromDb(ctx, normalizedPackageId)
			.andThen((packageFromDb) =>
				validatePackageClaimStripeSession(packageFromDb, args.stripeSessionId).map(
					() => packageFromDb
				)
			)
			.andThen((packageFromDb) =>
				getPackageCheckoutClaimStatus(packageFromDb).map((claimStatus) => ({
					claimStatus,
					packageFromDb
				}))
			)
			.andThen(({ claimStatus, packageFromDb }) => {
				const packageId = packageFromDb._id;

				if (claimStatus.kind === "already_completed") {
					return ok({ outcome: "already_completed" as const, packageId });
				}

				if (claimStatus.kind === "already_claimed") {
					return ok({ outcome: "already_claimed" as const, packageId });
				}

				const now = Date.now();

				return okOrThrow(
					ctx.db
						.patch("packages", packageFromDb._id, {
							packageCheckoutClaimedAt: now,
							stripePaymentIntentId: args.stripePaymentIntentId
						})
						.then(() => ({ outcome: "claimed" as const, packageId }))
				);
			})
			.match(tupleOk, tupleErr);
	}
});

export const abandonPendingPackage = internalMutation({
	args: { packageId: v.id("packages"), stripeSessionId: v.string() },
	handler: (ctx, args) =>
		getPackageFromDb(ctx, args.packageId)
			.andThen((packageFromDb) =>
				validatePendingPackageAbandonment(packageFromDb, args.stripeSessionId)
			)
			.andThen((abandonDecision) => {
				if (abandonDecision.kind === "complete") {
					return ok(abandonDecision.value);
				}

				return archiveDeadPackage(ctx, args.packageId, { status: "abandoned" }).map(
					(): AbandonPendingPackageSuccess => ({ outcome: "abandoned" })
				);
			})
			.orElse((error) =>
				error.reason === "PACKAGE_NOT_FOUND" ? ok({ outcome: "not_found" as const }) : err(error)
			)
			.match(tupleOk, tupleErr)
});

export const markPackageExpiredByStripeSessionId = internalMutation({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) =>
		okOrThrow(
			ctx.db
				.query("packages")
				.withIndex("by_stripeSessionId", (indexQuery) =>
					indexQuery.eq("stripeSessionId", args.stripeSessionId)
				)
				.unique()
		)
			.andThen(validatePackageExpiry)
			.andThen((expireDecision) => {
				if (expireDecision.kind === "complete") {
					return ok({ alreadyExpired: expireDecision.alreadyExpired });
				}

				return archiveDeadPackage(ctx, expireDecision.packageId, { status: "expired" }).map(() => ({
					alreadyExpired: false
				}));
			})
			.match(tupleOk, tupleErr)
});

export const getPackageByStripeSessionId = internalQuery({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("packages")
			.withIndex("by_stripeSessionId", (indexQuery) =>
				indexQuery.eq("stripeSessionId", args.stripeSessionId)
			)
			.unique();
	}
});

export const getPackageStatusByStripeSessionId = query({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) => {
		const packageFromDb = await ctx.db
			.query("packages")
			.withIndex("by_stripeSessionId", (indexQuery) =>
				indexQuery.eq("stripeSessionId", args.stripeSessionId)
			)
			.unique();

		if (!packageFromDb) return null;

		return buildPublicPackageStatusResponse(packageFromDb);
	}
});
