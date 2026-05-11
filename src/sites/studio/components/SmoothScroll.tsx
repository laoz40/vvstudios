import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import Lenis from "lenis";

function getScrollMarginTop(element: HTMLElement) {
	const scrollMarginTop = window.getComputedStyle(element).scrollMarginTop;
	const parsedScrollMarginTop = Number.parseFloat(scrollMarginTop);

	return Number.isNaN(parsedScrollMarginTop) ? 0 : parsedScrollMarginTop;
}

export function SmoothScroll() {
	const lenisRef = useRef<Lenis | null>(null);
	const location = useRouterState({
		select: (state) => ({
			hash: state.location.hash,
			pathname: state.location.pathname,
		}),
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

		if (location.hash) {
			requestAnimationFrame(() => {
				const target = document.getElementById(location.hash);

				if (!target) {
					return;
				}

				if (lenis) {
					lenis.scrollTo(target, {
						force: true,
						offset: -getScrollMarginTop(target),
					});
					return;
				}

				target.scrollIntoView({ behavior: "smooth", block: "start" });
			});
			return;
		}

		if (lenis) {
			lenis.stop();
			lenis.scrollTo(0, { immediate: true, force: true });
			lenis.start();
			return;
		}

		window.scrollTo({ top: 0, left: 0, behavior: "instant" });
	}, [location.hash, location.pathname]);

	return null;
}
