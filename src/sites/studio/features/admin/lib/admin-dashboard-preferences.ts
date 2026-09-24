import { z } from "zod";
import type {
	AdminPackageSort,
	AdminPackagesView
} from "#studio/features/admin/lib/admin-packages";
import type { AdminSessionsView, SessionSorting } from "#studio/features/admin/lib/admin-sessions";

const ADMIN_DASHBOARD_PREFERENCES_KEY = "vvstudios.adminDashboard.preferences";

const DEFAULT_PACKAGES_TABLE_PREFERENCES: PackagesTablePreferences = {
	sorting: { isDescending: true },
	packagesView: "inbox",
	showStalePackages: false
};

const DEFAULT_SESSIONS_TABLE_PREFERENCES: SessionsTablePreferences = {
	sorting: [{ id: "session", desc: false }],
	sessionsView: "inbox",
	showStaleBookings: true
};

const storedSessionSortIdSchema = z.enum(["name", "session", "createdAt"]);

const sessionSortingItemSchema = z.object({
	id: storedSessionSortIdSchema,
	desc: z.boolean().optional()
});

const storedPackageSortingSchema = z.object({ isDescending: z.boolean().optional() });

const storedPackagesViewSchema = z.enum(["inbox", "all"]);

const storedPackagesTablePreferencesSchema = z.object({
	sorting: storedPackageSortingSchema.optional(),
	packagesView: storedPackagesViewSchema.optional(),
	showArchived: z.boolean().optional(),
	showDueOnly: z.boolean().optional(),
	showOverdue: z.boolean().optional(),
	showStalePackages: z.boolean().optional(),
	showUpcoming: z.boolean().optional()
});

const storedSessionsViewSchema = z.enum(["inbox", "all"]);

const storedSessionsTablePreferencesSchema = z.object({
	sorting: z.array(sessionSortingItemSchema).optional(),
	sessionsView: storedSessionsViewSchema.optional(),
	showArchived: z.boolean().optional(),
	showStaleBookings: z.boolean().optional(),
	showUpcomingOnly: z.boolean().optional()
});

const adminDashboardPreferencesSchema = z.object({
	packages: storedPackagesTablePreferencesSchema.optional(),
	privacyMode: z.boolean().optional(),
	sessions: storedSessionsTablePreferencesSchema.optional()
});

type PackagesTablePreferences = {
	sorting: AdminPackageSort;
	packagesView: AdminPackagesView;
	showStalePackages: boolean;
};

type SessionsTablePreferences = {
	sorting: SessionSorting;
	sessionsView: AdminSessionsView;
	showStaleBookings: boolean;
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

function normalizeStoredSorting(
	sorting: z.infer<typeof sessionSortingItemSchema>[] | undefined
): SessionSorting | undefined {
	if (!sorting || sorting.length === 0) {
		return undefined;
	}

	return sorting.map((sort) => ({
		id: sort.id === "name" ? "session" : sort.id,
		desc: sort.desc ?? false
	}));
}

export function readStoredPackagesTablePreferences(): PackagesTablePreferences {
	const storedPreferences = readAdminDashboardPreferences().packages;

	if (!storedPreferences) {
		return DEFAULT_PACKAGES_TABLE_PREFERENCES;
	}

	const legacyAllView =
		storedPreferences.showArchived === true || storedPreferences.packagesView === "all";

	return {
		sorting: {
			isDescending:
				storedPreferences.sorting?.isDescending ??
				DEFAULT_PACKAGES_TABLE_PREFERENCES.sorting.isDescending
		},
		packagesView:
			storedPreferences.packagesView ??
			(legacyAllView ? "all" : DEFAULT_PACKAGES_TABLE_PREFERENCES.packagesView),
		showStalePackages: storedPreferences.showStalePackages ?? false
	};
}

export function storePackagesTableFilters(preferences: PackagesTablePreferences) {
	storeAdminDashboardPreferences({ ...readAdminDashboardPreferences(), packages: preferences });
}

export function readStoredSessionsTablePreferences(): SessionsTablePreferences {
	const storedPreferences = readAdminDashboardPreferences().sessions;

	if (!storedPreferences) {
		return DEFAULT_SESSIONS_TABLE_PREFERENCES;
	}

	return {
		sorting:
			normalizeStoredSorting(storedPreferences.sorting) ??
			DEFAULT_SESSIONS_TABLE_PREFERENCES.sorting,
		sessionsView: storedPreferences.sessionsView ?? DEFAULT_SESSIONS_TABLE_PREFERENCES.sessionsView,
		showStaleBookings: storedPreferences.showStaleBookings ?? true
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
