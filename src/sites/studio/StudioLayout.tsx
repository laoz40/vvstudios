import { type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { studioSite } from "#/config/sites";
import footerRevealImage from "#studio/assets/bg/landing-full.webp";
import { Footer } from "#studio/components/Footer";
import { FooterImageReveal } from "#studio/components/FooterImageReveal";
import { SiteNavbar } from "#studio/components/NavBar";

export type StudioLayoutProps = {
	children: ReactNode;
	pathname: string;
};

export function StudioLayout({ children, pathname }: StudioLayoutProps) {
	const useMinimalLayout =
		pathname === studioSite.routes.admin ||
		pathname === studioSite.routes.login ||
		pathname === studioSite.routes.bookingComplete ||
		pathname === studioSite.routes.bookingExpired;
	const showFooterRevealCta = pathname !== studioSite.routes.book;
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
						y: prefersReducedMotion ? 0 : footerImageY,
					}}
				/>
			)}
			{useMinimalLayout ? null : <SiteNavbar />}
			<div
				id="site-shell"
				className={
					useMinimalLayout
						? "flex min-h-screen flex-col"
						: "relative z-10 min-h-screen bg-background pt-18 md:pt-24"
				}>
				{children}
			</div>
			{useMinimalLayout ? null : <Footer />}
			{useMinimalLayout ? null : <FooterImageReveal showCta={showFooterRevealCta} />}
		</>
	);
}
