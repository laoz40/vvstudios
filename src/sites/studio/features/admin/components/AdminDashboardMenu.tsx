import { Menu } from "lucide-react";
import { Button } from "#/components/ui/button";
import { DashboardSignOutButton } from "#studio/components/DashboardSignOutButton";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger
} from "#/components/ui/sheet";
import { AdminAvailabilitySettings } from "#studio/features/admin/components/AdminAvailabilitySettings";
import { AdminPrivacyToggle } from "#studio/features/admin/components/AdminPrivacyToggle";

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
					<AdminPrivacyToggle />
					<AdminAvailabilitySettings />
					<DashboardSignOutButton />
				</div>
			</SheetContent>
		</Sheet>
	);
}
