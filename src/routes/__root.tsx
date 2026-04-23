import { SignedOut } from "@clerk/clerk-react";
import { HeadContent, Link, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { Footer } from "#/components/Footer";

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
				title: "VV Studios Booking",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<ClerkProvider>
					<ConvexProvider>
						<div className="flex min-h-screen flex-col">
							<div className="flex-1">
								<nav>
									<Link to="/book">Book</Link> | <Link to="/admin">Admin</Link> |{" "}
									<SignedOut>
										<Link to="/login">Login</Link>
									</SignedOut>
								</nav>
								<hr />
								{children}
							</div>
							<Footer />
						</div>
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
