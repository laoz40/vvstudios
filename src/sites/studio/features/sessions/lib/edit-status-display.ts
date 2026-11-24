import {
	CircleCheck,
	CircleX,
	Download,
	Pencil,
	Send,
	Upload,
	type LucideIcon
} from "lucide-react";
import type { Doc } from "#convex/_generated/dataModel";
import { deliverableStatusBadgeClassNameMap } from "#studio/features/admin/lib/session-edit-status";

export const editStatuses = {
	not_started: {
		label: "Not started",
		className: "bg-destructive text-primary-foreground",
		icon: CircleX
	},
	downloading: {
		label: "Downloading",
		className: deliverableStatusBadgeClassNameMap.downloading,
		icon: Download
	},
	editing: {
		label: "Editing",
		className: deliverableStatusBadgeClassNameMap.editing,
		icon: Pencil
	},
	uploading: {
		label: "Uploading",
		className: deliverableStatusBadgeClassNameMap.uploading,
		icon: Upload
	},
	review: {
		label: "Studio review",
		className: deliverableStatusBadgeClassNameMap.review,
		icon: CircleCheck
	},
	sent: { label: "Sent", className: deliverableStatusBadgeClassNameMap.completed, icon: Send }
} satisfies Record<Doc<"edits">["status"], { label: string; className: string; icon: LucideIcon }>;
