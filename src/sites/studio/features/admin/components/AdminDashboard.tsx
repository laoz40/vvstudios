import { useUser } from "@clerk/clerk-react";
import { exhaustiveCheck } from "#/lib/result";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
	toSessionListQuerySort,
	type SessionSorting
} from "#studio/features/admin/lib/admin-sessions";
import { readStoredSessionsTablePreferences } from "#studio/features/admin/lib/admin-dashboard-preferences";
import { DASHBOARD_PAGE_SIZE } from "#studio/features/auth/lib/dashboard-loading-labels";

type EmployeeListResult = FunctionReturnType<typeof api.employees.listEmployees>;

type EmployeeListError = NonNullable<EmployeeListResult[0]>;

type Employees = NonNullable<EmployeeListResult[1]>;

type ActiveEditors = FunctionReturnType<typeof api.sessions.listActiveEditors>;

type Sessions = FunctionReturnType<typeof api.sessions.listSessions>["page"];

type Packages = FunctionReturnType<typeof api.packages.listPackages>["page"];

type AdminDashboardTablesProps = {
	activeView: AdminDashboardView;
	activeEditors: ActiveEditors;
	adminEditorProfile: AdminEditorProfile | null;
	editors: Employees;
	sessions: Sessions;
	packages: Packages;
	canLoadMoreSessions: boolean;
	isLoadingMoreSessions: boolean;
	isLoadingSessions: boolean;
	canLoadMorePackages: boolean;
	isLoadingMorePackages: boolean;
	isLoadingPackages: boolean;
	packageSorting: AdminPackageSort;
	sessionSearchQuery: string;
	sessionSorting: SessionSorting;
	onLoadMoreSessions: () => void;
	onLoadMorePackages: () => void;
	onPackageSortingChange: (sorting: AdminPackageSort) => void;
	onSearchQueryChange: (query: string) => void;
	onSessionSortingChange: (sorting: SessionSorting) => void;
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
	activeEditors,
	adminEditorProfile,
	editors,
	sessions,
	packages,
	canLoadMoreSessions,
	isLoadingMoreSessions,
	isLoadingSessions,
	canLoadMorePackages,
	isLoadingMorePackages,
	isLoadingPackages,
	packageSorting,
	sessionSearchQuery,
	sessionSorting,
	onLoadMoreSessions,
	onLoadMorePackages,
	onPackageSortingChange,
	onSearchQueryChange,
	onSessionSortingChange,
	onViewPackageSessions
}: AdminDashboardTablesProps) {
	return (
		<>
			{activeView === "bookings" ? (
				<SessionsTable
					activeEditors={activeEditors}
					sessions={sessions}
					canLoadMoreSessions={canLoadMoreSessions}
					isLoadingMoreSessions={isLoadingMoreSessions}
					isLoadingSessions={isLoadingSessions}
					loadMoreSessions={onLoadMoreSessions}
					searchQuery={sessionSearchQuery}
					sorting={sessionSorting}
					onSearchQueryChange={onSearchQueryChange}
					onSortingChange={onSessionSortingChange}
				/>
			) : null}
			{activeView === "packages" ? (
				<PackagesTable
					packages={packages}
					canLoadMorePackages={canLoadMorePackages}
					isLoadingMorePackages={isLoadingMorePackages}
					isLoadingPackages={isLoadingPackages}
					loadMorePackages={onLoadMorePackages}
					sorting={packageSorting}
					onSortingChange={onPackageSortingChange}
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
	const initialSessionPreferences = useMemo(readStoredSessionsTablePreferences, []);
	const [sessionSorting, setSessionSorting] = useState(initialSessionPreferences.sorting);
	const [packageSorting, setPackageSorting] = useState<AdminPackageSort>({ isDescending: true });
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
	const editorsResult = useQuery(api.employees.listEmployees, {});
	const accessResult = useQuery(api.auth.getCurrentUserAccess, {});
	const { user } = useUser();
	const [activeView, setActiveView] = useState<AdminDashboardView>("bookings");
	const [sessionSearchQuery, setSessionSearchQuery] = useState("");
	const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;

	function viewPackageSessions(invoiceNumber: string) {
		setSessionSearchQuery(invoiceNumber);
		setActiveView("bookings");
	}

	if (activeEditors === undefined || editorsResult === undefined || accessResult === undefined) {
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
		<AdminPrivacyModeProvider>
			<AdminDashboardShell
				activeView={activeView}
				email={email ?? null}
				onActiveViewChange={setActiveView}>
				<AdminDashboardTables
					activeView={activeView}
					activeEditors={activeEditors}
					adminEditorProfile={adminEditorProfile}
					editors={editors}
					sessions={sessionsForTable}
					packages={packagesForTable}
					canLoadMoreSessions={sessions.status === "CanLoadMore"}
					isLoadingMoreSessions={sessions.status === "LoadingMore"}
					isLoadingSessions={sessions.status === "LoadingFirstPage"}
					canLoadMorePackages={packages.status === "CanLoadMore"}
					isLoadingMorePackages={packages.status === "LoadingMore"}
					isLoadingPackages={packages.status === "LoadingFirstPage"}
					sessionSearchQuery={sessionSearchQuery}
					sessionSorting={sessionSorting}
					packageSorting={packageSorting}
					onLoadMoreSessions={() => sessions.loadMore(DASHBOARD_PAGE_SIZE)}
					onLoadMorePackages={() => packages.loadMore(DASHBOARD_PAGE_SIZE)}
					onSearchQueryChange={setSessionSearchQuery}
					onSessionSortingChange={setSessionSorting}
					onPackageSortingChange={setPackageSorting}
					onViewPackageSessions={viewPackageSessions}
				/>
			</AdminDashboardShell>
		</AdminPrivacyModeProvider>
	);
}
