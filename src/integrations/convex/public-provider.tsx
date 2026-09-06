import { createContext, useContext } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ConvexProvider, ConvexReactClient } from "convex/react";

import { env } from "#/env";
import { createQueryClient } from "#/integrations/tanstack-query/client";

const CONVEX_URL = env.VITE_CONVEX_URL;

const convex = new ConvexReactClient(CONVEX_URL);
const queryClient = createQueryClient();

const PublicConvexAvailableContext = createContext(false);

export function usePublicConvexAvailable() {
	return useContext(PublicConvexAvailableContext);
}

export default function PublicConvexProvider({ children }: { children: React.ReactNode }) {
	return (
		<PublicConvexAvailableContext.Provider value={true}>
			<ConvexProvider client={convex}>
				<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
			</ConvexProvider>
		</PublicConvexAvailableContext.Provider>
	);
}
