import { SignOutButton } from "@clerk/clerk-react";
import { Menu } from "lucide-react";
import { Button } from "#/components/ui/button";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import LogoutIcon from "#/components/ui/logout-icon";
import { studioSite } from "#/config/sites";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger
} from "#/components/ui/sheet";
import { AdminAvailabilitySettings } from "#studio/features/admin/components/AdminAvailabilitySettings";

type AdminDashboardMenuProps = { email: string | null };

export function AdminDashboardMenu({ email }: AdminDashboardMenuProps) {
	return (
		<Sheet>
			<SheetTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="md:hidden"
					aria-label="Open admin menu">
					<Menu aria-hidden />
				</Button>
			</SheetTrigger>
			<SheetContent>
				<SheetHeader>
					<SheetTitle>Admin menu</SheetTitle>
					<SheetDescription>Signed in as {email ?? "Unknown user"}.</SheetDescription>
				</SheetHeader>
				<div className="flex flex-col items-start gap-2 px-4">
					<AdminAvailabilitySettings />
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
				</div>
			</SheetContent>
		</Sheet>
	);
}
