import { SignOutButton } from "@clerk/clerk-react";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import LogoutIcon from "#/components/ui/logout-icon";
import { studioSite } from "#/config/sites";

export function DashboardSignOutButton() {
	return (
		<SignOutButton redirectUrl={studioSite.routes.login}>
			<AnimatedIconButton
				type="button"
				variant="ghost"
				size="sm"
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
	);
}
