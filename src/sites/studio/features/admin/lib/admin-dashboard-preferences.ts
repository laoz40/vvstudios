import type { AdminPackageFilters } from "#studio/features/admin/lib/admin-packages";
import type { SessionSortId, SessionSorting } from "#studio/features/admin/lib/admin-sessions";

const ADMIN_DASHBOARD_PREFERENCES_KEY = "vvstudios.adminDashboard.preferences";

const DEFAULT_PACKAGE_FILTERS: AdminPackageFilters = {
	showArchived: false,
	showOverdue: false,
	showPaid: false,
	showUpcoming: false,
	searchQuery: ""
};

const DEFAULT_SESSIONS_TABLE_PREFERENCES: SessionsTablePreferences = {
	sorting: [{ id: "session", desc: false }],
	showArchived: false,
	showStaleBookings: true,
	showUpcomingOnly: true
};

const sortableColumnIds = new Set(["name", "session", "createdAt"]);

type SessionsTablePreferences = {
	sorting: SessionSorting;
	showArchived: boolean;
	showStaleBookings: boolean;
	showUpcomingOnly: boolean;
};

type AdminDashboardPreferences = {
	packages?: Record<string, unknown>;
	sessions?: Record<string, unknown>;
};

function getAdminDashboardStorage() {
	return typeof window === "undefined" ? null : window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function parseStoredBoolean(value: unknown) {
	return typeof value === "boolean" ? value : undefined;
}

function parseStoredSorting(value: unknown) {
	if (!Array.isArray(value)) {
		return undefined;
	}

	const storedSorting = value.filter(
		(sort): sort is SessionSorting[number] =>
			isRecord(sort) &&
			isSessionSortId(sort.id) &&
			("desc" in sort ? typeof sort.desc === "boolean" : true)
	);

	return storedSorting.length > 0 ? storedSorting : undefined;
}

function isSessionSortId(id: unknown): id is SessionSortId {
	return typeof id === "string" && sortableColumnIds.has(id);
}

function readAdminDashboardPreferences(): AdminDashboardPreferences {
	const value = getAdminDashboardStorage()?.getItem(ADMIN_DASHBOARD_PREFERENCES_KEY);

	if (!value) {
		return {};
	}

	try {
		const parsedValue: unknown = JSON.parse(value);

		if (!isRecord(parsedValue)) {
			return {};
		}

		return {
			packages: isRecord(parsedValue.packages) ? parsedValue.packages : undefined,
			sessions: isRecord(parsedValue.sessions) ? parsedValue.sessions : undefined
		};
	} catch {
		return {};
	}
}

function storeAdminDashboardPreferences(preferences: AdminDashboardPreferences) {
	getAdminDashboardStorage()?.setItem(ADMIN_DASHBOARD_PREFERENCES_KEY, JSON.stringify(preferences));
}

export function readStoredPackageTableFilters(): AdminPackageFilters {
	const storedFilters = readAdminDashboardPreferences().packages;

	return {
		...DEFAULT_PACKAGE_FILTERS,
		showArchived: parseStoredBoolean(storedFilters?.showArchived) ?? false,
		showOverdue: parseStoredBoolean(storedFilters?.showOverdue) ?? false,
		showPaid: parseStoredBoolean(storedFilters?.showPaid) ?? false,
		showUpcoming: parseStoredBoolean(storedFilters?.showUpcoming) ?? false
	};
}

export function storePackageTableFilters(filters: AdminPackageFilters) {
	storeAdminDashboardPreferences({ ...readAdminDashboardPreferences(), packages: filters });
}

export function readStoredSessionsTablePreferences(): SessionsTablePreferences {
	const storedPreferences = readAdminDashboardPreferences().sessions;

	if (!storedPreferences) {
		return DEFAULT_SESSIONS_TABLE_PREFERENCES;
	}

	return {
		sorting:
			parseStoredSorting(storedPreferences.sorting) ?? DEFAULT_SESSIONS_TABLE_PREFERENCES.sorting,
		showArchived: parseStoredBoolean(storedPreferences.showArchived) ?? false,
		showStaleBookings: parseStoredBoolean(storedPreferences.showStaleBookings) ?? true,
		showUpcomingOnly: parseStoredBoolean(storedPreferences.showUpcomingOnly) ?? true
	};
}

export function storeSessionsTableFilters(preferences: SessionsTablePreferences) {
	storeAdminDashboardPreferences({ ...readAdminDashboardPreferences(), sessions: preferences });
}
