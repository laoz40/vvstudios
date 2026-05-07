import type { QueryClient } from "@tanstack/react-query";
import {
	HeadContent,
	Link,
	Scripts,
	createRootRouteWithContext,
	useRouterState,
} from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { Analytics } from "@vercel/analytics/react";
import { ArrowRight, Home } from "lucide-react";
import logoYellow from "#/assets/vv-logo-yellow.svg";
import { SmoothScroll } from "#/components/SmoothScroll";
import { Footer } from "#/components/Footer";
import { SiteNavbar } from "#/components/NavBar";
import { Button } from "#/components/ui/button";
import { Toaster } from "#/components/ui/sonner";
import appCss from "../styles.css?url";
import ClerkProvider from "../integrations/clerk/provider";
import ConvexProvider from "../integrations/convex/provider";

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
				title: "VV Studios",
			},
			{
				name: "application-name",
				content: "VV Studios",
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
	const useMinimalLayout =
		pathname === "/admin" ||
		pathname === "/login" ||
		pathname === "/booking-complete" ||
		pathname === "/booking-expired";

	return (
		<html
			lang="en"
			className="dark">
			<head>
				<HeadContent />
			</head>
			<body>
				<ClerkProvider>
					<ConvexProvider>
						<SmoothScroll />
						{useMinimalLayout ? null : <SiteNavbar />}
						<div
							id="site-shell"
							className={
								useMinimalLayout ? "flex min-h-screen flex-col" : "min-h-screen pt-18 md:pt-24"
							}>
							{children}
						</div>
						{useMinimalLayout ? null : <Footer />}
						<Toaster />
					</ConvexProvider>
				</ClerkProvider>
				<Analytics />
				<Scripts />
			</body>
		</html>
	);
}

function NotFoundPage() {
	return (
		<main className="px-6 py-16 text-center md:px-10 md:py-24">
			<div className="mx-auto flex max-w-3xl flex-col items-center gap-8">
				<Image
					src={logoYellow}
					alt="VV Studios"
					width={72}
					height={72}
					layout="fixed"
					loading="eager"
					className="size-18 shrink-0"
				/>

				<div className="space-y-4">
					<h1 className="text-4xl font-semibold tracking-tight md:text-6xl">404 Page not found</h1>
					<p className="mx-auto max-w-xl text-base text-muted-foreground">
						The page you’re looking for doesn’t exist or may have been moved.
					</p>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row">
					<Button
						asChild
						size="lg">
						<Link to="/book">
							Book a session
							<ArrowRight
								className="stroke-3"
								aria-hidden
							/>
						</Link>
					</Button>
					<Button
						asChild
						variant="outline"
						size="lg">
						<Link to="/">
							<Home aria-hidden />
							Home
						</Link>
					</Button>
				</div>
			</div>
		</main>
	);
}
