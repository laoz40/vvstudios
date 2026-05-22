import { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

const AuthRouteLayout = lazy(() =>
	import("#studio/features/auth/components/AuthRouteLayout").then((module) => ({
		default: module.AuthRouteLayout,
	})),
);

export const Route = createFileRoute("/_auth")({
	component: AuthLayout,
});

function AuthLayout() {
	return (
		<Suspense fallback={null}>
			<AuthRouteLayout />
		</Suspense>
	);
}
