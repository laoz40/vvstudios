import { useUser } from "@clerk/clerk-react";
import { Activity, useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "#convex/_generated/api";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";
import { AdminDashboardShell } from "#studio/features/admin/components/AdminDashboardShell";
import type { AdminDashboardView } from "#studio/features/admin/components/AdminDashboardTabs";
import { EmployeesTable } from "#studio/features/admin/components/EmployeesTable";
import { PackagesTable } from "#studio/features/admin/components/PackagesTable";
import { SessionsTable } from "#studio/features/admin/components/SessionsTable";
import { BackendAuthErrorPage } from "#studio/features/auth/components/BackendAuthErrorPage";
import { DashboardForbiddenPage } from "#studio/features/auth/components/DashboardForbiddenPage";

const ADMIN_PAGE_SIZE = 500;

type EmployeeListResult = FunctionReturnType<typeof api.employees.listEmployees>;
type EmployeeListError = NonNullable<EmployeeListResult[0]>;
type Employees = NonNullable<EmployeeListResult[1]>;
type ActiveEditors = FunctionReturnType<typeof api.sessions.listActiveEditors>;
type Sessions = FunctionReturnType<typeof api.sessions.listSessions>["page"];
type Packages = FunctionReturnType<typeof api.packages.listPackages>["page"];

type AdminDashboardTablesProps = {
	activeView: AdminDashboardView;
	activeEditors: ActiveEditors;
	editors: Employees;
	sessions: Sessions;
	packages: Packages;
	canLoadMoreSessions: boolean;
	isLoadingMoreSessions: boolean;
	canLoadMorePackages: boolean;
	isLoadingMorePackages: boolean;
	sessionSearchQuery: string;
	onLoadMoreSessions: () => void;
	onLoadMorePackages: () => void;
	onSearchQueryChange: (query: string) => void;
	onViewPackageSessions: (invoiceNumber: string) => void;
};

function renderEmployeeListError(error: EmployeeListError) {
	switch (error.reason) {
		case "NOT_AUTHENTICATED":
			return <BackendAuthErrorPage />;
		case "NOT_AUTHORIZED":
			return <DashboardForbiddenPage />;
		default: {
			const _exhaustive: never = error;
			return _exhaustive;
		}
	}
}

function AdminDashboardTables({
	activeView,
	activeEditors,
	editors,
	sessions,
	packages,
	canLoadMoreSessions,
	isLoadingMoreSessions,
	canLoadMorePackages,
	isLoadingMorePackages,
	sessionSearchQuery,
	onLoadMoreSessions,
	onLoadMorePackages,
	onSearchQueryChange,
	onViewPackageSessions
}: AdminDashboardTablesProps) {
	return (
		<>
			{/* Keep all tables mounted when switching tabs so pagination and search stay where the user left them. */}
			<Activity mode={activeView === "bookings" ? "visible" : "hidden"}>
				<SessionsTable
					activeEditors={activeEditors}
					sessions={sessions}
					canLoadMoreSessions={canLoadMoreSessions}
					isLoadingMoreSessions={isLoadingMoreSessions}
					loadMoreSessions={onLoadMoreSessions}
					searchQuery={sessionSearchQuery}
					onSearchQueryChange={onSearchQueryChange}
				/>
			</Activity>
			<Activity mode={activeView === "packages" ? "visible" : "hidden"}>
				<PackagesTable
					packages={packages}
					canLoadMorePackages={canLoadMorePackages}
					isLoadingMorePackages={isLoadingMorePackages}
					loadMorePackages={onLoadMorePackages}
					onViewPackageSessions={onViewPackageSessions}
				/>
			</Activity>
			<Activity mode={activeView === "employees" ? "visible" : "hidden"}>
				<EmployeesTable editors={editors} />
			</Activity>
		</>
	);
}

export function AdminDashboard() {
	const sessions = usePaginatedQuery(
		api.sessions.listSessions,
		{},
		{ initialNumItems: ADMIN_PAGE_SIZE }
	);
	const packages = usePaginatedQuery(
		api.packages.listPackages,
		{},
		{ initialNumItems: ADMIN_PAGE_SIZE }
	);
	const activeEditors = useQuery(api.sessions.listActiveEditors, {});
	const editorsResult = useQuery(api.employees.listEmployees, {});
	const { user } = useUser();
	const [activeView, setActiveView] = useState<AdminDashboardView>("bookings");
	const [sessionSearchQuery, setSessionSearchQuery] = useState("");
	const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;

	function viewPackageSessions(invoiceNumber: string) {
		setSessionSearchQuery(invoiceNumber);
		setActiveView("bookings");
	}

	const isPaginatedDataLoading = [sessions.status, packages.status].includes("LoadingFirstPage");
	if (isPaginatedDataLoading || activeEditors === undefined || editorsResult === undefined) {
		return (
			<main className="grid min-h-dvh place-items-center px-6 py-12">
				<StudioLoadingState label="Decrypting classified files" />
			</main>
		);
	}

	const [editorsError, editors] = editorsResult;
	if (editorsError !== null) {
		return renderEmployeeListError(editorsError);
	}

	return (
		<AdminDashboardShell
			activeView={activeView}
			email={email ?? null}
			onActiveViewChange={setActiveView}>
			<AdminDashboardTables
				activeView={activeView}
				activeEditors={activeEditors}
				editors={editors}
				sessions={sessions.results}
				packages={packages.results}
				canLoadMoreSessions={sessions.status === "CanLoadMore"}
				isLoadingMoreSessions={sessions.status === "LoadingMore"}
				canLoadMorePackages={packages.status === "CanLoadMore"}
				isLoadingMorePackages={packages.status === "LoadingMore"}
				sessionSearchQuery={sessionSearchQuery}
				onLoadMoreSessions={() => sessions.loadMore(ADMIN_PAGE_SIZE)}
				onLoadMorePackages={() => packages.loadMore(ADMIN_PAGE_SIZE)}
				onSearchQueryChange={setSessionSearchQuery}
				onViewPackageSessions={viewPackageSessions}
			/>
		</AdminDashboardShell>
	);
}
