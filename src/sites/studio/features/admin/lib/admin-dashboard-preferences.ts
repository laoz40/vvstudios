import { z } from "zod";
import type { AdminPackageFilters } from "#studio/features/admin/lib/admin-packages";
import type { SessionSorting } from "#studio/features/admin/lib/admin-sessions";

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

const sessionSortIdSchema = z.enum(["name", "session", "createdAt"]);

const sessionSortingItemSchema = z.object({
	id: sessionSortIdSchema,
	desc: z.boolean().optional()
});

const storedPackageFiltersSchema = z.object({
	showArchived: z.boolean().optional(),
	showOverdue: z.boolean().optional(),
	showPaid: z.boolean().optional(),
	showUpcoming: z.boolean().optional()
});

const storedSessionsTablePreferencesSchema = z.object({
	sorting: z.array(sessionSortingItemSchema).optional(),
	showArchived: z.boolean().optional(),
	showStaleBookings: z.boolean().optional(),
	showUpcomingOnly: z.boolean().optional()
});

const adminDashboardPreferencesSchema = z.object({
	packages: storedPackageFiltersSchema.optional(),
	privacyMode: z.boolean().optional(),
	sessions: storedSessionsTablePreferencesSchema.optional()
});

type SessionsTablePreferences = {
	sorting: SessionSorting;
	showArchived: boolean;
	showStaleBookings: boolean;
	showUpcomingOnly: boolean;
};

type AdminDashboardPreferences = z.infer<typeof adminDashboardPreferencesSchema>;

function getAdminDashboardStorage() {
	return typeof window === "undefined" ? null : window.localStorage;
}

function readAdminDashboardPreferences(): AdminDashboardPreferences {
	const value = getAdminDashboardStorage()?.getItem(ADMIN_DASHBOARD_PREFERENCES_KEY);

	if (!value) {
		return {};
	}

	try {
		const parsedValue = adminDashboardPreferencesSchema.safeParse(JSON.parse(value));
		return parsedValue.success ? parsedValue.data : {};
	} catch {
		return {};
	}
}

function storeAdminDashboardPreferences(preferences: AdminDashboardPreferences) {
	getAdminDashboardStorage()?.setItem(ADMIN_DASHBOARD_PREFERENCES_KEY, JSON.stringify(preferences));
}

function parseStoredSorting(value: unknown): SessionSorting | undefined {
	const parsedSorting = z.array(sessionSortingItemSchema).safeParse(value);

	if (!parsedSorting.success || parsedSorting.data.length === 0) {
		return undefined;
	}

	return parsedSorting.data.map((sort) => ({ id: sort.id, desc: sort.desc ?? false }));
}

export function readStoredPackageTableFilters(): AdminPackageFilters {
	const storedFilters = readAdminDashboardPreferences().packages;

	return {
		...DEFAULT_PACKAGE_FILTERS,
		showArchived: storedFilters?.showArchived ?? false,
		showOverdue: storedFilters?.showOverdue ?? false,
		showPaid: storedFilters?.showPaid ?? false,
		showUpcoming: storedFilters?.showUpcoming ?? false
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
		showArchived: storedPreferences.showArchived ?? false,
		showStaleBookings: storedPreferences.showStaleBookings ?? true,
		showUpcomingOnly: storedPreferences.showUpcomingOnly ?? true
	};
}

export function storeSessionsTableFilters(preferences: SessionsTablePreferences) {
	storeAdminDashboardPreferences({ ...readAdminDashboardPreferences(), sessions: preferences });
}

export function readStoredPrivacyMode() {
	return readAdminDashboardPreferences().privacyMode ?? false;
}

export function storePrivacyMode(enabled: boolean) {
	storeAdminDashboardPreferences({ ...readAdminDashboardPreferences(), privacyMode: enabled });
}
