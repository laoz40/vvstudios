import { ResultAsync, type ResultAsync as NeverthrowResultAsync } from "neverthrow";

const hexRadix = 16;

const hexByteLength = 2;

function bytesToHex(bytes: Uint8Array) {
	return Array.from(bytes, (byte) => byte.toString(hexRadix).padStart(hexByteLength, "0")).join("");
}

export function getBookingSubmitRateLimitKey(email: string): NeverthrowResultAsync<string, never> {
	const encodedEmail = new TextEncoder().encode(email.trim().toLowerCase());

	return ResultAsync.fromSafePromise(
		crypto.subtle
			.digest("SHA-256", encodedEmail)
			.then((hashBuffer) => `email:${bytesToHex(new Uint8Array(hashBuffer))}`)
	);
}
