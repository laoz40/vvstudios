import { CalendarClock } from "lucide-react";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { EditorSessionTableRow } from "#studio/features/editor/components/EditorSessionTableRow";
import type { EditorSession } from "#studio/features/editor/lib/editor-sessions";
type EditorSessionsEmptyState = "edits" | "history";

const emptyStateCopy: Record<EditorSessionsEmptyState, { title: string; description: string }> = {
	edits: { title: "Nothing in your queue", description: "Assigned edits will appear here." },
	history: {
		title: "No completed edits",
		description: "Your edits will appear here after deliverables are sent."
	}
};

export function EditorSessionsTable({
	sessions,
	emptyState
}: {
	sessions: EditorSession[];
	emptyState: EditorSessionsEmptyState;
}) {
	if (sessions.length === 0) {
		const copy = emptyStateCopy[emptyState];

		return (
			<section className="flex min-h-64 items-center justify-center px-6 py-12 text-center">
				<div className="flex max-w-sm flex-col items-center gap-3">
					<CalendarClock
						className="size-8 text-primary"
						aria-hidden
					/>
					<div className="flex flex-col gap-1">
						<h1 className="text-lg font-semibold">{copy.title}</h1>
						<p className="text-sm text-muted-foreground">{copy.description}</p>
					</div>
				</div>
			</section>
		);
	}

	return (
		<section className="overflow-x-auto border-y">
			<Table className="w-full min-w-5xl table-fixed">
				<colgroup>
					<col className="w-24 md:w-16" />
					<col className="w-64" />
					<col className="w-32 md:w-24" />
					<col className="w-60 md:w-48" />
					<col className="w-84" />
					<col className="w-84" />
					<col className="md:w-12" />
				</colgroup>
				<TableHeader>
					<TableRow>
						<TableHead className="text-center">Deliverables</TableHead>
						<TableHead>Customer</TableHead>
						<TableHead>Session</TableHead>
						<TableHead>Service</TableHead>
						<TableHead>Admin Notes</TableHead>
						<TableHead>Editor Notes</TableHead>
						<TableHead className="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{sessions.map((session) => (
						<EditorSessionTableRow
							key={session._id}
							session={session}
							view={emptyState}
						/>
					))}
				</TableBody>
			</Table>
		</section>
	);
}
