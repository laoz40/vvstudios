"use node";

import { resolveMx } from "node:dns/promises";

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
