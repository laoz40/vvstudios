import { Inbox, LayoutList } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { cn } from "#/lib/utils";
import type { AdminSessionsView } from "#studio/features/admin/lib/admin-sessions";

type SessionsListViewTabsProps = {
	view: AdminSessionsView;
	onViewChange: (view: AdminSessionsView) => void;
};

const sessionsViewTabsListClassName =
	"flex h-9 w-full gap-0 rounded-md border bg-transparent p-0.5 shadow-xs dark:bg-input/30 md:w-auto";

const sessionsViewTabClassName =
	"hover:bg-input/30 hover:text-primary focus-visible:text-primary data-[state=active]:text-primary dark:hover:text-primary dark:focus-visible:text-primary dark:data-[state=active]:text-primary";

function isAdminSessionsView(value: string): value is AdminSessionsView {
	return value === "inbox" || value === "all";
}

export function SessionsListViewTabs({ view, onViewChange }: SessionsListViewTabsProps) {
	return (
		<Tabs
			value={view}
			onValueChange={(nextView) => {
				if (isAdminSessionsView(nextView)) {
					onViewChange(nextView);
				}
			}}
			className="w-full md:w-auto">
			<TabsList className={sessionsViewTabsListClassName}>
				<TabsTrigger
					value="inbox"
					className={cn(
						sessionsViewTabClassName,
						"h-7 min-h-7 flex-1 gap-1 px-2 py-0 text-sm leading-none data-[state=active]:shadow-none md:flex-none"
					)}>
					<Inbox aria-hidden />
					Inbox
				</TabsTrigger>
				<TabsTrigger
					value="all"
					className={cn(
						sessionsViewTabClassName,
						"h-7 min-h-7 flex-1 gap-1 px-2 py-0 text-sm leading-none data-[state=active]:shadow-none md:flex-none"
					)}>
					<LayoutList aria-hidden />
					All sessions
				</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}
