import { useAuth, useUser } from "@clerk/clerk-react";
import { Navigate } from "@tanstack/react-router";
import { Activity, useEffect, useState } from "react";
import { useConvexAuth, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { studioSite } from "#/config/sites";
import { api } from "#convex/_generated/api";
import { hasPermission } from "#/lib/permissions";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";
import { AdminDashboardShell } from "#studio/features/admin/components/AdminDashboardShell";
import type { AdminDashboardView } from "#studio/features/admin/components/AdminDashboardTabs";
import { PackagesTable } from "#studio/features/admin/components/PackagesTable";
import { SessionsTable } from "#studio/features/admin/components/SessionsTable";
import { BackendAuthErrorPage } from "#studio/features/auth/components/BackendAuthErrorPage";
import { DashboardForbiddenPage } from "#studio/features/auth/components/DashboardForbiddenPage";
import { EditorDashboardShell } from "#studio/features/editor/components/EditorDashboardShell";

const ADMIN_PAGE_SIZE = 500;

export function AdminPage() {
	const { isLoaded: isClerkLoaded, userId } = useAuth();
	const { isLoading: isConvexLoading, isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const createEditorUser = useMutation(api.auth.createEditorUser);

	// Create the editor user or update their details after Convex accepts the Clerk identity.
	useEffect(() => {
		if (isConvexAuthenticated) {
			void createEditorUser({});
		}
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

	if (!isConvexAuthenticated) {
		return <BackendAuthErrorPage />;
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
	if (accessError !== null || !hasPermission(access.permissions, "view:sessions")) {
		return <DashboardForbiddenPage />;
	}

	if (hasPermission(access.permissions, "view:packages")) {
		return <AdminDashboard />;
	}

	return <EditorDashboardShell />;
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
	const { user } = useUser();
	const [activeView, setActiveView] = useState<AdminDashboardView>("bookings");
	const [sessionSearchQuery, setSessionSearchQuery] = useState("");
	const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;

	function viewPackageSessions(invoiceNumber: string) {
		setSessionSearchQuery(invoiceNumber);
		setActiveView("bookings");
	}

	if (sessions.status === "LoadingFirstPage" || packages.status === "LoadingFirstPage") {
		return (
			<main className="grid min-h-dvh place-items-center px-6 py-12">
				<StudioLoadingState label="Decrypting classified files" />
			</main>
		);
	}

	return (
		<AdminDashboardShell
			activeView={activeView}
			email={email ?? null}
			onActiveViewChange={setActiveView}>
			{/* Keep both tables mounted when switching tabs so pagination and search stay where the user left them. */}
			<Activity mode={activeView === "bookings" ? "visible" : "hidden"}>
				<SessionsTable
					sessions={sessions.results}
					canLoadMoreSessions={sessions.status === "CanLoadMore"}
					isLoadingMoreSessions={sessions.status === "LoadingMore"}
					loadMoreSessions={() => sessions.loadMore(ADMIN_PAGE_SIZE)}
					searchQuery={sessionSearchQuery}
					onSearchQueryChange={setSessionSearchQuery}
				/>
			</Activity>
			<Activity mode={activeView === "packages" ? "visible" : "hidden"}>
				<PackagesTable
					packages={packages.results}
					canLoadMorePackages={packages.status === "CanLoadMore"}
					isLoadingMorePackages={packages.status === "LoadingMore"}
					loadMorePackages={() => packages.loadMore(ADMIN_PAGE_SIZE)}
					onViewPackageSessions={viewPackageSessions}
				/>
			</Activity>
		</AdminDashboardShell>
	);
}
