import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import Lenis from "lenis";

export function SmoothScroll() {
	const lenisRef = useRef<Lenis | null>(null);
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			return;
		}

		const lenis = new Lenis({
			autoRaf: true,
			anchors: true,
		});

		lenisRef.current = lenis;

		return () => {
			lenis.destroy();
			lenisRef.current = null;
		};
	}, []);

	useEffect(() => {
		const lenis = lenisRef.current;

		if (lenis) {
			lenis.stop();
			lenis.scrollTo(0, { immediate: true, force: true });
			lenis.start();
			return;
		}

		window.scrollTo({ top: 0, left: 0, behavior: "instant" });
	}, [pathname]);

	return null;
}
