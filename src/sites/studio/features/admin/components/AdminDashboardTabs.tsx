import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";

export type AdminDashboardView = "bookings" | "packages" | "employees";

type AdminDashboardTabsProps = {
	activeView: AdminDashboardView;
	onActiveViewChange: (view: AdminDashboardView) => void;
};

export function AdminDashboardTabs({ activeView, onActiveViewChange }: AdminDashboardTabsProps) {
	function handleValueChange(value: string) {
		if (value === "bookings" || value === "packages" || value === "employees") {
			onActiveViewChange(value);
		}
	}

	return (
		<Tabs
			value={activeView}
			onValueChange={handleValueChange}>
			<TabsList variant="line">
				<TabsTrigger value="bookings">Sessions</TabsTrigger>
				<TabsTrigger value="packages">Packages</TabsTrigger>
				<TabsTrigger value="employees">Employees</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}
