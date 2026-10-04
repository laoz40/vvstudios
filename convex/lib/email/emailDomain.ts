"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import { resolveMx } from "node:dns/promises";
import { okOrThrow } from "#convex/lib/result";

export function emailDomainCanReceiveMailAsync(email: string): ResultAsync<boolean, never> {
	const domain = email.trim().toLowerCase().split("@").at(-1);

	if (!domain) {
		return okAsync(false);
	}

	return okOrThrow(
		resolveMx(domain)
			.then((mxRecords) => mxRecords.length > 0)
			.catch(() => false)
	);
}

export async function emailDomainCanReceiveMail(email: string) {
	return emailDomainCanReceiveMailAsync(email).match(
		(canReceiveMail) => canReceiveMail,
		() => false
	);
}
