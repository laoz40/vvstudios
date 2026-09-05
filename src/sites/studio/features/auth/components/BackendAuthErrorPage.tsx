import { SignOutButton } from "@clerk/clerk-react";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import LogoutIcon from "#/components/ui/logout-icon";
import { studioSite } from "#/config/sites";
import { StudioErrorPage } from "#studio/components/StudioErrorPage";

export function BackendAuthErrorPage() {
	return (
		<StudioErrorPage
			title="Backend connection failed."
			description="You are signed in, but the backend is not receiving a valid auth token yet. Contact the web developer."
			actions={
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
			}
		/>
	);
}
