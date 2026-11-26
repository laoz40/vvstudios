import { useState } from "react";
import { ArrowDown, ArrowDownUp, ArrowUp, CalendarClock } from "lucide-react";
import { Button } from "#/components/ui/button";
import { FixedDataTable } from "#studio/components/FixedDataTable";
import { EditorSessionTableRow } from "#studio/features/editor/components/EditorSessionTableRow";
import {
	getEditorSessionDue,
	type EditorSession
} from "#studio/features/editor/lib/editor-sessions";

type EditorSessionsEmptyState = "edits" | "history";

const dueSortIcons = { ascending: ArrowUp, descending: ArrowDown };

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
	const [dueSort, setDueSort] = useState<"ascending" | "descending" | null>(null);

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

	const rows = sessions.map((session) => ({ session, due: getEditorSessionDue(session) }));

	if (dueSort !== null) {
		rows.sort((a, b) => {
			if (a.due.showDue !== b.due.showDue) return a.due.showDue ? -1 : 1;

			if (!a.due.showDue) return 0;

			return dueSort === "ascending" ? a.due.dueAt - b.due.dueAt : b.due.dueAt - a.due.dueAt;
		});
	}

	const DueSortIcon = dueSort === null ? ArrowDownUp : dueSortIcons[dueSort];

	return (
		<section className="overflow-x-auto border-y">
			<FixedDataTable
				minWidthClassName="min-w-6xl"
				columns={[
					{ key: "deliverables", colClassName: "w-48", header: "Deliverables" },
					{ key: "customer", colClassName: "w-56", header: "Customer" },
					{ key: "session", colClassName: "w-32 md:w-24", header: "Session" },
					{ key: "service", colClassName: "w-60 md:w-48", header: "Service" },
					{
						key: "due",
						colClassName: "w-32",
						header: (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="-ml-2"
								aria-label={dueSort ? `Due, sorted ${dueSort}` : "Sort by due date"}
								onClick={() => setDueSort(dueSort === "ascending" ? "descending" : "ascending")}>
								Due
								<DueSortIcon aria-hidden />
							</Button>
						)
					},
					{ key: "admin-notes", colClassName: "w-72", header: "Admin notes" },
					{ key: "editor-notes", colClassName: "w-72", header: "Editor notes" },
					{ key: "drive", colClassName: "w-12", header: "Drive", headerClassName: "text-right" }
				]}>
				{rows.map(({ session, due }) => (
					<EditorSessionTableRow
						key={session._id}
						session={session}
						due={due}
						view={emptyState}
					/>
				))}
			</FixedDataTable>
		</section>
	);
}
