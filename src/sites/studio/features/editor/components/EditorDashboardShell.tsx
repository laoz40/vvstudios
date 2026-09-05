import { useUser } from "@clerk/clerk-react";
import { usePaginatedQuery } from "convex/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { api } from "#convex/_generated/api";
import { cn } from "#/lib/utils";
import { DashboardSignOutButton } from "#studio/components/DashboardSignOutButton";
import { DashboardLoadingState } from "#studio/features/auth/components/DashboardLoadingState";
import type { DashboardRole } from "#studio/features/auth/lib/dashboard-loading-labels";
import { EditorSessionsTable } from "#studio/features/editor/components/EditorSessionsTable";

const EDITOR_DASHBOARD_PAGE_SIZE = 100;

export function EditorDashboardShell({ dashboardRole }: { dashboardRole: DashboardRole }) {
	const { user } = useUser();
	const sessions = usePaginatedQuery(
		api.sessions.listEditorSessions,
		{},
		{ initialNumItems: EDITOR_DASHBOARD_PAGE_SIZE }
	);
	const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
	const activeSessions = sessions.results.filter((session) => session.editStatus !== "completed");
	const completedSessions = sessions.results.filter(
		(session) => session.editStatus === "completed"
	);

	if (sessions.status === "LoadingFirstPage") {
		return (
			<DashboardLoadingState
				dashboardRole={dashboardRole}
				stage="loading-data"
			/>
		);
	}

	return (
		<main
			className={cn(
				"relative flex min-h-screen flex-col gap-5 md:gap-6",
				"bg-background",
				"p-3 pb-8 md:p-4 lg:px-6"
			)}>
			<Tabs
				defaultValue="edits"
				className="contents">
				<header className="flex items-start justify-between gap-4">
					<TabsList variant="line">
						<TabsTrigger value="edits">Edits</TabsTrigger>
						<TabsTrigger value="history">History</TabsTrigger>
					</TabsList>

					<DashboardSignOutButton email={email ?? null} />
				</header>

				<TabsContent value="edits">
					<EditorSessionsTable
						sessions={activeSessions}
						emptyState="edits"
					/>
				</TabsContent>
				<TabsContent value="history">
					<EditorSessionsTable
						sessions={completedSessions}
						emptyState="history"
					/>
				</TabsContent>
			</Tabs>
		</main>
	);
}
