import { SignOutButton } from "@clerk/clerk-react";
import { Link } from "@tanstack/react-router";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import HomeIcon from "#/components/ui/home-icon";
import LogoutIcon from "#/components/ui/logout-icon";
import { studioSite } from "#/config/sites";
import { StudioErrorPage } from "#studio/components/StudioErrorPage";

export function DashboardForbiddenPage() {
	return (
		<StudioErrorPage
			title="Dashboard access required."
			description="This account does not have permission to view the dashboard."
			actions={
				<>
					<AnimatedIconButton
						size="lg"
						iconPosition="before"
						renderIcon={(iconRef) => (
							<HomeIcon
								ref={iconRef}
								aria-hidden
							/>
						)}>
						<Link to={studioSite.routes.home}>Home</Link>
					</AnimatedIconButton>
					<SignOutButton redirectUrl={studioSite.routes.login}>
						<AnimatedIconButton
							variant="outline"
							size="lg"
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
				</>
			}
		/>
	);
}
