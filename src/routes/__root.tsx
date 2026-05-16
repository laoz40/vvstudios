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
import { SpeedInsights } from "@vercel/speed-insights/react";
import { ArrowRight, Home } from "lucide-react";
import gabaritoLatinFont from "@fontsource-variable/gabarito/files/gabarito-latin-wght-normal.woff2?url";
import squadaOneFont from "@fontsource/squada-one/files/squada-one-latin-400-normal.woff2?url";
import logoAnimatedYellow from "#studio/assets/logo-animated-yellow.svg";
import { studioSite } from "#/config/sites";
import { SmoothScroll } from "#studio/components/SmoothScroll";
import { StudioLayout } from "#studio/StudioLayout";
import { Button } from "#/components/ui/button";
import { Toaster } from "#/components/ui/sonner";
import appCss from "../styles.css?url";
import studioCss from "../sites/studio/styles.css?url";
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
				title: studioSite.name,
			},
			{
				name: "application-name",
				content: studioSite.applicationName,
			},
			{
				name: "theme-color",
				content: studioSite.themeColor,
			},
			{
				name: "apple-mobile-web-app-title",
				content: studioSite.appleMobileWebAppTitle,
			},
		],
		links: [
			{
				rel: "preload",
				href: squadaOneFont,
				as: "font",
				type: "font/woff2",
				crossOrigin: "anonymous",
			},
			{
				rel: "preload",
				href: gabaritoLatinFont,
				as: "font",
				type: "font/woff2",
				crossOrigin: "anonymous",
			},
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "stylesheet",
				href: studioCss,
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "32x32",
				href: studioSite.icons.icon32,
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "16x16",
				href: studioSite.icons.icon16,
			},
			{
				rel: "shortcut icon",
				href: studioSite.icons.shortcut,
			},
			{
				rel: "apple-touch-icon",
				sizes: "180x180",
				href: studioSite.icons.appleTouch,
			},
			{
				rel: "manifest",
				href: studioSite.icons.manifest,
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const isAdminPage = pathname === studioSite.routes.admin;

	return (
		<html
			lang="en"
			className="dark">
			<head>
				<HeadContent />
			</head>
			<body className={isAdminPage ? "studio-site studio-site-admin" : "studio-site"}>
				<ClerkProvider>
					<ConvexProvider>
						<SmoothScroll />
						<StudioLayout pathname={pathname}>{children}</StudioLayout>
						<Toaster />
					</ConvexProvider>
				</ClerkProvider>
				<Analytics />
				<SpeedInsights />
				<Scripts />
			</body>
		</html>
	);
}

function NotFoundPage() {
	return (
		<main className="px-6 text-center md:px-10">
			<div className="mx-auto flex max-w-3xl flex-col items-center gap-8">
				<Image
					src={logoAnimatedYellow}
					alt="VV Studios"
					width={200}
					height={200}
					layout="fixed"
					loading="eager"
					className="size-[50vh] shrink-0"
				/>

				<div className="space-y-4">
					<h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
						Whoops! Page not found.
					</h1>
					<p className="mx-auto max-w-xl text-base text-muted-foreground">
						The page you’re looking for doesn’t exist or may have been moved.
					</p>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row">
					<Button
						asChild
						size="lg">
						<Link to={studioSite.routes.book}>
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
						<Link to={studioSite.routes.home}>
							<Home aria-hidden />
							Home
						</Link>
					</Button>
				</div>
			</div>
		</main>
	);
}
