import { okAsync } from "neverthrow";
import type { QuantityTrackedAddon } from "#/domain/booking/addon-quantities";
import {
	getRevisionAddonRule,
	isEditRevisionEligible,
	type DeliverablesRevisionInfo
} from "#/domain/revisions/rules";
import { exhaustiveCheck } from "#/lib/result";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { bytesToHex } from "#convex/shared/lib/crypto/bytesToHex";
import { okOrThrow } from "#convex/shared/lib/result";

const FEEDBACK_TOKEN_BYTE_LENGTH = 32;

type FeedbackLinkLookup =
	| { kind: "ineligible" }
	| { kind: "existing"; token: string }
	| { kind: "missing" };

function generateFeedbackToken() {
	const bytes = new Uint8Array(FEEDBACK_TOKEN_BYTE_LENGTH);
	crypto.getRandomValues(bytes);

	return bytesToHex(bytes);
}

function getClientFeedbackUrlForToken(token: string) {
	return new URL(
		`/revisions/${encodeURIComponent(token)}`,
		new URL(env.STRIPE_CHECKOUT_RETURN_URL).origin
	).toString();
}

export function buildDeliverablesRevisionInfo(edit?: {
	addOn: QuantityTrackedAddon;
	feedbackToken?: string;
}): DeliverablesRevisionInfo | undefined {
	if (edit?.feedbackToken === undefined) {
		return undefined;
	}

	const rule = getRevisionAddonRule(edit.addOn);

	return {
		feedbackUrl: getClientFeedbackUrlForToken(edit.feedbackToken),
		freeRounds: rule.freeRounds,
		scopeSummary: rule.scope === "corrections_only" ? rule.scopeSummary : undefined,
		requiresClipNumber: rule.requiresClipNumber
	};
}

export function loadFeedbackLinkForEligibleEdit(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	edit: Doc<"edits">
) {
	if (!isEditRevisionEligible(session, edit)) {
		return okAsync<FeedbackLinkLookup>({ kind: "ineligible" });
	}

	return okOrThrow(
		ctx.db
			.query("sessionFeedbackLinks")
			.withIndex("by_bookingId", (q) => q.eq("bookingId", session._id))
			.first()
	).map<FeedbackLinkLookup>((existing) =>
		existing === null ? { kind: "missing" } : { kind: "existing", token: existing.token }
	);
}

export function createFeedbackLinkIfMissing(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	lookup: FeedbackLinkLookup
) {
	switch (lookup.kind) {
		case "ineligible":
			return okAsync<string | undefined>(undefined);
		case "existing":
			return okAsync<string | undefined>(lookup.token);
		case "missing": {
			const token = generateFeedbackToken();

			return okOrThrow(
				ctx.db.insert("sessionFeedbackLinks", { bookingId, token, createdAt: Date.now() })
			).map<string | undefined>(() => token);
		}

		default:
			return exhaustiveCheck(lookup);
	}
}

export function loadFeedbackLinkByToken(ctx: QueryCtx, token: string) {
	return okOrThrow(
		ctx.db
			.query("sessionFeedbackLinks")
			.withIndex("by_token", (q) => q.eq("token", token))
			.unique()
	);
}

export function listSessionRevisionRounds(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return okOrThrow(
		ctx.db
			.query("revisionRounds")
			.withIndex("by_bookingId", (q) => q.eq("bookingId", bookingId))
			.collect()
	);
}
