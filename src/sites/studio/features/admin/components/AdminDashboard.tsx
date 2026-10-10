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
import {
	ADMIN_PACKAGE_SEARCH_NARROW_FIELDS,
	ADMIN_SESSION_SEARCH_NARROW_FIELDS,
	formatAdminSearchNarrowQuery
} from "#studio/features/admin/lib/admin-search-narrow";
import { adminTablePageSize } from "#studio/features/admin/lib/admin-list-pagination";
import {
	sortAdminSearchPackages,
	sortAdminSearchSessions
} from "#studio/features/admin/lib/admin-search-client-sort";
import { useAdminTableSearchPagination } from "#studio/features/admin/lib/use-admin-table-search-pagination";
import { AdminSearchRefineBanner } from "#studio/features/admin/components/AdminSearchRefineBanner";
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
		typeof api.sessions.admin.archivePastDeadCheckoutSessions
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

type EmployeeListResult = FunctionReturnType<typeof api.employees.admin.listEmployees>;

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

	const hasActiveSessionSearch = trimmedSessionSearchQuery.length > 0;
	const sessionPageSize = adminTablePageSize(hasActiveSessionSearch);

	const sessionListQuery = {
		...toSessionListQuerySort(sessionSorting),
		view: sessionsView,
		includeStale: showStaleSessions,
		searchQuery: hasActiveSessionSearch ? trimmedSessionSearchQuery : undefined
	};

	const sessions = usePaginatedQuery(api.sessions.admin.listSessions, sessionListQuery, {
		initialNumItems: sessionPageSize
	});

	const isLoadingFirstPage = sessions.status === "LoadingFirstPage";
	const sessionResults = isLoadingFirstPage ? [] : sessions.results;

	const displayedSessionResults = hasActiveSessionSearch
		? sortAdminSearchSessions(sessionResults, sessionSorting)
		: sessionResults;

	const sessionSearchPagination = useAdminTableSearchPagination({
		hasActiveSearch: hasActiveSessionSearch,
		isLoadingFirstPage,
		isLoadingMore: sessions.status === "LoadingMore",
		loadMore: (pageSize) => sessions.loadMore(pageSize),
		pageSize: sessionPageSize,
		resultCount: displayedSessionResults.length,
		searchKey: trimmedSessionSearchQuery,
		status: sessions.status
	});

	return (
		<>
			<SessionsTable
				sessions={displayedSessionResults}
				canLoadMoreSessions={
					sessionSearchPagination.useScrollSentinelPagination && sessions.status === "CanLoadMore"
				}
				isLoadingMoreSessions={sessions.status === "LoadingMore"}
				isLoadingSessions={isLoadingFirstPage}
				isSearchBatchPaused={sessionSearchPagination.isSearchBatchPaused}
				loadedSearchMatchCount={sessionSearchPagination.loadedMatchCount}
				loadMoreSessions={() => sessions.loadMore(sessionPageSize)}
				searchQuery={sessionSearchQuery}
				sessionsView={sessionsView}
				showSearchLoadingControls={sessionSearchPagination.showSearchLoadingControls}
				showSearchLoadingStop={sessionSearchPagination.showSearchLoadingStop}
				showStaleSessions={showStaleSessions}
				sorting={sessionSorting}
				onContinueSearchBatchLoading={sessionSearchPagination.continueSearchBatchLoading}
				onSearchQueryChange={onSessionSearchQueryChange}
				onSessionsViewChange={onSessionsViewChange}
				onShowStaleSessionsChange={onShowStaleSessionsChange}
				onSortingChange={onSessionSortingChange}
				onStopSearchBatchLoading={sessionSearchPagination.stopSearchBatchLoading}
			/>
			{sessionSearchPagination.showRefineSearchBanner ? (
				<AdminSearchRefineBanner
					narrowFields={ADMIN_SESSION_SEARCH_NARROW_FIELDS}
					searchQuery={sessionSearchQuery}
					onConfirmLoadAll={sessionSearchPagination.confirmLoadAllMatches}
					onNarrowSearch={onSessionSearchQueryChange}
				/>
			) : null}
		</>
	);
}

