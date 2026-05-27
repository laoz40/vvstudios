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
	const scale = useTransform(scrollYProgress, [0, 1], [0.5, 1]);

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
						variant="outline"
						className="bg-accent/80 border-primary! text-primary hover:text-primary h-auto gap-1.5 px-8! py-3 text-xl shadow-lg text-shadow-lg md:bg-accent/40">
						<Link to={studioSite.routes.book}>
							Book session
							<ArrowRight
								className="translate-y-px stroke-3 size-4"
								aria-hidden
							/>
						</Link>
					</Button>
				</motion.div>
			) : null}
		</div>
	);
}
