import { LoaderCircle } from "lucide-react";
import { EDIT_WORK_STATUSES } from "#/domain/booking/edit-status";
import { cn } from "#/lib/utils";
import type { Doc } from "#convex/_generated/dataModel";
import { editStatuses, getEditWorkStep } from "#studio/features/sessions/lib/edit-status-display";

const EDIT_WORK_SEGMENTS = [...EDIT_WORK_STATUSES, "deliver"] as const;

export function EditStatusBadge({
	status,
	isUpdating = false
}: {
	status: Doc<"edits">["status"];
	isUpdating?: boolean;
}) {
	const { label, className, segmentClassName, icon: StatusIcon } = editStatuses[status];
	const workStep = getEditWorkStep(status);

	return (
		<div className="flex w-32 shrink-0 flex-col gap-1">
			<span
				className={cn(
					"inline-flex items-center gap-1.5 text-sm leading-tight font-medium whitespace-nowrap",
					className
				)}>
				{isUpdating ? (
					<>
						<LoaderCircle
							className="size-4 shrink-0 animate-spin"
							aria-hidden
						/>
						<span className="sr-only">Updating</span>
					</>
				) : (
					<StatusIcon
						className="size-4 shrink-0"
						aria-hidden
					/>
				)}
				{label}
			</span>
			<div
				aria-hidden
				className="grid w-full grid-cols-5 gap-0.75">
				{EDIT_WORK_SEGMENTS.map((step, index) => (
					<span
						key={step}
						className={cn(
							"h-0.75 rounded-full",
							index < workStep ? segmentClassName : "bg-muted-foreground/25"
						)}
					/>
				))}
			</div>
		</div>
	);
}