type PackagesDashboardViewProps = {
	packageSorting: AdminPackageSort;
	packagesView: AdminPackagesView;
	showStalePackages: boolean;
	onPackageSortingChange: (sorting: AdminPackageSort) => void;
	onPackagesViewChange: (view: AdminPackagesView) => void;
	onShowStalePackagesChange: (showStalePackages: boolean) => void;
	onViewPackageSessions: (receiptNumber: string) => void;
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

	const hasActivePackageSearch = trimmedPackageSearchQuery.length > 0;
	const packagePageSize = adminTablePageSize(hasActivePackageSearch);

	const packageListQuery = {
		...toPackageListQuerySort(packageSorting),
		view: packagesView,
		includeStale: showStalePackages,
		searchQuery: hasActivePackageSearch ? trimmedPackageSearchQuery : undefined
	};

	const packages = usePaginatedQuery(api.packages.admin.listPackages, packageListQuery, {
		initialNumItems: packagePageSize
	});

	const isLoadingFirstPackagePage = packages.status === "LoadingFirstPage";

	const packagesForTable = useDisplayedWhileRefetching(packages.results, isLoadingFirstPackagePage);

	const displayedPackagesForTable = hasActivePackageSearch
		? sortAdminSearchPackages(packagesForTable, packageSorting)
		: packagesForTable;

	const packageSearchPagination = useAdminTableSearchPagination({
		hasActiveSearch: hasActivePackageSearch,
		isLoadingFirstPage: isLoadingFirstPackagePage,
		isLoadingMore: packages.status === "LoadingMore",
		loadMore: (pageSize) => packages.loadMore(pageSize),
		pageSize: packagePageSize,
		resultCount: displayedPackagesForTable.length,
		searchKey: trimmedPackageSearchQuery,
		status: packages.status
	});

	return (
		<>
			<PackagesTable
				packages={displayedPackagesForTable}
				canLoadMorePackages={
					packageSearchPagination.useScrollSentinelPagination && packages.status === "CanLoadMore"
				}
				isLoadingMorePackages={packages.status === "LoadingMore"}
				isLoadingPackages={isLoadingFirstPackagePage}
				isSearchBatchPaused={packageSearchPagination.isSearchBatchPaused}
				loadedSearchMatchCount={packageSearchPagination.loadedMatchCount}
				loadMorePackages={() => packages.loadMore(packagePageSize)}
				packagesView={packagesView}
				searchQuery={packageSearchQuery}
				showSearchLoadingControls={packageSearchPagination.showSearchLoadingControls}
				showSearchLoadingStop={packageSearchPagination.showSearchLoadingStop}
				showStalePackages={showStalePackages}
				sorting={packageSorting}
				onContinueSearchBatchLoading={packageSearchPagination.continueSearchBatchLoading}
				onPackagesViewChange={onPackagesViewChange}
				onSearchQueryChange={setPackageSearchQuery}
				onShowStalePackagesChange={onShowStalePackagesChange}
				onSortingChange={onPackageSortingChange}
				onStopSearchBatchLoading={packageSearchPagination.stopSearchBatchLoading}
				onViewPackageSessions={onViewPackageSessions}
			/>
			{packageSearchPagination.showRefineSearchBanner ? (
				<AdminSearchRefineBanner
					narrowFields={ADMIN_PACKAGE_SEARCH_NARROW_FIELDS}
					searchQuery={packageSearchQuery}
					onConfirmLoadAll={packageSearchPagination.confirmLoadAllMatches}
					onNarrowSearch={setPackageSearchQuery}
				/>
			) : null}
		</>
	);
}

function EmployeesDashboardView({
	adminEditorProfile
}: {
	adminEditorProfile: AdminEditorProfile | null;
}) {
	const editorsResult = useQuery(api.employees.admin.listEmployees, {});

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
	const accessResult = useQuery(api.shared.auth.getCurrentUserAccess, {});
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

	const archivePastDeadCheckoutSessions = useMutation(
		api.sessions.admin.archivePastDeadCheckoutSessions
	);

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

	function viewPackageSessions(receiptNumber: string) {
		setInitialSessionSearchQuery(formatAdminSearchNarrowQuery("receipt", receiptNumber));
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
