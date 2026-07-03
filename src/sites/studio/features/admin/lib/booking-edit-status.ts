import type { ComponentProps } from "react";
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
	failed: "Needs follow up",
	pending_payment: "Pending payment"
};

export const bookingStatusBadgeVariantMap: Record<
	BookingStatus,
	ComponentProps<typeof Badge>["variant"]
> = {
	abandoned: "outline",
	confirmed: "default",
	cancelled: "outline",
	expired: "outline",
	email_failed: "destructive",
	failed: "destructive",
	pending_payment: "secondary"
};

export const bookingStatusBadgeClassNameMap: Record<BookingStatus, string | undefined> = {
	abandoned: "bg-muted text-muted-foreground",
	confirmed: "bg-green text-primary-foreground",
	cancelled: "bg-muted text-muted-foreground",
	expired: "bg-muted text-muted-foreground",
	email_failed: "bg-destructive text-primary-foreground",
	failed: "bg-destructive text-primary-foreground",
	pending_payment: "bg-primary text-primary-foreground"
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
