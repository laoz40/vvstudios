import { type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { studioSite } from "#/config/sites";
import { cn } from "#/lib/utils";
import footerRevealImage from "#studio/assets/bg/landing-full.webp";
import { Footer } from "#studio/components/Footer";
import { FooterImageReveal } from "#studio/components/FooterImageReveal";
import { ModalHost } from "#studio/components/ModalHost";
import { SiteNavbar } from "#studio/components/NavBar";

export type StudioLayoutProps = { children: ReactNode; pathname: string };

export function StudioLayout({ children, pathname }: StudioLayoutProps) {
	const useMinimalLayout =
		pathname === studioSite.routes.admin ||
		pathname === studioSite.routes.login ||
		pathname === studioSite.routes.bookingComplete ||
		pathname === studioSite.routes.rescheduleComplete ||
		pathname === studioSite.routes.bookingExpired ||
		pathname.startsWith("/multi-booking/") ||
		pathname.startsWith("/reschedule/");
	const showFooterRevealCta = pathname !== studioSite.routes.book;
	const isHomePage = pathname === studioSite.routes.home;
	const prefersReducedMotion = useReducedMotion();
	const { scrollYProgress } = useScroll();
	const footerImageY = useTransform(scrollYProgress, [0.75, 1], [120, -30]);
	const footerImageScale = useTransform(scrollYProgress, [0.75, 1], [1.2, 1.2]);

	return (
		<>
			{useMinimalLayout ? null : (
				<motion.div
					aria-hidden
					className="footer-image-reveal__image brightness-55"
					style={{
						backgroundImage: `url(${footerRevealImage})`,
						scale: prefersReducedMotion ? 1 : footerImageScale,
						y: prefersReducedMotion ? 0 : footerImageY
					}}
				/>
			)}
			{useMinimalLayout ? null : <SiteNavbar />}
			<div
				id="site-shell"
				// Top padding keeps regular pages below the fixed navbar. The home page
				// intentionally cancels this with a matching negative margin so the video
				// can sit behind the navbar.
				className={cn(
					useMinimalLayout
						? "flex min-h-screen flex-col bg-background"
						: "relative z-10 min-h-screen bg-background pt-18 md:pt-24",
					!useMinimalLayout && !isHomePage && "page-spotlight-background"
				)}>
				{children}
			</div>
			{useMinimalLayout ? null : <Footer />}
			{useMinimalLayout ? null : <FooterImageReveal showCta={showFooterRevealCta} />}
			{useMinimalLayout ? null : <ModalHost />}
		</>
	);
}
