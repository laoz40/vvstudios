import { Outlet, createFileRoute } from "@tanstack/react-router";

import PublicConvexProvider from "#/integrations/convex/public-provider";

export const Route = createFileRoute("/_public/_convex")({ component: ConvexPublicLayout });

function ConvexPublicLayout() {
	return (
		<PublicConvexProvider>
			<Outlet />
		</PublicConvexProvider>
	);
}
