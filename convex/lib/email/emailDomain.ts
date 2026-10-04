"use node";

import type { ResultAsync } from "neverthrow";
import { resolveMx } from "node:dns/promises";
import { liftPromise } from "#convex/lib/result";

export function emailDomainCanReceiveMailAsync(email: string): ResultAsync<boolean, never> {
	return liftPromise(emailDomainCanReceiveMail(email));
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
