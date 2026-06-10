import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Link } from "@tanstack/react-router";
import ArrowNarrowRightIcon from "#/components/ui/arrow-narrow-right-icon";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import { studioSite } from "#/config/sites";

export type FooterImageRevealProps = { showCta?: boolean };

export function FooterImageReveal({ showCta = true }: FooterImageRevealProps) {
	const revealRef = useRef<HTMLDivElement>(null);
	const prefersReducedMotion = useReducedMotion();
	const { scrollYProgress } = useScroll({ target: revealRef, offset: ["start end", "end end"] });
	const scale = useTransform(scrollYProgress, [0, 1], [0.5, 1]);

	return (
		<div
			ref={revealRef}
			className="footer-image-reveal">
			{showCta ? (
				<motion.div
					className="footer-image-reveal__cta"
					style={{ scale: prefersReducedMotion ? 1 : scale }}>
					<AnimatedIconButton
						variant="outline"
						className="bg-accent/70 border-primary! text-primary hover:text-primary h-auto gap-1.5 px-8! py-3 text-xl shadow-lg text-shadow-lg backdrop-blur-xs md:bg-accent/50"
						renderIcon={(iconRef) => (
							<ArrowNarrowRightIcon
								ref={iconRef}
								size={16}
								strokeWidth={3}
								className="translate-y-px"
							/>
						)}>
						<Link to={studioSite.routes.book}>Book session</Link>
					</AnimatedIconButton>
				</motion.div>
			) : null}
		</div>
	);
}
