import { SignOutButton, useAuth, useUser } from "@clerk/clerk-react";
import { Link, Navigate } from "@tanstack/react-router";
import { Activity, useEffect, useState } from "react";
import { useConvexAuth, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import HomeIcon from "#/components/ui/home-icon";
import LogoutIcon from "#/components/ui/logout-icon";
import { studioSite } from "#/config/sites";
import { api } from "#convex/_generated/api";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";
import { StudioErrorPage } from "#studio/components/StudioErrorPage";
import { AdminDashboardShell } from "#studio/features/admin/components/AdminDashboardShell";
import type { AdminDashboardView } from "#studio/features/admin/components/AdminDashboardTabs";
import { PackagesTable } from "#studio/features/admin/components/PackagesTable";
import { SessionsTable } from "#studio/features/admin/components/SessionsTable";

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
		return (
			<main>
				<h1>Past sessions</h1>
				<p>
					You are signed in with Clerk, but the backend is not receiving a valid Convex auth token
					yet.
				</p>
				<p>
					In Clerk, enable the Convex integration or create the <code>convex</code> JWT template,
					then run <code>proxy npx convex dev</code>.
				</p>
				<SignOutButton redirectUrl={studioSite.routes.login}>
					<AnimatedIconButton
						type="button"
						iconPosition="before"
						renderIcon={(iconRef) => (
							<LogoutIcon
								ref={iconRef}
								aria-hidden
							/>
						)}>
						<button type="button">Sign out</button>
					</AnimatedIconButton>
				</SignOutButton>
			</main>
		);
	}

	return <AdminAccessGate />;
}

function AdminAccessGate() {
	const accessResult = useQuery(api.auth.getCurrentUserAccess, {});

	if (!accessResult) {
		return (
			<main className="grid min-h-dvh place-items-center px-6 py-12">
				<StudioLoadingState label="Confirming Level 9 Clearance" />
			</main>
		);
	}

	const [accessError, access] = accessResult;
	if (accessError !== null || access.role !== "admin") {
		return <AdminForbiddenPage />;
	}

	return <AdminPageContent />;
}

function AdminForbiddenPage() {
	return (
		<StudioErrorPage
			title="Admin access required."
			description="This account does not have permission to view the admin dashboard."
			actions={
				<>
					<AnimatedIconButton
						size="lg"
						iconPosition="before"
						renderIcon={(iconRef) => (
							<HomeIcon
								ref={iconRef}
								aria-hidden
							/>
						)}>
						<Link to={studioSite.routes.home}>Home</Link>
					</AnimatedIconButton>
					<SignOutButton redirectUrl={studioSite.routes.login}>
						<AnimatedIconButton
							variant="outline"
							size="lg"
							iconPosition="before"
							renderIcon={(iconRef) => (
								<LogoutIcon
									ref={iconRef}
									aria-hidden
								/>
							)}>
							<button type="button">Sign out</button>
						</AnimatedIconButton>
					</SignOutButton>
				</>
			}
		/>
	);
}

function AdminPageContent() {
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
