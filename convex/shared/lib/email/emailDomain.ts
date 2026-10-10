"use node";

import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import { resolveMx } from "node:dns/promises";
import { tryPromise } from "#convex/shared/lib/result";

export function emailDomainCanReceiveMailAsync(email: string): ResultAsync<boolean, never> {
	const domain = email.trim().toLowerCase().split("@").at(-1);

	if (!domain) {
		return okAsync(false);
	}

	return tryPromise({
		try: () => resolveMx(domain).then((mxRecords) => mxRecords.length > 0),
		catch: () => false as const
	}).orElse((canReceiveMail) => okAsync(canReceiveMail));
}

export async function emailDomainCanReceiveMail(email: string) {
	return emailDomainCanReceiveMailAsync(email).match(
		(canReceiveMail) => canReceiveMail,
		() => false
	);
}

export function rejectUninvitableEmailDomain(email: string, canReceiveMail: boolean) {
	return canReceiveMail ? okAsync(email) : errAsync({ reason: "EMAIL_DOMAIN_INVALID" as const });
}
