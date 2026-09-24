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
	type AdminPackageSort,
	type AdminPackagesView
} from "#studio/features/admin/lib/admin-packages";
import {
	toSessionListQuerySort,
	type AdminSessionsView,
	type SessionSorting
} from "#studio/features/admin/lib/admin-sessions";
import {
	readStoredPackagesTablePreferences,
	readStoredSessionsTablePreferences
} from "#studio/features/admin/lib/admin-dashboard-preferences";
import { DASHBOARD_PAGE_SIZE } from "#studio/features/auth/lib/dashboard-loading-labels";

type EmployeeListResult = FunctionReturnType<typeof api.employees.listEmployees>;

type EmployeeListError = NonNullable<EmployeeListResult[0]>;

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

type BookingsDashboardViewProps = {
	sessionSearchQuery: string;
	sessionSorting: SessionSorting;
	sessionsView: AdminSessionsView;
	showStaleSessions: boolean;
	onSessionSearchQueryChange: (searchQuery: string) => void;
	onSessionSortingChange: (sorting: SessionSorting) => void;
	onSessionsViewChange: (view: AdminSessionsView) => void;
	onShowStaleSessionsChange: (showStaleSessions: boolean) => void;
};

function BookingsDashboardView({
	sessionSearchQuery,
	sessionSorting,
	sessionsView,
	showStaleSessions,
	onSessionSearchQueryChange,
	onSessionSortingChange,
	onSessionsViewChange,
	onShowStaleSessionsChange
}: BookingsDashboardViewProps) {
	const sessionListQuery = {
		...toSessionListQuerySort(sessionSorting),
		view: sessionsView,
		includeStale: showStaleSessions
	};

	const sessions = usePaginatedQuery(api.sessions.listSessions, sessionListQuery, {
		initialNumItems: DASHBOARD_PAGE_SIZE
	});

	const isLoadingFirstPage = sessions.status === "LoadingFirstPage";

	return (
		<SessionsTable
			sessions={isLoadingFirstPage ? [] : sessions.results}
			canLoadMoreSessions={sessions.status === "CanLoadMore"}
			isLoadingMoreSessions={sessions.status === "LoadingMore"}
			isLoadingSessions={sessions.status === "LoadingFirstPage"}
			loadMoreSessions={() => sessions.loadMore(DASHBOARD_PAGE_SIZE)}
			searchQuery={sessionSearchQuery}
			sessionsView={sessionsView}
			showStaleSessions={showStaleSessions}
			sorting={sessionSorting}
			onSearchQueryChange={onSessionSearchQueryChange}
			onSessionsViewChange={onSessionsViewChange}
			onShowStaleSessionsChange={onShowStaleSessionsChange}
			onSortingChange={onSessionSortingChange}
		/>
	);
}

type PackagesDashboardViewProps = {
	packageSorting: AdminPackageSort;
	packagesView: AdminPackagesView;
	showStalePackages: boolean;
	onPackageSortingChange: (sorting: AdminPackageSort) => void;
	onPackagesViewChange: (view: AdminPackagesView) => void;
	onShowStalePackagesChange: (showStalePackages: boolean) => void;
	onViewPackageSessions: (invoiceNumber: string) => void;
};

function PackagesDashboardView({
	packageSorting,
	packagesView,
	showStalePackages,
	onPackageSortingChange,
	onPackagesViewChange,
	onShowStalePackagesChange,
	onViewPackageSessions
}: PackagesDashboardViewProps) {
	const packageListQuery = {
		...toPackageListQuerySort(packageSorting),
		view: packagesView,
		includeStale: showStalePackages
	};

	const packages = usePaginatedQuery(api.packages.listPackages, packageListQuery, {
		initialNumItems: DASHBOARD_PAGE_SIZE
	});

	const packagesForTable = useDisplayedWhileRefetching(
		packages.results,
		packages.status === "LoadingFirstPage"
	);

	return (
		<PackagesTable
			packages={packagesForTable}
			canLoadMorePackages={packages.status === "CanLoadMore"}
			isLoadingMorePackages={packages.status === "LoadingMore"}
			isLoadingPackages={packages.status === "LoadingFirstPage"}
			loadMorePackages={() => packages.loadMore(DASHBOARD_PAGE_SIZE)}
			packagesView={packagesView}
			showStalePackages={showStalePackages}
			sorting={packageSorting}
			onPackagesViewChange={onPackagesViewChange}
			onShowStalePackagesChange={onShowStalePackagesChange}
			onSortingChange={onPackageSortingChange}
			onViewPackageSessions={onViewPackageSessions}
		/>
	);
}

