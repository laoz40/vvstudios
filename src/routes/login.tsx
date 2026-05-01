import { SignIn, useAuth } from "@clerk/clerk-react";
import { Link, Navigate, createFileRoute } from "@tanstack/react-router";

import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	const { isLoaded, userId } = useAuth();

	if (!isLoaded) {
		return (
			<main className="grid min-h-dvh place-items-center px-4 py-12">
				<p className="text-sm text-muted-foreground">Loading sign-in...</p>
			</main>
		);
	}

	if (userId) {
		return <Navigate to="/admin" />;
	}

	return (
		<main className="login-page grid min-h-dvh place-items-center px-4 py-12">
			<Card className="w-full max-w-sm gap-5 rounded-lg border-border bg-card shadow-sm">
				<CardHeader className="gap-3 px-5">
					<CardTitle asChild>
						<h1 className="text-xl leading-tight">Administrator login</h1>
					</CardTitle>
					<p className="text-sm leading-6 text-muted-foreground">
						Authorised access only. If you want to create a booking, please go to the{" "}
						<Link
							className="accent-link"
							to="/book">
							booking page
						</Link>
						. No login is needed.
					</p>
				</CardHeader>
				<CardContent className="px-5 pb-5">
					<SignIn
						routing="hash"
						forceRedirectUrl="/admin"
						fallbackRedirectUrl="/admin"
						signUpForceRedirectUrl="/admin"
						signUpFallbackRedirectUrl="/admin"
						appearance={{
							variables: {
								colorBackground: "#2d2d2d",
								colorText: "#fafafa",
								colorTextSecondary: "#d0d0d0",
								colorInputBackground: "#1a1a1a",
								colorInputText: "#fafafa",
								colorPrimary: "#f5c400",
								borderRadius: "0.5rem",
							},
							elements: {
								rootBox: "w-full",
								cardBox: "w-full shadow-none",
								card: "w-full gap-4 border-0 bg-transparent p-0 shadow-none",
								header: "hidden",
								socialButtonsBlockButton:
									"h-10 rounded-md border-border bg-secondary text-sm text-secondary-foreground hover:bg-accent",
								formButtonPrimary:
									"h-10 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90",
								formFieldInput:
									"h-10 rounded-md border-input bg-background text-foreground shadow-none focus:border-ring focus:ring-ring",
								formFieldLabel: "text-sm text-foreground",
								footer: "hidden",
								dividerLine: "bg-border",
								dividerText: "text-muted-foreground",
								formFieldAction: "text-primary hover:text-primary/90",
								identityPreviewEditButton: "text-primary hover:text-primary/90",
							},
						}}
					/>
				</CardContent>
			</Card>
		</main>
	);
}
