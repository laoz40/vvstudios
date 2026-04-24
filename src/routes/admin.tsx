import { SignOutButton, useAuth, useUser } from "@clerk/clerk-react";
import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/admin")({
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
					<button
						type="button"
						className="pressable">
						Sign out
					</button>
				</SignOutButton>
			</main>
		);
	}

	return <AdminDashboard />;
}

function AdminDashboard() {
	const bookings = useQuery(api.bookings.getBookings, {});
	const { user } = useUser();
	const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;

	if (bookings === undefined) {
		return (
			<main>
				<p>Loading bookings...</p>
			</main>
		);
	}

	return (
		<main>
			<h1>Past bookings</h1>
			<p>Signed in as {email ?? "Unknown user"}.</p>
			<SignOutButton redirectUrl="/login">
				<button
					type="button"
					className="pressable">
					Sign out
				</button>
			</SignOutButton>

			{bookings.length === 0 ? (
				<p>L business no bookings yet.</p>
			) : (
				<table>
					<thead>
						<tr>
							<th>Name</th>
							<th>Phone</th>
							<th>Account Name</th>
							<th>ABN</th>
							<th>Email</th>
							<th>Date</th>
							<th>Time</th>
							<th>Duration</th>
							<th>Service</th>
							<th>Add-ons</th>
							<th>Notes</th>
							<th>Created at</th>
						</tr>
					</thead>
					<tbody>
						{bookings.map((booking) => (
							<tr key={booking._id}>
								<td>{booking.name}</td>
								<td>{booking.phone ?? "—"}</td>
								<td>{booking.accountName ?? "—"}</td>
								<td>{booking.abn ?? "—"}</td>
								<td>{booking.email}</td>
								<td>{booking.date}</td>
								<td>{booking.time ?? "—"}</td>
								<td>{booking.duration ?? "—"}</td>
								<td>{booking.service}</td>
								<td>{booking.addons?.length ? booking.addons.join(", ") : "—"}</td>
								<td>{booking.notes ?? "—"}</td>
								<td>{new Date(booking.pendingPaymentCreatedAt).toLocaleString()}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</main>
	);
}
