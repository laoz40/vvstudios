import {
	CircleCheck,
	CircleX,
	Download,
	Pencil,
	Send,
	Upload,
	type LucideIcon
} from "lucide-react";
import { EDIT_WORK_STATUSES } from "#/domain/booking/edit-status";
import type { Doc } from "#convex/_generated/dataModel";

export const editStatuses = {
	not_started: {
		label: "Not started",
		className: "text-destructive",
		segmentClassName: "bg-destructive",
		icon: CircleX
	},
	downloading: {
		label: "Downloading",
		className: "text-primary",
		segmentClassName: "bg-primary",
		icon: Download
	},
	editing: {
		label: "Editing",
		className: "text-primary",
		segmentClassName: "bg-primary",
		icon: Pencil
	},
	uploading: {
		label: "Uploading",
		className: "text-primary",
		segmentClassName: "bg-primary",
		icon: Upload
	},
	review: {
		label: "Studio review",
		className: "text-blue-400",
		segmentClassName: "bg-blue-400",
		icon: CircleCheck
	},
	sent: { label: "Sent", className: "text-green", segmentClassName: "bg-green", icon: Send }
} satisfies Record<
	Doc<"edits">["status"],
	{ label: string; className: string; segmentClassName: string; icon: LucideIcon }
>;

export function getEditWorkStep(status: Doc<"edits">["status"]) {
	const stepIndex = EDIT_WORK_STATUSES.findIndex((step) => step === status);

	return stepIndex === -1 ? EDIT_WORK_STATUSES.length + 1 : stepIndex + 1;
}
