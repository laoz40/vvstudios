import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";

import ClerkProvider from "#/integrations/clerk/provider";
import ConvexProvider from "#/integrations/convex/provider";
import { SmoothScroll } from "#studio/components/SmoothScroll";
import { StudioLayout } from "#studio/StudioLayout";

export const Route = createFileRoute("/_auth")({
	component: AuthLayout,
});

function AuthLayout() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	return (
		<ClerkProvider>
			<ConvexProvider>
				<SmoothScroll />
				<StudioLayout pathname={pathname}>
					<Outlet />
				</StudioLayout>
			</ConvexProvider>
		</ClerkProvider>
	);
}
