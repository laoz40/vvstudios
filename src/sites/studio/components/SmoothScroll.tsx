import { useEffect, useRef } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import Lenis from "lenis";

function getScrollMarginTop(element: HTMLElement) {
	const scrollMarginTop = window.getComputedStyle(element).scrollMarginTop;
	const parsedScrollMarginTop = Number.parseFloat(scrollMarginTop);

	return Number.isNaN(parsedScrollMarginTop) ? 0 : parsedScrollMarginTop;
}

export function SmoothScroll() {
	const router = useRouter();
	const lenisRef = useRef<Lenis | null>(null);
	const hash = useRouterState({
		select: (state) => state.location.hash,
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
		const unsubscribeBeforeNavigate = router.subscribe("onBeforeNavigate", (event) => {
			const lenis = lenisRef.current;

			if (!event.pathChanged || event.toLocation.hash) {
				return;
			}

			lenis?.stop();
		});

		const unsubscribeBeforeRouteMount = router.subscribe("onBeforeRouteMount", (event) => {
			const lenis = lenisRef.current;

			if (!event.pathChanged || event.toLocation.hash) {
				return;
			}

			if (lenis) {
				lenis.scrollTo(0, { immediate: true, force: true });
				lenis.start();
				return;
			}

			window.scrollTo({ top: 0, left: 0, behavior: "instant" });
		});

		return () => {
			unsubscribeBeforeNavigate();
			unsubscribeBeforeRouteMount();
		};
	}, [router]);

	useEffect(() => {
		const lenis = lenisRef.current;

		if (hash) {
			requestAnimationFrame(() => {
				const target = document.getElementById(hash);

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
	}, [hash]);

	return null;
}
