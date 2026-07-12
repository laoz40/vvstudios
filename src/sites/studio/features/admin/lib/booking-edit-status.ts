import type { ComponentProps } from "react";
import {
	Ban,
	Check,
	CalendarX2,
	Clock,
	ClockFading,
	MailWarning,
	type LucideIcon
} from "lucide-react";
import type { Doc } from "#convex/_generated/dataModel";
import type { Badge } from "#/components/ui/badge";
import { isUpcomingBooking } from "#studio/lib/bookingdatetime";

export const EDIT_STATUS_OPTIONS = ["to_edit", "editing", "completed"] as const;

export type DeliverableStatus = (typeof EDIT_STATUS_OPTIONS)[number];

type BookingRecord = Doc<"bookings">;
type BookingStatus = BookingRecord["status"];

export const bookingStatusLabelMap: Record<BookingStatus, string> = {
	abandoned: "Abandoned",
	confirmed: "Confirmed",
	cancelled: "Cancelled",
	email_failed: "Email failed",
	expired: "Expired",
	failed: "Calendar error or conflict",
	pending_payment: "Pending"
};

export const bookingStatusIconMap: Record<BookingStatus, LucideIcon> = {
	abandoned: Ban,
	confirmed: Check,
	cancelled: Ban,
	expired: ClockFading,
	email_failed: MailWarning,
	failed: CalendarX2,
	pending_payment: Clock
};

export const bookingStatusIconClassNameMap: Record<BookingStatus, string> = {
	abandoned: "size-5 text-muted-foreground",
	confirmed: "size-5 text-green",
	cancelled: "size-5 text-muted-foreground",
	expired: "size-5 text-muted-foreground",
	email_failed: "size-5 text-destructive",
	failed: "size-5 text-destructive",
	pending_payment: "size-5 text-primary"
};

export const deliverableStatusLabelMap: Record<DeliverableStatus, string> = {
	to_edit: "Not Sent",
	editing: "Editing",
	completed: "Sent"
};

export const deliverableStatusBadgeClassNameMap: Record<DeliverableStatus, string> = {
	to_edit: "bg-destructive text-primary-foreground",
	editing: "bg-primary text-primary-foreground",
	completed: "bg-green text-primary-foreground"
};

export const deliverableStatusDotClassNameMap: Record<DeliverableStatus, string> = {
	to_edit: "bg-destructive",
	editing: "bg-primary",
	completed: "bg-green"
};

export const deliverableStatusBadgeVariantMap: Record<
	DeliverableStatus,
	ComponentProps<typeof Badge>["variant"]
> = { to_edit: "destructive", editing: "default", completed: "default" };

export function getDeliverableStatus(booking: BookingRecord): DeliverableStatus {
	return booking.editStatus ?? "to_edit";
}

export function isDeliverableSession(booking: BookingRecord) {
	if (booking.status !== "confirmed" && booking.status !== "email_failed") {
		return false;
	}

	return !isUpcomingBooking(booking.date, booking.time);
}

export function hasUnsentDeliverables(booking: BookingRecord) {
	return isDeliverableSession(booking) && getDeliverableStatus(booking) !== "completed";
}
