import { useAuth } from "@clerk/clerk-react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";

import { env } from "#/env";

const CONVEX_URL = env.VITE_CONVEX_URL;

const convex = new ConvexReactClient(CONVEX_URL);

export default function AppConvexProvider({ children }: { children: React.ReactNode }) {
	return (
		<ConvexProviderWithClerk
			client={convex}
			useAuth={useAuth}>
			{children}
		</ConvexProviderWithClerk>
	);
}
