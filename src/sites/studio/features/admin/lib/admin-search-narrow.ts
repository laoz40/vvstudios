import { parseAdminSearchQuery } from "#convex/lib/adminSearch/adminSearchQuery";

export type AdminSearchNarrowField = { label: string; prefix: string };

export const ADMIN_SESSION_SEARCH_NARROW_FIELDS: AdminSearchNarrowField[] = [
	{ prefix: "name", label: "Name" },
	{ prefix: "account", label: "Account" },
	{ prefix: "email", label: "Email" },
	{ prefix: "phone", label: "Phone" },
	{ prefix: "receipt", label: "Receipt" },
	{ prefix: "ig", label: "IG" },
	{ prefix: "editor", label: "Editor" },
	{ prefix: "abn", label: "ABN" },
	{ prefix: "date", label: "Date" }
];

export const ADMIN_PACKAGE_SEARCH_NARROW_FIELDS: AdminSearchNarrowField[] = [
	{ prefix: "name", label: "Name" },
	{ prefix: "account", label: "Account" },
	{ prefix: "email", label: "Email" },
	{ prefix: "phone", label: "Phone" },
	{ prefix: "receipt", label: "Receipt" },
	{ prefix: "ig", label: "IG" },
	{ prefix: "abn", label: "ABN" }
];

function adminSearchNarrowValue(rawQuery: string): string {
	const trimmed = rawQuery.trim();

	if (trimmed.length === 0) {
		return "";
	}

	const parsed = parseAdminSearchQuery(trimmed);

	if (parsed.kind === "blob") {
		return parsed.text;
	}

	return parsed.value;
}

export function formatAdminSearchNarrowQuery(prefix: string, rawQuery: string): string {
	const value = adminSearchNarrowValue(rawQuery);

	if (value.length === 0) {
		return `${prefix}:`;
	}

	return `${prefix}:${value}`;
}
