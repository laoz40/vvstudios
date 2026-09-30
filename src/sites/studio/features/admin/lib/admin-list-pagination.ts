import { DASHBOARD_PAGE_SIZE } from "#studio/features/auth/lib/dashboard-loading-labels";

// Admin search asks Convex for 40 rows per page (inbox scroll stays at DASHBOARD_PAGE_SIZE).
// refineSearch is true when the first search page is not done, so 40 avoids nudging at 21 hits.
export const ADMIN_SEARCH_PAGE_SIZE = 40;

export function adminTablePageSize(hasActiveSearch: boolean) {
	return hasActiveSearch ? ADMIN_SEARCH_PAGE_SIZE : DASHBOARD_PAGE_SIZE;
}
