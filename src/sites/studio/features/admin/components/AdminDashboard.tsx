import { useUser } from "@clerk/clerk-react";
import { exhaustiveCheck, tryCatch, type Result } from "#/lib/result";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery, type ReactMutation } from "convex/react";
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
import { useDebouncedValue } from "#/lib/use-debounced-value";

const ADMIN_TABLE_SEARCH_DEBOUNCE_MS = 300;

type ArchivePastDeadCheckoutBatch = {
	continueCursor: string | null;
	isDone: boolean;
	newlyArchived: number;
	scanned: number;
};

async function archivePastDeadCheckoutSessionsUntilDone(
	archivePastDeadCheckoutSessions: ReactMutation<
		typeof api.sessions.archivePastDeadCheckoutSessions
	>,
	cursor: string | null = null
) {
	const [error, batch]: Result<ArchivePastDeadCheckoutBatch, { reason: string }> = await tryCatch(
		archivePastDeadCheckoutSessions({ cursor })
	);

	if (error !== null) {
		return;
	}

	if (!batch.isDone) {
		await archivePastDeadCheckoutSessionsUntilDone(
			archivePastDeadCheckoutSessions,
			batch.continueCursor
		);
	}
}

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
	const debouncedSessionSearchQuery = useDebouncedValue(
		sessionSearchQuery,
		ADMIN_TABLE_SEARCH_DEBOUNCE_MS
	);

	const trimmedSessionSearchQuery = debouncedSessionSearchQuery.trim();

	const sessionListQuery = {
		...toSessionListQuerySort(sessionSorting),
		view: sessionsView,
		includeStale: showStaleSessions,
		searchQuery:
			trimmedSessionSearchQuery.length > 0 ? trimmedSessionSearchQuery : undefined
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
	const [packageSearchQuery, setPackageSearchQuery] = useState("");

	const debouncedPackageSearchQuery = useDebouncedValue(
		packageSearchQuery,
		ADMIN_TABLE_SEARCH_DEBOUNCE_MS
	);

	const trimmedPackageSearchQuery = debouncedPackageSearchQuery.trim();

	const packageListQuery = {
		...toPackageListQuerySort(packageSorting),
		view: packagesView,
		includeStale: showStalePackages,
		searchQuery:
			trimmedPackageSearchQuery.length > 0 ? trimmedPackageSearchQuery : undefined
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
			searchQuery={packageSearchQuery}
			showStalePackages={showStalePackages}
			sorting={packageSorting}
			onPackagesViewChange={onPackagesViewChange}
			onSearchQueryChange={setPackageSearchQuery}
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

	const archivePastDeadCheckoutSessions = useMutation(api.sessions.archivePastDeadCheckoutSessions);

	const handleShowStaleSessionsChange = useCallback(
		(nextShowStaleSessions: boolean) => {
			setShowStaleSessions(nextShowStaleSessions);

			void archivePastDeadCheckoutSessionsUntilDone(archivePastDeadCheckoutSessions);
		},
		[archivePastDeadCheckoutSessions]
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
							onShowStaleSessionsChange={handleShowStaleSessionsChange}
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
