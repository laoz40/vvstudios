import { useAuth, useUser } from "@clerk/clerk-react";
import { Navigate } from "@tanstack/react-router";
import { Activity, useEffect, useState } from "react";
import { useConvexAuth, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { studioSite } from "#/config/sites";
import { api } from "#convex/_generated/api";
import { hasPermission } from "#/lib/permissions";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";
import { AdminDashboardShell } from "#studio/features/admin/components/AdminDashboardShell";
import type { AdminDashboardView } from "#studio/features/admin/components/AdminDashboardTabs";
import { EditorsTable } from "#studio/features/admin/components/EditorsTable";
import { PackagesTable } from "#studio/features/admin/components/PackagesTable";
import { SessionsTable } from "#studio/features/admin/components/SessionsTable";
import { BackendAuthErrorPage } from "#studio/features/auth/components/BackendAuthErrorPage";
import { DashboardForbiddenPage } from "#studio/features/auth/components/DashboardForbiddenPage";
import { EditorDashboardShell } from "#studio/features/editor/components/EditorDashboardShell";

const ADMIN_PAGE_SIZE = 500;

type EditorListResult = FunctionReturnType<typeof api.editors.listEditors>;
type EditorListError = NonNullable<EditorListResult[0]>;
type Editors = NonNullable<EditorListResult[1]>;
type ActiveEditors = FunctionReturnType<typeof api.sessions.listActiveEditors>;
type Sessions = FunctionReturnType<typeof api.sessions.listSessions>["page"];
type Packages = FunctionReturnType<typeof api.packages.listPackages>["page"];
type EditorProvisioningState =
	| { status: "pending" }
	| { status: "complete" }
	| { status: "failed" };

type AdminDashboardTablesProps = {
	activeView: AdminDashboardView;
	activeEditors: ActiveEditors;
	editors: Editors;
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

function renderEditorListError(error: EditorListError) {
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

export function AdminPage() {
	const { isLoaded: isClerkLoaded, userId } = useAuth();
	const { isLoading: isConvexLoading, isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const createEditorUser = useMutation(api.auth.createEditorUser);
	const [editorProvisioningState, setEditorProvisioningState] = useState<EditorProvisioningState>({
		status: "pending"
	});

	// Create or refresh the editor profile before checking dashboard access.
	useEffect(() => {
		if (!isConvexAuthenticated) return undefined;

		let isCurrent = true;
		setEditorProvisioningState({ status: "pending" });
		void createEditorUser({}).then(
			([error]) => {
				if (!isCurrent) return;
				if (error !== null) {
					setEditorProvisioningState({ status: "failed" });
					return;
				}
				setEditorProvisioningState({ status: "complete" });
			},
			() => {
				if (isCurrent) setEditorProvisioningState({ status: "failed" });
			}
		);

		return () => {
			isCurrent = false;
		};
	}, [isConvexAuthenticated, createEditorUser]);

	if (!isClerkLoaded || isConvexLoading) {
		return (
			<main className="grid min-h-dvh place-items-center px-6 py-12">
				<StudioLoadingState label="Establishing a secure uplink" />
			</main>
		);
	}

	if (!userId) {
		return <Navigate to={studioSite.routes.login} />;
	}

	if (!isConvexAuthenticated || editorProvisioningState.status === "failed") {
		return <BackendAuthErrorPage />;
	}

	if (editorProvisioningState.status === "pending") {
		return (
			<main className="grid min-h-dvh place-items-center px-6 py-12">
				<StudioLoadingState label="Preparing editor access" />
			</main>
		);
	}

	return <DashboardAccessGate />;
}

function DashboardAccessGate() {
	const accessResult = useQuery(api.auth.getCurrentUserAccess, {});

	if (!accessResult) {
		return (
			<main className="grid min-h-dvh place-items-center px-6 py-12">
				<StudioLoadingState label="Confirming Level 9 Clearance" />
			</main>
		);
	}

	const [accessError, access] = accessResult;
	if (accessError !== null) {
		switch (accessError.reason) {
			case "NOT_AUTHENTICATED":
				return <BackendAuthErrorPage />;
			case "NOT_AUTHORIZED":
				return <DashboardForbiddenPage />;
			default: {
				const _exhaustive: never = accessError;
				return _exhaustive;
			}
		}
	}

	if (!hasPermission(access.permissions, "view:sessions")) {
		return <DashboardForbiddenPage />;
	}

	if (access.role === "admin") {
		return <AdminDashboard />;
	}

	return <EditorDashboardShell />;
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
			<Activity mode={activeView === "editors" ? "visible" : "hidden"}>
				<EditorsTable editors={editors} />
			</Activity>
		</>
	);
}

function AdminDashboard() {
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
	const editorsResult = useQuery(api.editors.listEditors, {});
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
		return renderEditorListError(editorsError);
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
