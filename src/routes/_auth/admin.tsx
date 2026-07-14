import { Suspense, lazy } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import { studioSite } from "#/config/sites";
import { buildNoIndexHead } from "#/lib/seo";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";

const AdminPage = lazy(() =>
	import("#studio/features/auth/components/AdminPage").then((module) => ({
		default: module.AdminPage
	}))
);

export const Route = createFileRoute("/_auth/admin")({
	head: () => buildNoIndexHead("Admin Dashboard | VV Studios"),
	errorComponent: AdminRouteError,
	component: AdminRoute
});

function AdminRoute() {
	return (
		<Suspense fallback={<AdminRouteLoading />}>
			<AdminPage />
		</Suspense>
	);
}

function AdminRouteLoading() {
	return (
		<main className="grid min-h-dvh place-items-center px-6 py-12">
			<StudioLoadingState label="Calibrating systems" />
		</main>
	);
}

function AdminRouteError() {
	return (
		<main className="grid min-h-dvh place-items-center px-6 py-12 text-center">
			<div className="max-w-md space-y-4">
				<h1 className="text-3xl font-semibold tracking-tight">Could not load admin dashboard.</h1>
				<p className="text-muted-foreground">
					Your session may have expired, or this account may not have permission to view bookings.
				</p>
				<Button asChild>
					<Link to={studioSite.routes.login}>Back to login</Link>
				</Button>
			</div>
		</main>
	);
}
