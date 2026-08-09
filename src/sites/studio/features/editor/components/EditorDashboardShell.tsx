import { useUser } from "@clerk/clerk-react";
import { CalendarClock } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { cn } from "#/lib/utils";
import { DashboardSignOutButton } from "#studio/components/DashboardSignOutButton";

export function EditorDashboardShell() {
	const { user } = useUser();
	const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;

	return (
		<main
			className={cn(
				"relative flex min-h-screen flex-col gap-5 md:gap-6",
				"bg-card",
				"p-3 pb-8 md:p-4 lg:px-6"
			)}>
			<header className="flex items-start justify-between gap-4">
				<Tabs defaultValue="sessions">
					<TabsList variant="line">
						<TabsTrigger value="sessions">Sessions</TabsTrigger>
					</TabsList>
				</Tabs>

				<DashboardSignOutButton email={email ?? null} />
			</header>

			<section className="flex min-h-64 items-center justify-center px-6 py-12 text-center">
				<div className="flex max-w-sm flex-col items-center gap-3">
					<CalendarClock
						className="size-8 text-primary"
						aria-hidden
					/>
					<div className="flex flex-col gap-1">
						<h1 className="text-lg font-semibold">Nothing in your queue</h1>
						<p className="text-sm text-muted-foreground">Assigned sessions will appear here.</p>
					</div>
				</div>
			</section>
		</main>
	);
}
