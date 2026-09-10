import { CalendarClock } from "lucide-react";
import { FixedDataTable } from "#studio/components/FixedDataTable";
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
			<FixedDataTable
				minWidthClassName="min-w-5xl"
				columns={[
					{
						key: "deliverables",
						colClassName: "w-24 md:w-16",
						header: "Deliverables",
						headerClassName: "text-center"
					},
					{ key: "customer", colClassName: "w-64", header: "Customer" },
					{ key: "session", colClassName: "w-32 md:w-24", header: "Session" },
					{ key: "service", colClassName: "w-60 md:w-48", header: "Service" },
					{ key: "admin-notes", colClassName: "w-84", header: "Admin Notes" },
					{ key: "editor-notes", colClassName: "w-84", header: "Editor Notes" },
					{
						key: "actions",
						colClassName: "md:w-12",
						header: "Actions",
						headerClassName: "text-right"
					}
				]}>
				{sessions.map((session) => (
					<EditorSessionTableRow
						key={session._id}
						session={session}
						view={emptyState}
					/>
				))}
			</FixedDataTable>
		</section>
	);
}
