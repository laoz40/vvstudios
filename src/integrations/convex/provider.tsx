import { QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";

import { env } from "#/env";
import { createQueryClient } from "#/integrations/tanstack-query/client";

const CONVEX_URL = env.VITE_CONVEX_URL;

const convex = new ConvexReactClient(CONVEX_URL);

const queryClient = createQueryClient();

function useConvexClerkAuth() {
	const { getToken, isLoaded, isSignedIn } = useAuth();

	async function fetchAccessToken({ forceRefreshToken }: { forceRefreshToken: boolean }) {
		try {
			return await getToken({ skipCache: forceRefreshToken, template: "convex" });
		} catch {
			return null;
		}
	}

	return { fetchAccessToken, isAuthenticated: isSignedIn ?? false, isLoading: !isLoaded };
}

export default function AppConvexProvider({ children }: { children: React.ReactNode }) {
	return (
		<ConvexProviderWithAuth
			client={convex}
			useAuth={useConvexClerkAuth}>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</ConvexProviderWithAuth>
	);
}
