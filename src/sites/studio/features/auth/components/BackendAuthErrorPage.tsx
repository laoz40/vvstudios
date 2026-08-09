import { SignOutButton } from "@clerk/clerk-react";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import LogoutIcon from "#/components/ui/logout-icon";
import { studioSite } from "#/config/sites";

export function BackendAuthErrorPage() {
	return (
		<main>
			<h1>Past sessions</h1>
			<p>
				You are signed in, but the backend is not receiving a valid auth token yet. Contact web
				developer.
			</p>
			<SignOutButton redirectUrl={studioSite.routes.login}>
				<AnimatedIconButton
					type="button"
					iconPosition="before"
					renderIcon={(iconRef) => (
						<LogoutIcon
							ref={iconRef}
							aria-hidden
						/>
					)}>
					<button type="button">Sign out</button>
				</AnimatedIconButton>
			</SignOutButton>
		</main>
	);
}
