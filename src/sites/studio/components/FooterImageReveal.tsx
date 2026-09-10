import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Link } from "@tanstack/react-router";
import ArrowNarrowRightIcon from "#/components/ui/arrow-narrow-right-icon";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import { studioSite } from "#/config/sites";
import { cn } from "#/lib/utils";

export type FooterImageRevealProps = { showCta?: boolean };

export function FooterImageReveal({ showCta = true }: FooterImageRevealProps) {
	const revealRef = useRef<HTMLDivElement>(null);
	const prefersReducedMotion = useReducedMotion();
	const { scrollYProgress } = useScroll({ target: revealRef, offset: ["start end", "end end"] });
	const scale = useTransform(scrollYProgress, [0, 1], [0.8, 1]);

	return (
		<div
			ref={revealRef}
			className="footer-image-reveal">
			{showCta ? (
				<motion.div
					className="footer-image-reveal__cta"
					style={{ scale: prefersReducedMotion ? 1 : scale }}>
					<AnimatedIconButton
						variant="ghost"
						className={cn(
							"font-brand h-auto gap-3 uppercase tracking-tight",
							"border-0 bg-transparent text-foreground shadow-none",
							"hover:bg-transparent! hover:text-primary",
							"px-6 py-2 text-5xl sm:text-6xl",
							"md:gap-4 md:px-10 md:py-3 md:text-9xl"
						)}
						renderIcon={(iconRef) => (
							<ArrowNarrowRightIcon
								ref={iconRef}
								strokeWidth={2}
								className="size-8 translate-y-px md:size-20"
							/>
						)}>
						<Link to={studioSite.routes.book}>Book your session</Link>
					</AnimatedIconButton>
				</motion.div>
			) : null}
		</div>
	);
}
