import {
	HeadContent,
	Link,
	Scripts,
	createRootRouteWithContext,
	useRouterState,
} from "@tanstack/react-router";
import { SmoothScroll } from "#/components/SmoothScroll";
import { Footer } from "#/components/Footer";
import { SiteNavbar } from "#/components/NavBar";
import { Toaster } from "#/components/ui/sonner";
import appCss from "../styles.css?url";
import ClerkProvider from "../integrations/clerk/provider";
import ConvexProvider from "../integrations/convex/provider";
import type { QueryClient } from "@tanstack/react-query";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	notFoundComponent: NotFoundPage,
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "VV Podcast Studio",
			},
			{
				name: "theme-color",
				content: "#1a1a1a",
			},
			{
				name: "apple-mobile-web-app-title",
				content: "VV Studios",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "32x32",
				href: "/favicon-32x32.png",
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "16x16",
				href: "/favicon-16x16.png",
			},
			{
				rel: "shortcut icon",
				href: "/favicon.ico",
			},
			{
				rel: "apple-touch-icon",
				sizes: "180x180",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "manifest",
				href: "/site.webmanifest",
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const useStatusPageLayout = pathname === "/booking-complete" || pathname === "/booking-expired";

	return (
		<html
			lang="en"
			className="">
			<head>
				<HeadContent />
			</head>
			<body>
				<ClerkProvider>
					<ConvexProvider>
						<SmoothScroll />
						{useStatusPageLayout ? null : <SiteNavbar />}
						<div
							id="site-shell"
							className={
								useStatusPageLayout ? "flex min-h-screen flex-col" : "min-h-screen pt-18 md:pt-24"
							}>
							{children}
						</div>
						<Footer />
						<Toaster />
					</ConvexProvider>
				</ClerkProvider>
				<Scripts />
			</body>
		</html>
	);
}

function NotFoundPage() {
	return (
		<main>
			<h1>Page not found</h1>
			<p>The page you requested does not exist.</p>
			<p>
				Go back to <Link to="/book">booking</Link>.
			</p>
		</main>
	);
}
