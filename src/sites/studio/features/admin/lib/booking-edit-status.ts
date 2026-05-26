import type { ComponentProps } from "react";
import type { Doc } from "#convex/_generated/dataModel";
import type { Badge } from "#/components/ui/badge";

export const EDIT_STATUS_OPTIONS = ["to_edit", "editing", "completed"] as const;

export type BookingEditStatus = (typeof EDIT_STATUS_OPTIONS)[number];

type BookingRecord = Doc<"bookings">;

export const editStatusLabelMap: Record<BookingEditStatus, string> = {
	to_edit: "To edit",
	editing: "Editing",
	completed: "Completed",
};

export const editStatusBadgeClassNameMap: Record<BookingEditStatus, string> = {
	to_edit: "bg-destructive text-primary-foreground",
	editing: "bg-primary text-primary-foreground",
	completed: "bg-green text-primary-foreground",
};

export const editStatusDotClassNameMap: Record<BookingEditStatus, string> = {
	to_edit: "bg-destructive",
	editing: "bg-primary",
	completed: "bg-green",
};

export const editStatusTextClassNameMap: Record<BookingEditStatus, string> = {
	to_edit: "text-destructive",
	editing: "text-primary",
	completed: "text-green",
};

export const editStatusBadgeVariantMap: Record<
	BookingEditStatus,
	ComponentProps<typeof Badge>["variant"]
> = {
	to_edit: "destructive",
	editing: "default",
	completed: "default",
};

export function getBookingEditStatus(booking: BookingRecord): BookingEditStatus {
	return booking.editStatus ?? "to_edit";
}
