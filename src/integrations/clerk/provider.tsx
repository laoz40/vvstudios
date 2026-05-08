import { ClerkProvider } from "@clerk/clerk-react";
import { studioSite } from "#/config/sites";
import { env } from "#/env";

const PUBLISHABLE_KEY = env.VITE_CLERK_PUBLISHABLE_KEY;

export default function AppClerkProvider({ children }: { children: React.ReactNode }) {
	return (
		<ClerkProvider
			publishableKey={PUBLISHABLE_KEY}
			signInUrl={studioSite.routes.login}
			signInForceRedirectUrl={studioSite.routes.admin}
			signUpForceRedirectUrl={studioSite.routes.admin}
			afterSignOutUrl={studioSite.routes.login}>
			{children}
		</ClerkProvider>
	);
}
