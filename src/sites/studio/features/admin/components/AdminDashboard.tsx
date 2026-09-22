import { useUser } from "@clerk/clerk-react";
import { exhaustiveCheck } from "#/lib/result";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "#convex/_generated/api";
import { DashboardLoadingState } from "#studio/features/auth/components/DashboardLoadingState";
import type { DashboardRole } from "#studio/features/auth/lib/dashboard-loading-labels";
import { AdminDashboardShell } from "#studio/features/admin/components/AdminDashboardShell";
import type { AdminDashboardView } from "#studio/features/admin/components/AdminDashboardTabs";
import { AdminPrivacyModeProvider } from "#studio/features/admin/components/AdminPrivacyMode";
import { EmployeesTable } from "#studio/features/admin/components/EmployeesTable";
import type { AdminEditorProfile } from "#studio/features/admin/lib/editor-management";
import { PackagesTable } from "#studio/features/admin/components/PackagesTable";
import { SessionsTable } from "#studio/features/admin/components/SessionsTable";
import { BackendAuthErrorPage } from "#studio/features/auth/components/BackendAuthErrorPage";
import { DashboardForbiddenPage } from "#studio/features/auth/components/DashboardForbiddenPage";
import {
	toPackageListQuerySort,
	type AdminPackageSort
} from "#studio/features/admin/lib/admin-packages";
import { toSessionListQuerySort } from "#studio/features/admin/lib/admin-sessions";
import {
	readStoredPackagesTablePreferences,
	readStoredSessionsTablePreferences
} from "#studio/features/admin/lib/admin-dashboard-preferences";
import { DASHBOARD_PAGE_SIZE } from "#studio/features/auth/lib/dashboard-loading-labels";

type EmployeeListResult = FunctionReturnType<typeof api.employees.listEmployees>;

type EmployeeListError = NonNullable<EmployeeListResult[0]>;

type Employees = NonNullable<EmployeeListResult[1]>;

type AdminDashboardTablesProps = {
	activeView: AdminDashboardView;
	adminEditorProfile: AdminEditorProfile | null;
	editors: Employees;
	initialSessionSearchQuery: string | null;
	onInitialSessionSearchApplied: () => void;
	onViewPackageSessions: (invoiceNumber: string) => void;
};

function usePaginatedPackagesTable(packageSorting: AdminPackageSort) {
	const packageListSort = toPackageListQuerySort(packageSorting);

	const packages = usePaginatedQuery(api.packages.listPackages, packageListSort, {
		initialNumItems: DASHBOARD_PAGE_SIZE
	});

	const packagesForTable = useDisplayedWhileRefetching(
		packages.results,
		packages.status === "LoadingFirstPage"
	);

	return { packages, packagesForTable };
}

function useDisplayedWhileRefetching<T>(results: T[], isLoadingFirstPage: boolean) {
	const displayedResultsRef = useRef(results);

	const displayedResults =
		isLoadingFirstPage && displayedResultsRef.current.length > 0
			? displayedResultsRef.current
			: results;

	// Keep the previous page visible while a refetch is in flight.
	useEffect(() => {
		if (!isLoadingFirstPage) {
			displayedResultsRef.current = results;
		}
	}, [isLoadingFirstPage, results]);

	return displayedResults;
}

function renderEmployeeListError(error: EmployeeListError) {
	const reason = error.reason;

	switch (reason) {
		case "NOT_AUTHENTICATED":
			return <BackendAuthErrorPage />;
		case "NOT_AUTHORIZED":
			return <DashboardForbiddenPage />;
		default:
			return exhaustiveCheck(reason);
	}
}

