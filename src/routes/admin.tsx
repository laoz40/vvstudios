import { SignOutButton, useAuth, useUser } from "@clerk/clerk-react";
import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useConvexAuth, usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "#/components/ui/button";
import { AdminDashboard } from "#/features/admin/components/AdminDashboard";
import { buildNoIndexHead } from "#/lib/seo";

export const Route = createFileRoute("/admin")({
	head: () => buildNoIndexHead("Admin Dashboard | VV Podcast Studio"),
	component: AdminPage,
});

function AdminPage() {
	const { isLoaded: isClerkLoaded, userId } = useAuth();
	const { isLoading: isConvexLoading, isAuthenticated: isConvexAuthenticated } = useConvexAuth();

	if (!isClerkLoaded || isConvexLoading) {
		return (
			<main>
				<p>Loading dashboard...</p>
			</main>
		);
	}

	if (!userId) {
		return <Navigate to="/login" />;
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
				<SignOutButton redirectUrl="/login">
					<Button type="button">Sign out</Button>
				</SignOutButton>
			</main>
		);
	}

	return <AdminPageContent />;
}

function AdminPageContent() {
	const {
		results: bookings,
		status: bookingsStatus,
		loadMore: loadMoreBookings,
	} = usePaginatedQuery(api.bookings.getBookings, {}, { initialNumItems: 100 });
	const { user } = useUser();
	const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;

	if (bookingsStatus === "LoadingFirstPage") {
		return (
			<main>
				<p>Loading bookings...</p>
			</main>
		);
	}

	return (
		<AdminDashboard
			bookings={bookings}
			canLoadMoreBookings={bookingsStatus === "CanLoadMore"}
			email={email ?? null}
			isLoadingMoreBookings={bookingsStatus === "LoadingMore"}
			loadMoreBookings={() => loadMoreBookings(100)}
			signOutControl={
				<SignOutButton redirectUrl="/login">
					<Button
						type="button"
						variant="outline">
						Sign out
					</Button>
				</SignOutButton>
			}
		/>
	);
}
