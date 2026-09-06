import { QueryClientProvider } from "@tanstack/react-query";
import { ConvexProvider, ConvexReactClient } from "convex/react";

import { env } from "#/env";
import { createQueryClient } from "#/integrations/tanstack-query/client";

const CONVEX_URL = env.VITE_CONVEX_URL;

const convex = new ConvexReactClient(CONVEX_URL);
const queryClient = createQueryClient();

export default function PublicConvexProvider({ children }: { children: React.ReactNode }) {
	return (
		<ConvexProvider client={convex}>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</ConvexProvider>
	);
}