function AdminDashboardTables({
	activeView,
	adminEditorProfile,
	editors,
	initialSessionSearchQuery,
	onInitialSessionSearchApplied,
	onViewPackageSessions
}: AdminDashboardTablesProps) {
	const initialTablePreferences = useMemo(
		() => ({
			sessions: readStoredSessionsTablePreferences(),
			packages: readStoredPackagesTablePreferences()
		}),
		[]
	);

	const [sessionSorting, setSessionSorting] = useState(initialTablePreferences.sessions.sorting);
	const [packageSorting, setPackageSorting] = useState(initialTablePreferences.packages.sorting);
	const [sessionSearchQuery, setSessionSearchQuery] = useState("");

	const sessionListSort = toSessionListQuerySort(sessionSorting);

	const sessions = usePaginatedQuery(api.sessions.listSessions, sessionListSort, {
		initialNumItems: DASHBOARD_PAGE_SIZE
	});

	const { packages, packagesForTable } = usePaginatedPackagesTable(packageSorting);

	const sessionsForTable = useDisplayedWhileRefetching(
		sessions.results,
		sessions.status === "LoadingFirstPage"
	);

	const activeEditors = useQuery(api.sessions.listActiveEditors, {});

	// Apply cross-tab search when navigating from a package row.
	useEffect(() => {
		if (!initialSessionSearchQuery) {
			return;
		}

		setSessionSearchQuery(initialSessionSearchQuery);
		onInitialSessionSearchApplied();
	}, [initialSessionSearchQuery, onInitialSessionSearchApplied]);

	if (activeEditors === undefined) {
		return null;
	}

	return (
		<>
			{activeView === "bookings" ? (
				<SessionsTable
					activeEditors={activeEditors}
					sessions={sessionsForTable}
					canLoadMoreSessions={sessions.status === "CanLoadMore"}
					isLoadingMoreSessions={sessions.status === "LoadingMore"}
					isLoadingSessions={sessions.status === "LoadingFirstPage"}
					loadMoreSessions={() => sessions.loadMore(DASHBOARD_PAGE_SIZE)}
					searchQuery={sessionSearchQuery}
					sorting={sessionSorting}
					onSearchQueryChange={setSessionSearchQuery}
					onSortingChange={setSessionSorting}
				/>
			) : null}
			{activeView === "packages" ? (
				<PackagesTable
					packages={packagesForTable}
					canLoadMorePackages={packages.status === "CanLoadMore"}
					isLoadingMorePackages={packages.status === "LoadingMore"}
					isLoadingPackages={packages.status === "LoadingFirstPage"}
					loadMorePackages={() => packages.loadMore(DASHBOARD_PAGE_SIZE)}
					sorting={packageSorting}
					onSortingChange={setPackageSorting}
					onViewPackageSessions={onViewPackageSessions}
				/>
			) : null}
			{activeView === "employees" ? (
				<EmployeesTable
					editors={editors}
					adminEditorProfile={adminEditorProfile}
				/>
			) : null}
		</>
	);
}

export function AdminDashboard({ dashboardRole }: { dashboardRole: DashboardRole }) {
	const editorsResult = useQuery(api.employees.listEmployees, {});
	const accessResult = useQuery(api.auth.getCurrentUserAccess, {});
	const { user } = useUser();
	const [activeView, setActiveView] = useState<AdminDashboardView>("bookings");
	const [initialSessionSearchQuery, setInitialSessionSearchQuery] = useState<string | null>(null);
	const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;

	function viewPackageSessions(invoiceNumber: string) {
		setInitialSessionSearchQuery(invoiceNumber);
		setActiveView("bookings");
	}

	if (editorsResult === undefined || accessResult === undefined) {
		return (
			<DashboardLoadingState
				dashboardRole={dashboardRole}
				stage="loading-data"
			/>
		);
	}

	const [editorsError, editors] = editorsResult;

	if (editorsError !== null) {
		return renderEmployeeListError(editorsError);
	}

	const [accessError, access] = accessResult;

	if (accessError !== null) {
		return renderEmployeeListError(accessError);
	}

	const adminEditorProfile = access.role === "admin" ? access.editorProfile : null;

	return (
		<Suspense fallback={null}>
			<AdminPrivacyModeProvider>
				<main className="relative flex min-h-screen flex-col gap-5 bg-background p-3 pb-8 md:gap-6 md:p-4 lg:px-6">
					<AdminDashboardShell
						activeView={activeView}
						email={email ?? null}
						onActiveViewChange={setActiveView}
					/>
					<AdminDashboardTables
						activeView={activeView}
						adminEditorProfile={adminEditorProfile}
						editors={editors}
						initialSessionSearchQuery={initialSessionSearchQuery}
						onInitialSessionSearchApplied={() => setInitialSessionSearchQuery(null)}
						onViewPackageSessions={viewPackageSessions}
					/>
				</main>
			</AdminPrivacyModeProvider>
		</Suspense>
	);
}
