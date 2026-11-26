import { useState } from "react";
import { ChevronRight, Pencil } from "lucide-react";
import {
	isEditsRowClick,
	SessionEditsInsetRow
} from "#studio/features/sessions/components/SessionEditsInsetRow";
import { SessionServiceCell } from "#studio/features/sessions/components/SessionServiceCell";
import { Button } from "#/components/ui/button";
import { TableCell, TableRow } from "#/components/ui/table";
import { cn } from "#/lib/utils";
import { EditorDeliverableStatusBadge } from "#studio/features/editor/components/EditorDeliverableStatusBadge";
import { SessionEditsTable } from "#studio/features/editor/components/SessionEditsTable";
import { EditorSessionNotesPreview } from "#studio/features/editor/components/EditorSessionNotesPreview";
import { EditorSessionDriveCell } from "#studio/features/editor/components/EditorSessionDriveCell";
import { SessionEditorNotesDialog } from "#studio/features/editor/components/SessionEditorNotesDialog";
import type {
	EditorSession,
	getEditorSessionDue
} from "#studio/features/editor/lib/editor-sessions";
import {
	formatBookingDateMedium,
	formatBookingTimeLabel,
	formatEditorEditDueLabel,
	formatShortMonthFullDate,
	getEditorEditDueSubtitleClassName,
	isUpcomingBooking
} from "#studio/lib/bookingdatetime";

type EditorSessionsView = "edits" | "history";

export function EditorSessionTableRow({
	session,
	due,
	view
}: {
	session: EditorSession;
	due: ReturnType<typeof getEditorSessionDue>;
	view: EditorSessionsView;
}) {
	const [isEditorNotesOpen, setIsEditorNotesOpen] = useState(false);
	const [isDriveDialogOpen, setIsDriveDialogOpen] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);
	const jobsRowId = `edits-${session._id}`;

	const isPastSession = !isUpcomingBooking(session.date, session.time);

	return (
		<>
			<TableRow
				data-expanded={isExpanded}
				className={cn(
					"bg-background hover:bg-background has-[+tr:last-child[data-session-edits]]:border-b-0 data-[expanded=true]:border-b-0 data-[expanded=true]:bg-muted/15 data-[expanded=true]:hover:bg-muted/15",
					due.editsDue !== undefined && "cursor-pointer"
				)}
				onClick={
					due.editsDue !== undefined
						? (event) => {
								if (isEditsRowClick(event)) setIsExpanded((expanded) => !expanded);
							}
						: undefined
				}>
				<TableCell className="text-left">
					{due.editsDue === undefined ? (
						<EditorDeliverableStatusBadge
							session={session}
							canManageDeliverables={isPastSession}
							onDownloadingStarted={() => setIsDriveDialogOpen(true)}
						/>
					) : (
						<button
							type="button"
							className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
							aria-expanded={isExpanded}
							aria-controls={jobsRowId}
							onClick={() => setIsExpanded((expanded) => !expanded)}>
							<ChevronRight
								data-expanded={isExpanded}
								className="size-4 transition-transform duration-200 ease-in data-[expanded=true]:rotate-90 motion-reduce:transition-none"
								aria-hidden
							/>
							{due.editsDue > 0 ? (
								<span className="text-primary tabular-nums">
									{due.editsDue} {due.editsDue === 1 ? "Deliverable" : "Deliverables"} due
								</span>
							) : (
								<span className="text-muted-foreground">All sent</span>
							)}
							<span className="sr-only">for {session.name}</span>
						</button>
					)}
				</TableCell>
				<TableCell>
					<div className="flex flex-col gap-1 whitespace-normal">
						<p className="font-medium">{session.name}</p>
						<p className="text-sm text-muted-foreground">{session.accountName}</p>
					</div>
				</TableCell>
				<TableCell>
					<div className="flex flex-col gap-1 whitespace-normal">
						<p className="font-medium">{formatBookingDateMedium(session.date)}</p>
						<p className="text-sm text-muted-foreground">{formatBookingTimeLabel(session.time)}</p>
					</div>
				</TableCell>
				<TableCell>
					<SessionServiceCell
						duration={session.duration}
						session={session}
					/>
				</TableCell>
				<TableCell>
					{due.showDue && due.daysUntilDue !== null ? (
						<div className="flex flex-col gap-1">
							<p className="font-medium">{formatShortMonthFullDate(due.dueAt)}</p>
							<p
								className={cn(
									"text-sm",
									getEditorEditDueSubtitleClassName(due.daysUntilDue, view)
								)}>
								{formatEditorEditDueLabel(due.daysUntilDue)}
							</p>
						</div>
					) : (
						<span className="text-muted-foreground">-</span>
					)}
				</TableCell>
				<TableCell>
					<EditorSessionNotesPreview
						bookingName={session.name}
						label="Admin notes"
						notes={session.adminNotes}
					/>
				</TableCell>
				<TableCell>
					<div className="flex min-w-0 items-center gap-1">
						{session.editorNotes?.trim() ? (
							<p className="min-w-0 truncate text-sm text-muted-foreground">
								{session.editorNotes.trim()}
							</p>
						) : null}
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className="size-5 shrink-0 text-muted-foreground"
							onClick={() => setIsEditorNotesOpen(true)}>
							<Pencil
								size={14}
								aria-hidden
							/>
							<span className="sr-only">
								{session.editorNotes?.trim() ? "Edit notes" : "Add notes"} for admin for{" "}
								{session.name}
							</span>
						</Button>
					</div>
				</TableCell>
				<TableCell className="text-right">
					<EditorSessionDriveCell
						session={session}
						isDriveDialogOpen={isDriveDialogOpen}
						onDriveDialogOpenChange={setIsDriveDialogOpen}
					/>
				</TableCell>
			</TableRow>
			{session.edits === undefined ? null : (
				<SessionEditsInsetRow
					id={jobsRowId}
					colSpan={8}
					isExpanded={isExpanded}>
					<SessionEditsTable
						session={session}
						edits={session.edits}
						dueAt={due.dueAt}
						canManageEdits={isPastSession}
						onDownloadingStarted={() => setIsDriveDialogOpen(true)}
					/>
				</SessionEditsInsetRow>
			)}
			{isEditorNotesOpen ? (
				<SessionEditorNotesDialog
					bookingId={session._id}
					bookingName={session.name}
					savedNotes={session.editorNotes}
					open
					onOpenChange={setIsEditorNotesOpen}
				/>
			) : null}
		</>
	);
}
