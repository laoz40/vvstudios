import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "#/components/ui/button";
import { TableCell, TableRow } from "#/components/ui/table";
import { cn } from "#/lib/utils";
import { EditorDeliverableStatusBadge } from "#studio/features/editor/components/EditorDeliverableStatusBadge";
import { EditorSessionNotesPreview } from "#studio/features/editor/components/EditorSessionNotesPreview";
import { EditorSessionDriveCell } from "#studio/features/editor/components/EditorSessionDriveCell";
import { SessionEditorNotesDialog } from "#studio/features/editor/components/SessionEditorNotesDialog";
import type { EditorSession } from "#studio/features/editor/lib/editor-sessions";
import { SessionServiceCell } from "#studio/features/sessions/components/SessionServiceCell";
import {
	formatBookingDateMedium,
	formatBookingTimeLabel,
	formatEditorEditDueLabel,
	getBookingDayDifference,
	getBookingStartTimestamp,
	getEditorEditDueDayDifference,
	getEditorEditDueSubtitleClassName,
	isUpcomingBooking
} from "#studio/lib/bookingdatetime";

type EditorSessionsView = "edits" | "history";

function getSessionDateSubtitle(
	date: string,
	time: string,
	view: EditorSessionsView,
	editStatus: EditorSession["editStatus"],
	editorDueDate?: string
) {
	const dayDifference = getBookingDayDifference(date);

	if (dayDifference === null || dayDifference >= 0) {
		return { label: formatBookingTimeLabel(time), className: "text-muted-foreground" };
	}

	const sessionStartAt = getBookingStartTimestamp(date, time);
	const daysUntilDue = getEditorEditDueDayDifference(sessionStartAt, new Date(), editorDueDate);

	if (daysUntilDue === null) {
		return { label: formatBookingTimeLabel(time), className: "text-muted-foreground" };
	}

	if (editStatus === "review" && daysUntilDue <= 0) return null;

	return {
		label: formatEditorEditDueLabel(daysUntilDue),
		className: getEditorEditDueSubtitleClassName(daysUntilDue, view)
	};
}

export function EditorSessionTableRow({
	session,
	view
}: {
	session: EditorSession;
	view: EditorSessionsView;
}) {
	const [isEditorNotesOpen, setIsEditorNotesOpen] = useState(false);

	const dateSubtitle = getSessionDateSubtitle(
		session.date,
		session.time,
		view,
		session.editStatus,
		session.editorDueDate
	);

	const isPastSession = !isUpcomingBooking(session.date, session.time);

	return (
		<>
			<TableRow>
				<TableCell className="text-left">
					<EditorDeliverableStatusBadge
						session={session}
						canManageDeliverables={isPastSession}
					/>
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
						{dateSubtitle !== null ? (
							<p className={cn("text-sm", dateSubtitle.className)}>{dateSubtitle.label}</p>
						) : null}
					</div>
				</TableCell>
				<TableCell>
					<SessionServiceCell
						duration={session.duration}
						session={session}
					/>
				</TableCell>
				<TableCell>
					<EditorSessionNotesPreview
						bookingName={session.name}
						label="Message from admin"
						summary="Admin sent you a message!"
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
					<EditorSessionDriveCell session={session} />
				</TableCell>
			</TableRow>
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
