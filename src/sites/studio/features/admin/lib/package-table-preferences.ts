import type { AdminPackageFilters } from "#studio/features/admin/lib/admin-packages";

const PACKAGE_TABLE_STORAGE_KEYS = {
	showArchived: "vvstudios.packageDashboard.showArchived",
	showOverdue: "vvstudios.packageDashboard.showOverdue",
	showPaid: "vvstudios.packageDashboard.showPaid",
	showUpcoming: "vvstudios.packageDashboard.showUpcoming"
} as const;

const LEGACY_PACKAGE_TABLE_STORAGE_KEYS = {
	hideHidden: "vvstudios.packageDashboard.hideHidden",
	hideOverdue: "vvstudios.packageDashboard.hideOverdue",
	hidePaid: "vvstudios.packageDashboard.hidePaid",
	showOverdue: "vvstudios.packageDashboard.showOverdue",
	showUpcoming: "vvstudios.packageDashboard.showUpcoming"
} as const;

const DEFAULT_PACKAGE_FILTERS: AdminPackageFilters = {
	showArchived: false,
	showOverdue: false,
	showPaid: false,
	showUpcoming: false,
	searchQuery: ""
};

function getPackageTableStorage() {
	return typeof window === "undefined" ? null : window.localStorage;
}

function readStoredBoolean(key: string, fallback: boolean) {
	const value = getPackageTableStorage()?.getItem(key);

	if (value === "true") {
		return true;
	}

	if (value === "false") {
		return false;
	}

	return fallback;
}

function readLegacyDateFilter() {
	const value = getPackageTableStorage()?.getItem("vvstudios.packageDashboard.dateFilter");

	return { showOverdue: value === "overdue", showUpcoming: value === "upcoming" };
}

export function readStoredPackageTableFilters(): AdminPackageFilters {
	const legacyDateFilter = readLegacyDateFilter();

	return {
		...DEFAULT_PACKAGE_FILTERS,
		showArchived: readStoredBoolean(
			PACKAGE_TABLE_STORAGE_KEYS.showArchived,
			!readStoredBoolean(
				LEGACY_PACKAGE_TABLE_STORAGE_KEYS.hideHidden,
				!DEFAULT_PACKAGE_FILTERS.showArchived
			)
		),
		showOverdue: readStoredBoolean(
			PACKAGE_TABLE_STORAGE_KEYS.showOverdue,
			legacyDateFilter.showOverdue ||
				!readStoredBoolean(
					LEGACY_PACKAGE_TABLE_STORAGE_KEYS.hideOverdue,
					!DEFAULT_PACKAGE_FILTERS.showOverdue
				)
		),
		showPaid: readStoredBoolean(
			PACKAGE_TABLE_STORAGE_KEYS.showPaid,
			!readStoredBoolean(
				LEGACY_PACKAGE_TABLE_STORAGE_KEYS.hidePaid,
				!DEFAULT_PACKAGE_FILTERS.showPaid
			)
		),
		showUpcoming: readStoredBoolean(
			PACKAGE_TABLE_STORAGE_KEYS.showUpcoming,
			legacyDateFilter.showUpcoming
		)
	};
}

export function storePackageTableFilters(filters: AdminPackageFilters) {
	const storage = getPackageTableStorage();

	storage?.setItem(PACKAGE_TABLE_STORAGE_KEYS.showArchived, String(filters.showArchived));
	storage?.setItem(PACKAGE_TABLE_STORAGE_KEYS.showOverdue, String(filters.showOverdue));
	storage?.setItem(PACKAGE_TABLE_STORAGE_KEYS.showPaid, String(filters.showPaid));
	storage?.setItem(PACKAGE_TABLE_STORAGE_KEYS.showUpcoming, String(filters.showUpcoming));
}
