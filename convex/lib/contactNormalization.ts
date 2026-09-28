export function normalizePhone(phone: string): string {
	const digits = phone.replace(/\D/g, "");

	if (digits.startsWith("61") && digits.length >= 11) {
		return `0${digits.slice(2)}`;
	}

	return digits;
}

export function normalizeAbn(abn: string): string {
	return abn.replace(/\D/g, "");
}

export function contactNormalizedIndexFields(phone: string) {
	return { phoneNormalized: normalizePhone(phone) };
}

export function normalizeInstagramSearchQuery(query: string): string {
	return query.trim().replace(/^@/, "").toLowerCase();
}

export function instagramHandleMatchesQuery(
	storedHandle: string | undefined,
	query: string
): boolean {
	if (storedHandle === undefined || storedHandle.length === 0) {
		return false;
	}

	const normalizedQuery = normalizeInstagramSearchQuery(query);

	return storedHandle.toLowerCase().includes(normalizedQuery);
}
