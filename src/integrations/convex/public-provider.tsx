import { ConvexProvider, ConvexReactClient } from "convex/react";

import { env } from "#/env";

const CONVEX_URL = env.VITE_CONVEX_URL;

const convex = new ConvexReactClient(CONVEX_URL);

export default function PublicConvexProvider({ children }: { children: React.ReactNode }) {
	return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
