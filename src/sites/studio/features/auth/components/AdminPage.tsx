import { SignOutButton, useAuth, useUser } from "@clerk/clerk-react";
import { Link, Navigate } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { useConvexAuth, usePaginatedQuery, useQuery } from "convex/react";

import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import HomeIcon from "#/components/ui/home-icon";
import LogoutIcon from "#/components/ui/logout-icon";
import { studioSite } from "#/config/sites";
import { api } from "#convex/_generated/api";
import logoAnimatedYellow from "#studio/assets/logo-animated-yellow.svg";
import { AdminDashboard } from "#studio/features/admin/components/AdminDashboard";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";

const ADMIN_BOOKINGS_PAGE_SIZE = 500;

export function AdminPage() {
	const { isLoaded: isClerkLoaded, userId } = useAuth();
	const { isLoading: isConvexLoading, isAuthenticated: isConvexAuthenticated } = useConvexAuth();

	if (!isClerkLoaded || isConvexLoading) {
		return <AdminLoadingState label="Loading dashboard" />;
	}

	if (!userId) {
		return <Navigate to={studioSite.routes.login} />;
	}

	if (!isConvexAuthenticated) {
		return (
			<main>
				<h1>Past bookings</h1>
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
	const access = useQuery(api.auth.getCurrentUserAccess, {});

	if (!access) {
		return <AdminLoadingState label="Checking admin access" />;
	}

	if (!access.isAdmin) {
		return <AdminForbiddenPage />;
	}

	return <AdminPageContent />;
}

function AdminLoadingState({ label }: { label: string }) {
	return (
		<main className="grid min-h-dvh place-items-center px-6 py-12">
			<StudioLoadingState label={label} />
		</main>
	);
}

function AdminForbiddenPage() {
	return (
		<main className="px-6 text-center md:px-10">
			<div className="mx-auto flex max-w-3xl flex-col items-center gap-8">
				<Image
					src={logoAnimatedYellow}
					alt="VV Studios"
					width={200}
					height={200}
					layout="fixed"
					loading="eager"
					className="size-[50vh] shrink-0"
				/>

				<div className="space-y-4">
					<h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
						Admin access required.
					</h1>
					<p className="mx-auto max-w-xl text-base text-muted-foreground">
						This account does not have permission to view the admin dashboard.
					</p>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row">
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
				</div>
			</div>
		</main>
	);
}

function AdminPageContent() {
	const bookings = usePaginatedQuery(
		api.bookings.getBookings,
		{},
		{ initialNumItems: ADMIN_BOOKINGS_PAGE_SIZE }
	);
	const { user } = useUser();
	const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;

	if (bookings.status === "LoadingFirstPage") {
		return <AdminLoadingState label="Loading bookings" />;
	}

	return (
		<AdminDashboard
			bookings={bookings.results}
			canLoadMoreBookings={bookings.status === "CanLoadMore"}
			email={email ?? null}
			isLoadingMoreBookings={bookings.status === "LoadingMore"}
			loadMoreBookings={() => bookings.loadMore(ADMIN_BOOKINGS_PAGE_SIZE)}
			signOutControl={
				<SignOutButton redirectUrl={studioSite.routes.login}>
					<AnimatedIconButton
						type="button"
						variant="outline"
						size="sm"
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
			}
		/>
	);
}
