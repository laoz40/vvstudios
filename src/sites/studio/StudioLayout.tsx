import type { ReactNode } from "react";
import { studioSite } from "#/config/sites";
import { Footer } from "#studio/components/Footer";
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

	return (
		<>
			{useMinimalLayout ? null : <SiteNavbar />}
			<div
				id="site-shell"
				className={useMinimalLayout ? "flex min-h-screen flex-col" : "min-h-screen pt-18 md:pt-24"}>
				{children}
			</div>
			{useMinimalLayout ? null : <Footer />}
		</>
	);
}
