import { Suspense, lazy, useEffect, useState } from "react";

// Keep Clerk and authenticated Convex code out of the public navbar's initial bundle
// so that public marketing pages render without auth check
const LazyAdminNavButton = lazy(() =>
	import("#studio/components/LazyAdminNavButton").then((module) => ({
		default: module.LazyAdminNavButton,
	})),
);

type AdminNavButtonProps = {
	media: "desktop" | "mobile";
	onNavigate?: () => void;
};

function getMediaQuery(media: AdminNavButtonProps["media"]) {
	return media === "desktop" ? "(min-width: 768px)" : "(max-width: 767px)";
}

export function AdminNavButton({ media, onNavigate }: AdminNavButtonProps) {
	const [shouldCheckAccess, setShouldCheckAccess] = useState(false);

	useEffect(() => {
		const mediaQuery = window.matchMedia(getMediaQuery(media));
		const syncMediaMatch = () => setShouldCheckAccess(mediaQuery.matches);

		// The desktop and mobile navs are both mounted, but only one is visible.
		// Gating by media query avoids mounting two Clerk/Convex provider trees and
		// avoids duplicate admin access checks on the same page load. Keep it synced
		// so resizing between breakpoints unmounts the hidden variant's provider.
		syncMediaMatch();
		mediaQuery.addEventListener("change", syncMediaMatch);

		return () => mediaQuery.removeEventListener("change", syncMediaMatch);
	}, [media]);

	if (!shouldCheckAccess) {
		// Return nothing during SSR and for the hidden nav variant. This preserves the
		// static/public HTML and lets the admin button appear as a client-only enhancement.
		return null;
	}

	return (
		<Suspense fallback={null}>
			<LazyAdminNavButton
				media={media}
				onNavigate={() => {
					setShouldCheckAccess(false);
					onNavigate?.();
				}}
			/>
		</Suspense>
	);
}
