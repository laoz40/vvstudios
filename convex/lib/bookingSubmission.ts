"use node";

import { createHash } from "node:crypto";
import { resolveMx } from "node:dns/promises";

export function getBookingSubmitRateLimitKey(email: string) {
	return `email:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}`;
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
