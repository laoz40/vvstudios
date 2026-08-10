import { useUser } from "@clerk/clerk-react";
import { usePaginatedQuery } from "convex/react";
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { api } from "#convex/_generated/api";
import { cn } from "#/lib/utils";
import { DashboardSignOutButton } from "#studio/components/DashboardSignOutButton";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";
import { EditorSessionsTable } from "#studio/features/editor/components/EditorSessionsTable";

const EDITOR_PAGE_SIZE = 100;

export function EditorDashboardShell() {
	const { user } = useUser();
	const sessions = usePaginatedQuery(
		api.sessions.listEditorSessions,
		{},
		{ initialNumItems: EDITOR_PAGE_SIZE }
	);
	const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;

	if (sessions.status === "LoadingFirstPage") {
		return (
			<main className="grid min-h-dvh place-items-center px-6 py-12">
				<StudioLoadingState label="Loading assigned sessions" />
			</main>
		);
	}

	return (
		<main
			className={cn(
				"relative flex min-h-screen flex-col gap-5 md:gap-6",
				"bg-card",
				"p-3 pb-8 md:p-4 lg:px-6"
			)}>
			<header className="flex items-start justify-between gap-4">
				<Tabs defaultValue="edits">
					<TabsList variant="line">
						<TabsTrigger value="edits">Edits</TabsTrigger>
					</TabsList>
				</Tabs>

				<DashboardSignOutButton email={email ?? null} />
			</header>

			<EditorSessionsTable sessions={sessions.results} />
		</main>
	);
}
