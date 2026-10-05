import type { ResultAsync as NeverthrowResultAsync } from "neverthrow";
import { bytesToHex } from "#convex/lib/crypto/bytesToHex";
import { externalPromise } from "#convex/lib/result";

export function getBookingSubmitRateLimitKey(email: string): NeverthrowResultAsync<string, never> {
	const encodedEmail = new TextEncoder().encode(email.trim().toLowerCase());

	return externalPromise(
		crypto.subtle
			.digest("SHA-256", encodedEmail)
			.then((hashBuffer) => `email:${bytesToHex(new Uint8Array(hashBuffer))}`)
	);
}
