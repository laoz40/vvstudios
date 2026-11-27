import { Link } from "@tanstack/react-router";
import ArrowNarrowRightIcon from "#/components/ui/arrow-narrow-right-icon";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import { studioSite } from "#/config/sites";

export type FooterImageRevealProps = { showCta?: boolean };

export function FooterImageReveal({ showCta = true }: FooterImageRevealProps) {
	return (
		<div className="footer-image-reveal">
			{showCta ? (
				<div className="footer-image-reveal__cta">
					<AnimatedIconButton
						variant="ghost"
						className="font-brand h-auto gap-3 border-0 bg-transparent px-6 py-2 text-5xl tracking-tight text-foreground uppercase shadow-none hover:bg-transparent! hover:text-primary sm:text-6xl md:gap-4 md:px-10 md:py-3 md:text-9xl"
						icon={ArrowNarrowRightIcon}
						iconProps={{ strokeWidth: 2, className: "size-8 translate-y-px md:size-20" }}>
						<Link to={studioSite.routes.book}>Book your session</Link>
					</AnimatedIconButton>
				</div>
			) : null}
		</div>
	);
}
