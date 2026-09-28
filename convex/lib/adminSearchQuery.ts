const ADMIN_SEARCH_PREFIXES = [
	"name",
	"account",
	"email",
	"phone",
	"abn",
	"receipt",
	"ig",
	"editor",
	"date"
] as const;

type AdminSearchPrefix = (typeof ADMIN_SEARCH_PREFIXES)[number];

export type ParsedAdminSearchQuery =
	| { kind: "blob"; text: string }
	| { kind: "name"; value: string }
	| { kind: "account"; value: string }
	| { kind: "email"; value: string }
	| { kind: "phone"; value: string }
	| { kind: "abn"; value: string }
	| { kind: "receipt"; value: string }
	| { kind: "ig"; value: string }
	| { kind: "editor"; value: string }
	| { kind: "date"; value: string };

function isAdminSearchPrefix(value: string): value is AdminSearchPrefix {
	for (const prefix of ADMIN_SEARCH_PREFIXES) {
		if (prefix === value) {
			return true;
		}
	}

	return false;
}

export function parseTrimmedAdminSearchQuery(searchQuery?: string): ParsedAdminSearchQuery | null {
	const trimmed = searchQuery?.trim();

	if (!trimmed) {
		return null;
	}

	return parseAdminSearchQuery(trimmed);
}

export function parseAdminSearchQuery(rawQuery: string): ParsedAdminSearchQuery {
	const trimmed = rawQuery.trim();

	if (trimmed.length === 0) {
		return { kind: "blob", text: "" };
	}

	const colonIndex = trimmed.indexOf(":");

	if (colonIndex === -1) {
		return { kind: "blob", text: trimmed };
	}

	const prefix = trimmed.slice(0, colonIndex).trim().toLowerCase();
	const value = trimmed.slice(colonIndex + 1).trim();

	if (!isAdminSearchPrefix(prefix) || value.length === 0) {
		return { kind: "blob", text: trimmed };
	}

	if (prefix === "email") {
		return { kind: "email", value: value.toLowerCase() };
	}

	if (prefix === "ig") {
		const handle = value.startsWith("@") ? value.slice(1) : value;

		return { kind: "ig", value: handle };
	}

	return { kind: prefix, value };
}
