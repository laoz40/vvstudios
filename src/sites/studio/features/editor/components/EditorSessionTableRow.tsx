import { TableCell, TableRow } from "#/components/ui/table";
import { cn } from "#/lib/utils";
import { EditorDeliverableStatusBadge } from "#studio/features/editor/components/EditorDeliverableStatusBadge";
import { EditorDeliverablesActions } from "#studio/features/editor/components/EditorDeliverablesActions";
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

function getSessionDateSubtitle(date: string, time: string, view: EditorSessionsView) {
	const dayDifference = getBookingDayDifference(date);

	if (dayDifference === null || dayDifference >= 0) {
		return { label: formatBookingTimeLabel(time), className: "text-muted-foreground" };
	}

	const sessionStartAt = getBookingStartTimestamp(date, time);
	const daysUntilDue = getEditorEditDueDayDifference(sessionStartAt);

	if (daysUntilDue === null) {
		return { label: formatBookingTimeLabel(time), className: "text-muted-foreground" };
	}

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
	const dateSubtitle = getSessionDateSubtitle(session.date, session.time, view);
	const isPastSession = !isUpcomingBooking(session.date, session.time);

	return (
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
					<p className={cn("text-sm", dateSubtitle.className)}>{dateSubtitle.label}</p>
				</div>
			</TableCell>
			<TableCell>
				<SessionServiceCell
					duration={session.duration}
					session={session}
				/>
			</TableCell>
			<TableCell>
				<p className="text-sm whitespace-normal text-muted-foreground">
					{session.adminNotes?.trim() || "-"}
				</p>
			</TableCell>
			<TableCell>
				<p className="text-sm whitespace-normal text-muted-foreground">
					{session.editorNotes?.trim() || "-"}
				</p>
			</TableCell>
			<TableCell className="text-right">
				<EditorDeliverablesActions session={session} />
			</TableCell>
		</TableRow>
	);
}
