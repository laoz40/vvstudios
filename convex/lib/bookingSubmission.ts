"use node";

import { createHash } from "node:crypto";
import { resolveMx } from "node:dns/promises";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/lib/result";

export function getBookingSubmitRateLimitKey(email: string) {
	return `email:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}`;
}

export function checkPackageSubmitRateLimit(ctx: ActionCtx, email: string) {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.checkPackageSubmitRateLimit, {
			submitRateLimitKey: getBookingSubmitRateLimitKey(email)
		})
	);
}

export async function emailDomainCanReceiveMail(email: string) {
	const domain = email.trim().toLowerCase().split("@").at(-1);

	if (!domain) {
		return false;
	}

	try {
		const mxRecords = await resolveMx(domain);
		return mxRecords.length > 0;
	} catch {
		return false;
	}
}
