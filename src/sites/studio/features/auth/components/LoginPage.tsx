import { SignIn, SignUp, useAuth } from "@clerk/clerk-react";
import { Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader } from "#/components/ui/card";
import { studioSite } from "#/config/sites";
import { cn } from "#/lib/utils";

const clerkAppearance = {
	variables: {
		colorBackground: "#2d2d2d",
		colorText: "#fafafa",
		colorTextSecondary: "#d0d0d0",
		colorInputBackground: "#1a1a1a",
		colorInputText: "#fafafa",
		colorPrimary: "#f5c400",
		borderRadius: "0.5rem"
	},
	elements: {
		rootBox: "w-full",
		cardBox: "w-full shadow-none",
		card: "w-full gap-4 border-0 bg-transparent p-0 shadow-none",
		header: "hidden",
		socialButtonsBlockButton: cn(
			"h-10 rounded-md",
			"border-border bg-secondary",
			"text-sm text-secondary-foreground",
			"hover:bg-accent"
		),
		formButtonPrimary: cn(
			"h-10 rounded-md",
			"bg-primary",
			"text-sm font-medium text-primary-foreground",
			"hover:bg-primary/90"
		),
		formFieldInput: cn(
			"h-10 rounded-md",
			"border-input bg-background",
			"text-foreground",
			"shadow-none focus:border-ring focus:ring-ring"
		),
		formFieldLabel: "text-sm text-foreground",
		footer: "hidden",
		dividerLine: "bg-border",
		dividerText: "text-muted-foreground",
		formFieldAction: "text-primary hover:text-primary/90",
		identityPreviewEditButton: "text-primary hover:text-primary/90"
	}
};

function hasClerkInvitationTicket() {
	const ticketInSearch = new URLSearchParams(window.location.search).has("__clerk_ticket");
	const hash = window.location.hash;
	const hashQuery = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
	return ticketInSearch || new URLSearchParams(hashQuery).has("__clerk_ticket");
}

export function LoginPage() {
	const { isLoaded, userId } = useAuth();
	const [authView, setAuthView] = useState<"sign-in" | "sign-up">("sign-in");

	// Invitation links include a Clerk ticket that must complete sign-up, not sign-in.
	useEffect(() => {
		if (hasClerkInvitationTicket()) setAuthView("sign-up");
	}, []);

	if (!isLoaded) {
		return (
			<main className="grid min-h-dvh place-items-center px-4 py-12">
				<p className="text-sm text-muted-foreground">Loading sign-in...</p>
			</main>
		);
	}

	if (userId) {
		return <Navigate to={studioSite.routes.dashboard} />;
	}

	const isInvitationSignUp = authView === "sign-up";

	return (
		<main className={cn("login-page", "grid min-h-dvh place-items-center", "px-4 py-12")}>
			<Card
				className={cn("w-full max-w-sm", "gap-5", "rounded-lg border-border bg-card shadow-sm")}>
				<CardHeader className="gap-3 px-5">
					<h1 className="text-xl leading-tight font-semibold">
						{isInvitationSignUp ? "Set up your account" : "Administrator login"}
					</h1>
					<p className="text-sm leading-6 text-muted-foreground">
						{isInvitationSignUp ? (
							"Use the invitation sent to your email to create your account."
						) : (
							<>
								Authorised access only. If you want to create a booking, please go to the{" "}
								<Link
									className="accent-link"
									to={studioSite.routes.book}>
									booking page
								</Link>
								. No login is needed.
							</>
						)}
					</p>
				</CardHeader>
				<CardContent className="px-5 pb-5">
					{isInvitationSignUp ? (
						<SignUp
							routing="hash"
							forceRedirectUrl={studioSite.routes.dashboard}
							fallbackRedirectUrl={studioSite.routes.dashboard}
							appearance={clerkAppearance}
						/>
					) : (
						<SignIn
							routing="hash"
							forceRedirectUrl={studioSite.routes.dashboard}
							fallbackRedirectUrl={studioSite.routes.dashboard}
							signUpForceRedirectUrl={studioSite.routes.dashboard}
							signUpFallbackRedirectUrl={studioSite.routes.dashboard}
							appearance={clerkAppearance}
						/>
					)}
				</CardContent>
			</Card>
		</main>
	);
}
