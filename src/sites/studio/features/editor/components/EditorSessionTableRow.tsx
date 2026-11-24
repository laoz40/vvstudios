import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronRight, Pencil } from "lucide-react";
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
	const reduceMotion = useReducedMotion();

	const isPastSession = !isUpcomingBooking(session.date, session.time);

	return (
		<>
			<TableRow
				data-expanded={isExpanded}
				className={cn(
					"bg-muted hover:bg-muted has-[+tr:last-child[data-session-edits]]:border-b-0 data-[expanded=true]:border-b-0",
					due.editsDue !== undefined &&
						"relative isolate [&>td:not(:first-child)_button]:relative [&>td:not(:first-child)_button]:z-10"
				)}>
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
							className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 font-medium after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
				<TableRow
					id={jobsRowId}
					data-session-edits=""
					aria-hidden={!isExpanded}
					inert={!isExpanded}
					className="border-0 bg-background hover:bg-background has-[+tr]:[&_[data-inset]]:after:block aria-[hidden=false]:[&+tr>td]:border-t aria-[hidden=false]:[&+tr>td]:border-t-foreground/30">
					<TableCell
						colSpan={7}
						className="p-0">
						<AnimatePresence initial={false}>
							{isExpanded ? (
								<motion.div
									initial={{ height: 0, opacity: 0 }}
									animate={{ height: "auto", opacity: 1 }}
									exit={{ height: 0, opacity: 0 }}
									transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeIn" }}
									className="overflow-hidden">
									<div
										data-inset=""
										className="relative bg-muted/50 px-3 pt-1 pb-2 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1.5 before:bg-linear-to-b before:from-(--shadow-color)/45 before:to-transparent after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:z-10 after:hidden after:h-1.5 after:bg-linear-to-t after:from-(--shadow-color)/40 after:to-transparent">
										<SessionEditsTable
											session={session}
											edits={session.edits}
											dueAt={due.dueAt}
											canManageEdits={isPastSession}
											onDownloadingStarted={() => setIsDriveDialogOpen(true)}
										/>
									</div>
								</motion.div>
							) : null}
						</AnimatePresence>
					</TableCell>
				</TableRow>
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
