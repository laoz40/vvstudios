import type { SortingState } from "@tanstack/react-table";

const ADMIN_DASHBOARD_STORAGE_KEYS = {
	sorting: "vvstudios.adminDashboard.sorting",
	showStaleBookings: "vvstudios.adminDashboard.showStaleBookings",
	showUpcomingOnly: "vvstudios.adminDashboard.showUpcomingOnly",
} as const;

export const DEFAULT_ADMIN_DASHBOARD_SORTING: SortingState = [{ id: "session", desc: false }];
export const DEFAULT_SHOW_STALE_BOOKINGS = true;
export const DEFAULT_SHOW_UPCOMING_ONLY = true;

const sortableColumnIds = new Set(["name", "session", "createdAt"]);

function getAdminDashboardStorage() {
	return typeof window === "undefined" ? null : window.localStorage;
}

function readStoredBoolean(key: string, fallback: boolean) {
	const value = getAdminDashboardStorage()?.getItem(key);

	if (value === "true") {
		return true;
	}

	if (value === "false") {
		return false;
	}

	return fallback;
}

export function readStoredAdminDashboardSorting() {
	const value = getAdminDashboardStorage()?.getItem(ADMIN_DASHBOARD_STORAGE_KEYS.sorting);

	if (!value) {
		return DEFAULT_ADMIN_DASHBOARD_SORTING;
	}

	try {
		const parsedValue: unknown = JSON.parse(value);

		if (!Array.isArray(parsedValue)) {
			return DEFAULT_ADMIN_DASHBOARD_SORTING;
		}

		const storedSorting = parsedValue.filter(
			(sort): sort is SortingState[number] =>
				typeof sort === "object" &&
				sort !== null &&
				"id" in sort &&
				typeof sort.id === "string" &&
				sortableColumnIds.has(sort.id) &&
				("desc" in sort ? typeof sort.desc === "boolean" : true),
		);

		return storedSorting.length > 0 ? storedSorting : DEFAULT_ADMIN_DASHBOARD_SORTING;
	} catch {
		return DEFAULT_ADMIN_DASHBOARD_SORTING;
	}
}

export function readStoredShowUpcomingOnly() {
	return readStoredBoolean(
		ADMIN_DASHBOARD_STORAGE_KEYS.showUpcomingOnly,
		DEFAULT_SHOW_UPCOMING_ONLY,
	);
}

export function readStoredShowStaleBookings() {
	return readStoredBoolean(
		ADMIN_DASHBOARD_STORAGE_KEYS.showStaleBookings,
		DEFAULT_SHOW_STALE_BOOKINGS,
	);
}

export function storeAdminDashboardSorting(sorting: SortingState) {
	getAdminDashboardStorage()?.setItem(
		ADMIN_DASHBOARD_STORAGE_KEYS.sorting,
		JSON.stringify(sorting),
	);
}

export function storeShowUpcomingOnly(showUpcomingOnly: boolean) {
	getAdminDashboardStorage()?.setItem(
		ADMIN_DASHBOARD_STORAGE_KEYS.showUpcomingOnly,
		String(showUpcomingOnly),
	);
}

export function storeShowStaleBookings(showStaleBookings: boolean) {
	getAdminDashboardStorage()?.setItem(
		ADMIN_DASHBOARD_STORAGE_KEYS.showStaleBookings,
		String(showStaleBookings),
	);
}
