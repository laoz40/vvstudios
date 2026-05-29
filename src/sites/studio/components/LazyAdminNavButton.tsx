import { useConvexAuth, useQuery } from "convex/react";

import { Button } from "#/components/ui/button";
import { studioSite } from "#/config/sites";
import ClerkProvider from "#/integrations/clerk/provider";
import ConvexProvider from "#/integrations/convex/provider";
import { cn } from "#/lib/utils";
import { api } from "#convex/_generated/api";

type AdminNavMedia = "desktop" | "mobile";

export function LazyAdminNavButton({
	media,
	onNavigate,
}: {
	media: AdminNavMedia;
	onNavigate?: () => void;
}) {
	return (
		<ClerkProvider>
			<ConvexProvider>
				<AdminAccessButton
					media={media}
					onNavigate={onNavigate}
				/>
			</ConvexProvider>
		</ClerkProvider>
	);
}

function AdminAccessButton({
	media,
	onNavigate,
}: {
	media: AdminNavMedia;
	onNavigate?: () => void;
}) {
	const { isLoading, isAuthenticated } = useConvexAuth();
	const access = useQuery(
		api.auth.getCurrentUserAccess,
		!isLoading && isAuthenticated ? {} : "skip",
	);

	if (!access?.isAdmin) {
		return null;
	}

	return (
		<>
			<li
				aria-hidden="true"
				className={cn(
					media === "desktop" && "h-5 border-l border-border/70",
					media === "mobile" && "mt-2 border-t pt-1",
				)}
			/>
			<li>
				<Button
					asChild
					variant="link"
					size="sm"
					className={cn(
						"text-foreground decoration-current hover:text-foreground",
						media === "mobile" && "h-11 w-full justify-start px-3 text-base",
					)}>
					<a
						href={studioSite.routes.admin}
						target="_blank"
						rel="noreferrer"
						onClick={onNavigate}>
						Admin
					</a>
				</Button>
			</li>
		</>
	);
}
