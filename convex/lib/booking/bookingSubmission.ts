import type { ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";

const hexRadix = 16;

const hexByteLength = 2;

function bytesToHex(bytes: Uint8Array) {
	return Array.from(bytes, (byte) => byte.toString(hexRadix).padStart(hexByteLength, "0")).join("");
}

export function getBookingSubmitRateLimitKey(email: string): ResultAsync<string, never> {
	const encodedEmail = new TextEncoder().encode(email.trim().toLowerCase());

	return okOrThrow(
		crypto.subtle
			.digest("SHA-256", encodedEmail)
			.then((hashBuffer) => `email:${bytesToHex(new Uint8Array(hashBuffer))}`)
	);
}

export function checkPackageSubmitRateLimit(ctx: ActionCtx, email: string) {
	return getBookingSubmitRateLimitKey(email).andThen((submitRateLimitKey) =>
		fromConvexTuple(
			ctx.runMutation(internal.packages.checkPackageSubmitRateLimit, { submitRateLimitKey })
		)
	);
}
