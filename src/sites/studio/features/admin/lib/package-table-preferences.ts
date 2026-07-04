import type { AdminPackageFilters } from "#studio/features/admin/lib/admin-packages";

const PACKAGE_TABLE_STORAGE_KEYS = {
	hideHidden: "vvstudios.packageDashboard.hideHidden",
	hideOverdue: "vvstudios.packageDashboard.hideOverdue",
	hidePaid: "vvstudios.packageDashboard.hidePaid"
} as const;

const DEFAULT_PACKAGE_FILTERS: AdminPackageFilters = {
	hideHidden: false,
	hideOverdue: false,
	hidePaid: false,
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

export function readStoredPackageTableFilters(): AdminPackageFilters {
	return {
		...DEFAULT_PACKAGE_FILTERS,
		hideHidden: readStoredBoolean(
			PACKAGE_TABLE_STORAGE_KEYS.hideHidden,
			DEFAULT_PACKAGE_FILTERS.hideHidden
		),
		hideOverdue: readStoredBoolean(
			PACKAGE_TABLE_STORAGE_KEYS.hideOverdue,
			DEFAULT_PACKAGE_FILTERS.hideOverdue
		),
		hidePaid: readStoredBoolean(
			PACKAGE_TABLE_STORAGE_KEYS.hidePaid,
			DEFAULT_PACKAGE_FILTERS.hidePaid
		)
	};
}

export function storePackageTableFilters(filters: AdminPackageFilters) {
	const storage = getPackageTableStorage();

	storage?.setItem(PACKAGE_TABLE_STORAGE_KEYS.hideHidden, String(filters.hideHidden));
	storage?.setItem(PACKAGE_TABLE_STORAGE_KEYS.hideOverdue, String(filters.hideOverdue));
	storage?.setItem(PACKAGE_TABLE_STORAGE_KEYS.hidePaid, String(filters.hidePaid));
}
