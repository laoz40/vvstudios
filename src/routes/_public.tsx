import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";

import PublicConvexProvider from "#/integrations/convex/public-provider";
import { SmoothScroll } from "#studio/components/SmoothScroll";
import { StudioLayout } from "#studio/StudioLayout";

export const Route = createFileRoute("/_public")({
	component: PublicLayout,
});

function PublicLayout() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	return (
		<PublicConvexProvider>
			<SmoothScroll />
			<StudioLayout pathname={pathname}>
				<Outlet />
			</StudioLayout>
		</PublicConvexProvider>
	);
}
