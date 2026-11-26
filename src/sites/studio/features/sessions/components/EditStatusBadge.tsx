import { LoaderCircle } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { cn } from "#/lib/utils";
import type { Doc } from "#convex/_generated/dataModel";
import { editStatuses, getEditWorkStep } from "#studio/features/sessions/lib/edit-status-display";

export function EditStatusBadge({
	status,
	isUpdating = false
}: {
	status: Doc<"edits">["status"];
	isUpdating?: boolean;
}) {
	const { label, className, icon: StatusIcon } = editStatuses[status];
	const { currentStep, totalSteps } = getEditWorkStep(status);

	return (
		<Badge className={cn(className, "px-1.5 text-sm leading-tight [&>svg]:size-4")}>
			{isUpdating ? (
				<>
					<LoaderCircle
						className="animate-spin"
						aria-hidden
					/>
					<span className="sr-only">Updating</span>
				</>
			) : (
				<StatusIcon aria-hidden />
			)}
			<span className="tabular-nums opacity-70">
				{currentStep}/{totalSteps}
			</span>
			{label}
		</Badge>
	);
}
