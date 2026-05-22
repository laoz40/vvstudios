import { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { buildNoIndexHead } from "#/lib/seo";

const LoginPage = lazy(() =>
	import("#studio/features/auth/components/LoginPage").then((module) => ({
		default: module.LoginPage,
	})),
);

export const Route = createFileRoute("/_auth/login")({
	head: () => buildNoIndexHead("Admin Login | VV Studios"),
	component: LoginRoute,
});

function LoginRoute() {
	return (
		<Suspense fallback={null}>
			<LoginPage />
		</Suspense>
	);
}
