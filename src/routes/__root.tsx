import { type ReactNode } from "react";
import {
	HeadContent,
	Link,
	Scripts,
	createRootRoute,
	useRouterState
} from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { ArrowRight, Home } from "lucide-react";
import gabaritoLatinFont from "@fontsource-variable/gabarito/files/gabarito-latin-wght-normal.woff2?url";
import squadaOneFont from "@fontsource/squada-one/files/squada-one-latin-400-normal.woff2?url";
import { StudioErrorPage } from "#studio/components/StudioErrorPage";
import { studioSite } from "#/config/sites";
import { Button } from "#/components/ui/button";
import { Toaster } from "#/components/ui/sonner";
import appCss from "../styles.css?url";
import studioCss from "../sites/studio/styles.css?url";

export const Route = createRootRoute({
	notFoundComponent: NotFoundPage,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
			{ title: studioSite.name },
			{ name: "application-name", content: studioSite.applicationName },
			{ name: "theme-color", content: studioSite.themeColor },
			{ name: "apple-mobile-web-app-title", content: studioSite.appleMobileWebAppTitle }
		],
		links: [
			{
				rel: "preload",
				href: squadaOneFont,
				as: "font",
				type: "font/woff2",
				crossOrigin: "anonymous"
			},
			{
				rel: "preload",
				href: gabaritoLatinFont,
				as: "font",
				type: "font/woff2",
				crossOrigin: "anonymous"
			},
			{ rel: "stylesheet", href: appCss },
			{ rel: "stylesheet", href: studioCss },
			{ rel: "icon", type: "image/png", sizes: "32x32", href: studioSite.icons.icon32 },
			{ rel: "icon", type: "image/png", sizes: "16x16", href: studioSite.icons.icon16 },
			{ rel: "shortcut icon", href: studioSite.icons.shortcut },
			{ rel: "apple-touch-icon", sizes: "180x180", href: studioSite.icons.appleTouch },
			{ rel: "manifest", href: studioSite.icons.manifest }
		]
	}),
	shellComponent: RootDocument
});

function RootDocument({ children }: { children: ReactNode }) {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const isAdminPage = pathname === studioSite.routes.admin;

	return (
		<html
			lang="en"
			className="dark">
			<head>
				<HeadContent />
			</head>
			<body className={isAdminPage ? "studio-site studio-site-admin" : "studio-site"}>
				{children}
				<Toaster />
				<Analytics />
				<SpeedInsights />
				<Scripts />
			</body>
		</html>
	);
}

function NotFoundPage() {
	return (
		<StudioErrorPage
			title="Whoops! Page not found."
			description="The page you’re looking for doesn’t exist or may have been moved."
			actions={
				<>
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
				</>
			}
		/>
	);
}
