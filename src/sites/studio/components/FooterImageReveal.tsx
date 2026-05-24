import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Button } from "#/components/ui/button";
import { studioSite } from "#/config/sites";

export type FooterImageRevealProps = {
	showCta?: boolean;
};

export function FooterImageReveal({ showCta = true }: FooterImageRevealProps) {
	const revealRef = useRef<HTMLDivElement>(null);
	const prefersReducedMotion = useReducedMotion();
	const { scrollYProgress } = useScroll({
		target: revealRef,
		offset: ["start end", "end end"],
	});
	const scale = useTransform(scrollYProgress, [0, 1], [0.2, 1]);

	return (
		<div
			ref={revealRef}
			className="footer-image-reveal">
			{showCta ? (
				<motion.div
					className="footer-image-reveal__cta"
					style={{
						scale: prefersReducedMotion ? 1 : scale,
					}}>
					<Button
						asChild
						size="lg"
						className="h-auto gap-1.5 px-12! py-3 text-base shadow-lg md:px-12 md:py-4">
						<Link to={studioSite.routes.book}>
							Book session
							<ArrowRight
								className="translate-y-px stroke-3"
								aria-hidden
							/>
						</Link>
					</Button>
				</motion.div>
			) : null}
		</div>
	);
}
