import { useQuery } from "convex/react";
import { XIcon } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { TableCell, TableRow } from "#/components/ui/table";
import { cn } from "#/lib/utils";
import { api } from "#convex/_generated/api";
import { FixedDataTable } from "#studio/components/FixedDataTable";
import { PrivacySensitiveText } from "#studio/features/admin/components/PrivacySensitiveText";
import type { ManagedEditor } from "#studio/features/admin/lib/editor-management";
import {
	deliverableStatusBadgeClassNameMap,
	deliverableStatusBadgeVariantMap,
	deliverableStatusLabelMap,
	type DeliverableStatus
} from "#studio/features/admin/lib/session-edit-status";
import { SessionServiceCell } from "#studio/features/sessions/components/SessionServiceCell";
import {
	formatBookingDateMedium,
	formatBookingTimeLabel,
	formatEditorEditDueLabel,
	formatShortMonthFullDate,
	getEditorEditDueAt,
	getEditorEditDueDayDifference,
	getEditorEditDueSubtitleClassName
} from "#studio/lib/bookingdatetime";

type ContractorJobsDialogProps = {
	editor: ManagedEditor;
	onOpenChange: (open: boolean) => void;
	open: boolean;
};

function ActiveJobsContent({ editor, open }: { editor: ManagedEditor; open: boolean }) {
	const result = useQuery(
		api.employees.admin.listActiveJobs,
		open ? { tokenIdentifier: editor.tokenIdentifier } : "skip"
	);

	if (result === undefined) {
		return (
			<p
				className="py-8 text-center text-muted-foreground"
				role="status">
				Loading active jobs…
			</p>
		);
	}

	const [error, jobs] = result;

	if (error !== null) {
		return (
			<p
				className="py-8 text-center text-destructive"
				role="alert">
				Active jobs could not be loaded. Please try again.
			</p>
		);
	}

	if (jobs.length === 0) {
		return (
			<p className="py-8 text-center text-muted-foreground">This contractor has no active jobs.</p>
		);
	}

	return (
		<div className="max-h-[min(65vh,36rem)] overflow-auto rounded-md border">
			<FixedDataTable
				minWidthClassName="min-w-[80rem]"
				columns={[
					{
						key: "status",
						colClassName: "w-32",
						header: "Status",
						headerClassName: "sticky top-0 z-10 bg-background"
					},
					{
						key: "client",
						colClassName: "w-36",
						header: "Client",
						headerClassName: "sticky top-0 z-10 bg-background"
					},
					{
						key: "session",
						colClassName: "w-36",
						header: "Session",
						headerClassName: "sticky top-0 z-10 bg-background"
					},
					{
						key: "service",
						colClassName: "w-48",
						header: "Service",
						headerClassName: "sticky top-0 z-10 bg-background"
					},
					{
						key: "due",
						colClassName: "w-36",
						header: "Due",
						headerClassName: "sticky top-0 z-10 bg-background"
					},
					{
						key: "admin-notes",
						colClassName: "w-[16.5rem]",
						header: "Admin notes",
						headerClassName: "sticky top-0 z-10 bg-background"
					},
					{
						key: "editor-notes",
						colClassName: "w-[16.5rem]",
						header: "Editor notes",
						headerClassName: "sticky top-0 z-10 bg-background"
					}
				]}>
				{jobs.map((job) => {
					const status: DeliverableStatus = job.editStatus ?? "to_edit";
					const daysUntilDue = getEditorEditDueDayDifference(job.sessionStartAt);
					const dueAt = getEditorEditDueAt(job.sessionStartAt);

					return (
						<TableRow key={job._id}>
							<TableCell className="align-top">
								<Badge
									className={deliverableStatusBadgeClassNameMap[status]}
									variant={deliverableStatusBadgeVariantMap[status]}>
									{deliverableStatusLabelMap[status]}
								</Badge>
							</TableCell>
							<TableCell className="align-top">
								<div className="flex flex-col gap-1 whitespace-normal">
									<p className="font-medium">
										<PrivacySensitiveText
											rowId={job._id}
											value={job.name}
											label="client name"
											copyable={false}>
											{job.name}
										</PrivacySensitiveText>
									</p>
									<p className="text-sm text-muted-foreground">
										<PrivacySensitiveText
											rowId={job._id}
											value={job.accountName}
											label="account name"
											copyable={false}>
											{job.accountName}
										</PrivacySensitiveText>
									</p>
								</div>
							</TableCell>
							<TableCell className="align-top">
								<div className="flex flex-col gap-1 whitespace-normal">
									<p className="font-medium">{formatBookingDateMedium(job.date)}</p>
									<p className="text-sm text-muted-foreground">
										{formatBookingTimeLabel(job.time)}
									</p>
								</div>
							</TableCell>
							<TableCell className="align-top">
								<SessionServiceCell
									duration={job.duration}
									session={job}
								/>
							</TableCell>
							<TableCell className="align-top">
								<div className="flex flex-col gap-1 whitespace-normal">
									<p className="font-medium">{formatShortMonthFullDate(dueAt)}</p>
									<p
										className={cn(
											"text-sm",
											daysUntilDue === null
												? "text-muted-foreground"
												: getEditorEditDueSubtitleClassName(daysUntilDue, "edits")
										)}>
										{daysUntilDue === null
											? "Due timing unavailable"
											: formatEditorEditDueLabel(daysUntilDue)}
									</p>
								</div>
							</TableCell>
							<TableCell className="align-top [overflow-wrap:anywhere] whitespace-pre-wrap text-muted-foreground">
								{job.adminNotes?.trim() || "-"}
							</TableCell>
							<TableCell className="align-top [overflow-wrap:anywhere] whitespace-pre-wrap text-muted-foreground">
								{job.editorNotes?.trim() || "-"}
							</TableCell>
						</TableRow>
					);
				})}
			</FixedDataTable>
		</div>
	);
}

export function ContractorJobsDialog({ editor, onOpenChange, open }: ContractorJobsDialogProps) {
	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}>
			<DialogContent className="grid-rows-[auto_minmax(0,1fr)] gap-4 sm:max-w-7xl">
				<DialogHeader className="pr-8">
					<DialogTitle>Active jobs</DialogTitle>
					<DialogDescription>
						Jobs assigned to{" "}
						<PrivacySensitiveText
							rowId={editor.tokenIdentifier}
							value={editor.displayName || "Unnamed contractor"}
							label="contractor name"
							copyable={false}>
							{editor.displayName || "Unnamed contractor"}
						</PrivacySensitiveText>
					</DialogDescription>
				</DialogHeader>
				<ActiveJobsContent
					editor={editor}
					open={open}
				/>
				<DialogClose asChild>
					<Button
						aria-label="Close active jobs"
						className="absolute top-3 right-3"
						size="icon-sm"
						variant="ghost">
						<XIcon aria-hidden />
					</Button>
				</DialogClose>
			</DialogContent>
		</Dialog>
	);
}
