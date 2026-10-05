import { ResultAsync, type ResultAsync as NeverthrowResultAsync } from "neverthrow";
import { bytesToHex } from "#convex/lib/crypto/bytesToHex";

export function getBookingSubmitRateLimitKey(email: string): NeverthrowResultAsync<string, never> {
	const encodedEmail = new TextEncoder().encode(email.trim().toLowerCase());

	return ResultAsync.fromSafePromise(
		crypto.subtle
			.digest("SHA-256", encodedEmail)
			.then((hashBuffer) => `email:${bytesToHex(new Uint8Array(hashBuffer))}`)
	);
}
