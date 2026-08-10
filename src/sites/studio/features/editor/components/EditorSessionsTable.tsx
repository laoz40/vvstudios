import type { FunctionReturnType } from "convex/server";
import { CalendarClock } from "lucide-react";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { api } from "#convex/_generated/api";
import { EditorSessionTableRow } from "#studio/features/editor/components/EditorSessionTableRow";

type EditorSession = FunctionReturnType<typeof api.sessions.listEditorSessions>["page"][number];

export function EditorSessionsTable({ sessions }: { sessions: EditorSession[] }) {
	if (sessions.length === 0) {
		return (
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
		);
	}

	return (
		<section className="overflow-x-auto border-y">
			<Table className="w-full min-w-4xl table-fixed">
				<colgroup>
					<col className="w-28" />
					<col className="w-80" />
					<col className="w-36" />
					<col className="w-80" />
					<col />
				</colgroup>
				<TableHeader>
					<TableRow>
						<TableHead className="text-center">Deliverables</TableHead>
						<TableHead>Customer</TableHead>
						<TableHead>Session</TableHead>
						<TableHead>Service</TableHead>
						<TableHead>Client Notes</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{sessions.map((session) => (
						<EditorSessionTableRow
							key={session._id}
							session={session}
						/>
					))}
				</TableBody>
			</Table>
		</section>
	);
}
