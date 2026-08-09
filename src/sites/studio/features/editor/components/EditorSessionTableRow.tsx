import type { FunctionReturnType } from "convex/server";
import { Badge } from "#/components/ui/badge";
import { TableCell, TableRow } from "#/components/ui/table";
import { api } from "#convex/_generated/api";
import { cn } from "#/lib/utils";
import { formatDashboardAddonLabel } from "#studio/features/admin/components/AdminDashboardTableUtils";
import {
	deliverableStatusBadgeClassNameMap,
	deliverableStatusBadgeVariantMap,
	deliverableStatusLabelMap,
	type DeliverableStatus
} from "#studio/features/admin/lib/session-edit-status";
import {
	formatBookingDateMedium,
	formatBookingTimeLabel,
	getBookingDayDifference
} from "#studio/lib/bookingdatetime";

type EditorSession = FunctionReturnType<typeof api.sessions.listEditorSessions>["page"][number];

function getSessionDateSubtitle(date: string, time: string) {
	const dayDifference = getBookingDayDifference(date);

	if (dayDifference === null || dayDifference >= 0) {
		return { label: formatBookingTimeLabel(time), className: "text-muted-foreground" };
	}

	const daysAgo = Math.abs(dayDifference);
	const label = `${daysAgo} ${daysAgo === 1 ? "day" : "days"} ago`;

	switch (daysAgo) {
		case 1:
			return { label, className: "text-primary" };
		case 2:
			return { label, className: "text-orange" };
		default:
			return { label, className: "text-destructive" };
	}
}

export function EditorSessionTableRow({ session }: { session: EditorSession }) {
	const deliverableStatus: DeliverableStatus = session.editStatus ?? "to_edit";
	const dateSubtitle = getSessionDateSubtitle(session.date, session.time);

	return (
		<TableRow>
			<TableCell className="text-center">
				<Badge
					variant={deliverableStatusBadgeVariantMap[deliverableStatus]}
					className={deliverableStatusBadgeClassNameMap[deliverableStatus]}>
					{deliverableStatusLabelMap[deliverableStatus]}
				</Badge>
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
				<div className="flex flex-col gap-2 whitespace-normal">
					<p className="font-medium">
						{session.service} ({session.duration})
					</p>
					{session.addons.length > 0 ? (
						<div className="flex flex-wrap gap-1">
							{session.addons.map((addon) => (
								<Badge
									key={addon}
									variant="outline">
									{formatDashboardAddonLabel(addon, session)}
								</Badge>
							))}
						</div>
					) : null}
				</div>
			</TableCell>
			<TableCell>
				<p className="whitespace-normal text-sm text-muted-foreground">
					{session.notes?.trim() || "No notes"}
				</p>
			</TableCell>
		</TableRow>
	);
}
