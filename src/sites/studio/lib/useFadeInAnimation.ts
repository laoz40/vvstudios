import { useReducedMotion } from "motion/react";

export function useFadeInAnimation(enabled = false) {
	const prefersReducedMotion = useReducedMotion();
	const shouldFadeIn = enabled && !prefersReducedMotion;

	return {
		initial: shouldFadeIn ? { opacity: 0 } : false,
		whileInView: shouldFadeIn ? { opacity: 1 } : undefined,
		viewport: { amount: 0.05, once: true },
		transition: { duration: 1.2, ease: "easeOut" },
	};
}
