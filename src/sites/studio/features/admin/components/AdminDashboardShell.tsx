import type { ReactNode } from "react";
import { cn } from "#/lib/utils";
import { DashboardSignOutButton } from "#studio/components/DashboardSignOutButton";
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
				"bg-background",
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
							<DashboardSignOutButton email={email} />
						</div>
					</div>
				</div>
			</section>
			{children}
		</main>
	);
}
