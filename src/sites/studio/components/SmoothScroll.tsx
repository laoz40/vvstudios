import { useEffect } from "react";
import Lenis from "lenis";

export function SmoothScroll() {
	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			return;
		}

		const lenis = new Lenis({
			autoRaf: true,
			anchors: true,
		});

		return () => {
			lenis.destroy();
		};
	}, []);

	return null;
}