function EmployeesDashboardView({
	adminEditorProfile
}: {
	adminEditorProfile: AdminEditorProfile | null;
}) {
	const editorsResult = useQuery(api.employees.listEmployees, {});

	if (editorsResult !== undefined) {
		const [editorsError] = editorsResult;

		if (editorsError !== null) {
			return renderEmployeeListError(editorsError);
		}
	}

	return (
		<EmployeesTable
			adminEditorProfile={adminEditorProfile}
			editors={editorsResult?.[1] ?? []}
			isLoadingEmployees={editorsResult === undefined}
		/>
	);
}

export function AdminDashboard({ dashboardRole }: { dashboardRole: DashboardRole }) {
	const accessResult = useQuery(api.auth.getCurrentUserAccess, {});
	const { user } = useUser();
	const [activeView, setActiveView] = useState<AdminDashboardView>("bookings");
	const [initialSessionSearchQuery, setInitialSessionSearchQuery] = useState<string | null>(null);

	const initialTablePreferences = useMemo(
		() => ({
			sessions: readStoredSessionsTablePreferences(),
			packages: readStoredPackagesTablePreferences()
		}),
		[]
	);

	const [sessionSorting, setSessionSorting] = useState(initialTablePreferences.sessions.sorting);

	const [sessionsView, setSessionsView] = useState(initialTablePreferences.sessions.sessionsView);

	const [showStaleSessions, setShowStaleSessions] = useState(
		initialTablePreferences.sessions.showStaleBookings
	);

	const [packageSorting, setPackageSorting] = useState(initialTablePreferences.packages.sorting);

	const [packagesView, setPackagesView] = useState(initialTablePreferences.packages.packagesView);

	const [showStalePackages, setShowStalePackages] = useState(
		initialTablePreferences.packages.showStalePackages
	);

	const [sessionSearchQuery, setSessionSearchQuery] = useState("");

	const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;

	function viewPackageSessions(invoiceNumber: string) {
		setInitialSessionSearchQuery(invoiceNumber);
		setActiveView("bookings");
	}

	// Apply cross-tab search when navigating from a package row.
	useEffect(() => {
		if (!initialSessionSearchQuery) {
			return;
		}

		setSessionSearchQuery(initialSessionSearchQuery);
		setInitialSessionSearchQuery(null);
	}, [initialSessionSearchQuery]);

	if (accessResult === undefined) {
		return (
			<DashboardLoadingState
				dashboardRole={dashboardRole}
				stage="loading-data"
			/>
		);
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
					{activeView === "bookings" ? (
						<BookingsDashboardView
							sessionSearchQuery={sessionSearchQuery}
							sessionSorting={sessionSorting}
							sessionsView={sessionsView}
							showStaleSessions={showStaleSessions}
							onSessionSearchQueryChange={setSessionSearchQuery}
							onSessionSortingChange={setSessionSorting}
							onSessionsViewChange={setSessionsView}
							onShowStaleSessionsChange={setShowStaleSessions}
						/>
					) : null}
					{activeView === "packages" ? (
						<PackagesDashboardView
							packageSorting={packageSorting}
							packagesView={packagesView}
							showStalePackages={showStalePackages}
							onPackageSortingChange={setPackageSorting}
							onPackagesViewChange={setPackagesView}
							onShowStalePackagesChange={setShowStalePackages}
							onViewPackageSessions={viewPackageSessions}
						/>
					) : null}
					{activeView === "employees" ? (
						<EmployeesDashboardView adminEditorProfile={adminEditorProfile} />
					) : null}
				</main>
			</AdminPrivacyModeProvider>
		</Suspense>
	);
}
