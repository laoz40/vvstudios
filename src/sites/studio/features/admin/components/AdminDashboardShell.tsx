import { SignOutButton } from "@clerk/clerk-react";
import type { ReactNode } from "react";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import LogoutIcon from "#/components/ui/logout-icon";
import { studioSite } from "#/config/sites";
import { cn } from "#/lib/utils";
import { AdminAvailabilitySettings } from "#studio/features/admin/components/AdminAvailabilitySettings";
import { AdminDashboardMenu } from "#studio/features/admin/components/AdminDashboardMenu";
import {
	AdminDashboardTabs,
	type AdminDashboardView
} from "#studio/features/admin/components/AdminDashboardTabs";

type AdminDashboardShellProps = {
	activeView: AdminDashboardView;
	children: ReactNode;
	email: string | null;
	onActiveViewChange: (view: AdminDashboardView) => void;
};

export function AdminDashboardShell({
	activeView,
	children,
	email,
	onActiveViewChange
}: AdminDashboardShellProps) {
	return (
		<main
			className={cn(
				"relative flex min-h-screen flex-col gap-5 md:gap-6",
				"bg-card",
				"p-3 pb-8 md:p-4 lg:px-6"
			)}>
			<div className="absolute top-3 right-3 md:hidden">
				<AdminDashboardMenu email={email} />
			</div>
			<section className="flex flex-col gap-4 pr-14 md:gap-5 md:pr-0">
				<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
					<AdminDashboardTabs
						activeView={activeView}
						onActiveViewChange={onActiveViewChange}
					/>

					<div className="hidden md:block">
						<div className="flex flex-wrap items-center gap-2">
							<AdminAvailabilitySettings />
							<span title={`Signed in as ${email ?? "Unknown user"}`}>
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
							</span>
						</div>
					</div>
				</div>
			</section>
			{children}
		</main>
	);
}
