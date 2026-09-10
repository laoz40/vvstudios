import { useSyncExternalStore } from "react";

const desktopMediaQuery = "(min-width: 768px)";

function subscribeToDesktopViewport(onChange: () => void) {
	const mediaQuery = window.matchMedia(desktopMediaQuery);
	mediaQuery.addEventListener("change", onChange);

	return () => mediaQuery.removeEventListener("change", onChange);
}

export function useIsDesktopViewport() {
	return useSyncExternalStore(
		subscribeToDesktopViewport,
		() => window.matchMedia(desktopMediaQuery).matches,
		() => false
	);
}
