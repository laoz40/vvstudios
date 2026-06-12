import { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { buildNoIndexHead } from "#/lib/seo";

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
		<Suspense fallback={null}>
			<AdminPage />
		</Suspense>
	);
}
