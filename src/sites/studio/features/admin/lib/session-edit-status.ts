import type { ComponentProps } from "react";
import {
	Ban,
	Check,
	CalendarX2,
	CircleX,
	Clock,
	ClockFading,
	MailWarning,
	Pencil,
	Send,
	type LucideIcon
} from "lucide-react";
import type { Doc } from "#convex/_generated/dataModel";
import type { Badge } from "#/components/ui/badge";
import { isUpcomingBooking } from "#studio/lib/bookingdatetime";

export const EDIT_STATUS_OPTIONS = ["to_edit", "editing", "completed"] as const;

type DeliverableStatusAction = (typeof EDIT_STATUS_OPTIONS)[number];

export type DeliverableStatus = NonNullable<Doc<"bookings">["editStatus"]>;

type DeliverableDisplayStatus = DeliverableStatus | "unassigned";

type SessionRecord = Doc<"bookings">;

type SessionStatus = SessionRecord["status"];

export const sessionStatusLabelMap: Record<SessionStatus, string> = {
	abandoned: "Abandoned",
	confirmed: "Confirmed",
	cancelled: "Cancelled",
	email_failed: "Email failed",
	expired: "Expired",
	failed: "Calendar error or conflict",
	pending_payment: "Pending"
};

export const sessionStatusIconMap: Record<SessionStatus, LucideIcon> = {
	abandoned: Ban,
	confirmed: Check,
	cancelled: Ban,
	expired: ClockFading,
	email_failed: MailWarning,
	failed: CalendarX2,
	pending_payment: Clock
};

export const sessionStatusIconClassNameMap: Record<SessionStatus, string> = {
	abandoned: "size-5 text-muted-foreground",
	confirmed: "size-5 text-green",
	cancelled: "size-5 text-muted-foreground",
	expired: "size-5 text-muted-foreground",
	email_failed: "size-5 text-destructive",
	failed: "size-5 text-destructive",
	pending_payment: "size-5 text-primary"
};

export const deliverableStatusLabelMap: Record<DeliverableDisplayStatus, string> = {
	unassigned: "Unassigned",
	to_edit: "Not Started",
	editing: "Editing",
	review: "Review",
	completed: "Sent"
};

export const deliverableStatusTabLabelMap: Record<DeliverableStatusAction, string> = {
	...deliverableStatusLabelMap,
	completed: "Deliver"
};

export const deliverableStatusBadgeClassNameMap: Record<DeliverableDisplayStatus, string> = {
	unassigned: "bg-destructive text-primary-foreground",
	to_edit: "bg-not-started text-primary-foreground",
	editing: "bg-primary text-primary-foreground",
	review: "bg-blue-400 text-primary-foreground",
	completed: "bg-green text-primary-foreground"
};

export const deliverableStatusIconMap: Record<DeliverableStatusAction, LucideIcon> = {
	to_edit: CircleX,
	editing: Pencil,
	completed: Send
};

export const deliverableStatusTabClassNameMap: Record<DeliverableStatusAction, string> = {
	to_edit:
		"hover:border-input hover:bg-input/30 hover:text-foreground hover:shadow-sm focus-visible:text-foreground disabled:opacity-100 data-[state=active]:text-foreground dark:hover:text-foreground dark:focus-visible:text-foreground dark:data-[state=active]:text-foreground",
	editing:
		"hover:border-input hover:bg-input/30 hover:text-primary hover:shadow-sm focus-visible:text-primary disabled:opacity-100 data-[state=active]:text-primary dark:hover:text-primary dark:focus-visible:text-primary dark:data-[state=active]:text-primary",
	completed:
		"hover:border-input hover:bg-input/30 hover:text-green hover:shadow-sm focus-visible:text-green disabled:opacity-100 data-[state=active]:text-green dark:hover:text-green dark:focus-visible:text-green dark:data-[state=active]:text-green"
};

export const deliverableStatusBadgeVariantMap: Record<
	DeliverableDisplayStatus,
	ComponentProps<typeof Badge>["variant"]
> = {
	unassigned: "destructive",
	to_edit: "default",
	editing: "default",
	review: "default",
	completed: "default"
};

export function getDeliverableStatus(session: SessionRecord): DeliverableStatus {
	return session.editStatus ?? "to_edit";
}

export function isDeliverableSession(session: SessionRecord) {
	if (session.status !== "confirmed" && session.status !== "email_failed") {
		return false;
	}

	return !isUpcomingBooking(session.date, session.time);
}
