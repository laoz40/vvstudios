import type { ResultAsync as NeverthrowResultAsync } from "neverthrow";
import { bytesToHex } from "#convex/shared/lib/crypto/bytesToHex";
import { okOrThrow } from "#convex/shared/lib/result";

export function getBookingSubmitRateLimitKey(email: string): NeverthrowResultAsync<string, never> {
	const encodedEmail = new TextEncoder().encode(email.trim().toLowerCase());

	return okOrThrow(
		crypto.subtle
			.digest("SHA-256", encodedEmail)
			.then((hashBuffer) => `email:${bytesToHex(new Uint8Array(hashBuffer))}`)
	);
}
