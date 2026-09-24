import { Inbox, LayoutList } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { cn } from "#/lib/utils";

export type AdminInboxAllView = "inbox" | "all";

type AdminInboxAllViewTabsProps = {
	allTabLabel: string;
	onViewChange: (view: AdminInboxAllView) => void;
	view: AdminInboxAllView;
};

function isAdminInboxAllView(value: string): value is AdminInboxAllView {
	return value === "inbox" || value === "all";
}

export function AdminInboxAllViewTabs({
	allTabLabel,
	onViewChange,
	view
}: AdminInboxAllViewTabsProps) {
	const tabTriggerClassName = cn(
		"hover:bg-input/30 hover:text-primary focus-visible:text-primary data-[state=active]:text-primary dark:hover:text-primary dark:focus-visible:text-primary dark:data-[state=active]:text-primary",
		"h-7 min-h-7 flex-1 gap-1 px-2 py-0 text-sm leading-none data-[state=active]:shadow-none md:flex-none"
	);

	return (
		<Tabs
			value={view}
			onValueChange={(nextView) => {
				if (isAdminInboxAllView(nextView)) {
					onViewChange(nextView);
				}
			}}
			className="w-full md:w-auto">
			<TabsList className="flex h-9 w-full gap-0 rounded-md border bg-transparent p-0.5 shadow-xs md:w-auto dark:bg-input/30">
				<TabsTrigger
					value="inbox"
					className={tabTriggerClassName}>
					<Inbox aria-hidden />
					Inbox
				</TabsTrigger>
				<TabsTrigger
					value="all"
					className={tabTriggerClassName}>
					<LayoutList aria-hidden />
					{allTabLabel}
				</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}
