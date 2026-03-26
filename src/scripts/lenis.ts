import Lenis from "lenis";

// Track reduced motion preference.
const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let lenis: Lenis | null = null;

// Cleanup Lenis instance.
const destroyLenis = () => {
	if (!lenis) return;
	lenis.destroy();
	lenis = null;
};

// Initialize Lenis instance.
const initLenis = () => {
	if (lenis) return;
	lenis = new Lenis({
		autoRaf: true,
		lerp: 0.1,
	});
};

// Toggle Lenis based on preference.
const updateLenis = () => {
	if (mediaQuery.matches) {
		destroyLenis();
		return;
	}

	initLenis();
};

// Apply initial state.
updateLenis();

// React to preference changes.
mediaQuery.addEventListener("change", updateLenis);

// Final cleanup on unload.
window.addEventListener("beforeunload", () => {
	mediaQuery.removeEventListener("change", updateLenis);
	destroyLenis();
});
