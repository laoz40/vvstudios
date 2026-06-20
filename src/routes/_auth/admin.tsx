import { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { buildNoIndexHead } from "#/lib/seo";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";

const AdminPage = lazy(() =>
	import("#studio/features/auth/components/AdminPage").then((module) => ({
		default: module.AdminPage
	}))
);

export const Route = createFileRoute("/_auth/admin")({
	head: () => buildNoIndexHead("Admin Dashboard | VV Studios"),
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
			<StudioLoadingState label="Loading dashboard" />
		</main>
	);
}
