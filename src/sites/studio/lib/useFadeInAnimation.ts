import { useReducedMotion } from "motion/react";

export function useFadeInAnimation(enabled = false) {
	const prefersReducedMotion = useReducedMotion();
	const shouldFadeIn = enabled && prefersReducedMotion === false;
	const shouldShowImmediately = enabled && prefersReducedMotion !== false;

	if (shouldShowImmediately) {
		return {
			initial: false,
			animate: { opacity: 1 },
			whileInView: undefined,
			viewport: { amount: 0.05, once: true },
			transition: { duration: 0 },
		};
	}

	return {
		initial: shouldFadeIn ? { opacity: 0 } : false,
		whileInView: shouldFadeIn ? { opacity: 1 } : undefined,
		viewport: { amount: 0.05, once: true },
		transition: { duration: 1.2, ease: "easeOut" as const },
	};
}
