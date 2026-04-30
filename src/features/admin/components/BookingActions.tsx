import * as React from "react";
import { useMutation } from "convex/react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { formatBookingInvoiceNumber } from "#/features/booking-invoice/lib/build-booking-invoice-data";
import { bookingSchema } from "#/features/booking-form/lib/form-shared";
import { BookingDeleteDialog } from "#/features/admin/components/BookingDeleteDialog";
import {
	BookingEditDialog,
	type BookingEditDraft,
} from "#/features/admin/components/BookingEditDialog";

type BookingRecord = Doc<"bookings">;

export type BookingActionsProps = {
	booking: BookingRecord;
};

export function BookingActions({ booking }: BookingActionsProps) {
	const deleteBooking = useMutation(api.bookings.deleteBooking);
	const updateBooking = useMutation(api.bookings.updateBooking);
	const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
	const [isDeleting, setIsDeleting] = React.useState(false);
	const [isSaving, setIsSaving] = React.useState(false);
	const customerBookingId = formatBookingInvoiceNumber(
		booking._id,
		booking.pendingPaymentCreatedAt,
	);

	async function handleDeleteBooking() {
		setIsDeleting(true);

		try {
			await deleteBooking({ bookingId: booking._id });
			setIsDeleteDialogOpen(false);
			toast.success("Booking deleted.");
		} catch (error) {
			toast.error(getDeleteBookingErrorMessage(error));
		} finally {
			setIsDeleting(false);
		}
	}

	async function handleEditBooking(values: BookingEditDraft) {
		setIsSaving(true);

		try {
			const parsedValues = bookingSchema.safeParse({
				name: values.name,
				phone: values.phone,
				accountName: values.accountName,
				abn: values.abn,
				email: values.email,
				date: values.date,
				time: values.time,
				duration: booking.duration,
				service: values.service,
				addons: values.addons,
				notes: values.notes,
			});

			if (!parsedValues.success) {
				toast.error(parsedValues.error.issues[0]?.message ?? "Please check the booking details.");
				return;
			}

			await updateBooking({
				bookingId: booking._id,
				name: parsedValues.data.name,
				phone: parsedValues.data.phone,
				accountName: parsedValues.data.accountName,
				abn: parsedValues.data.abn,
				email: parsedValues.data.email,
				date: parsedValues.data.date,
				time: parsedValues.data.time,
				service: parsedValues.data.service,
				addons: parsedValues.data.addons,
				notes: parsedValues.data.notes || undefined,
			});
			setIsEditDialogOpen(false);
			toast.success("Booking updated.");
		} catch (error) {
			toast.error(getBookingMutationErrorMessage(error));
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<>
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon-sm"
						className="touch-manipulation">
						<span className="sr-only">Open booking actions</span>
						<MoreHorizontal />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					className="w-48 touch-manipulation">
					<DropdownMenuGroup>
						<DropdownMenuItem onClick={() => navigator.clipboard.writeText(booking.name)}>
							Copy customer name
						</DropdownMenuItem>
						{booking.accountName ? (
							<DropdownMenuItem onClick={() => navigator.clipboard.writeText(booking.accountName)}>
								Copy account name
							</DropdownMenuItem>
						) : null}
						{booking.abn ? (
							<DropdownMenuItem onClick={() => navigator.clipboard.writeText(booking.abn ?? "")}>
								Copy ABN
							</DropdownMenuItem>
						) : null}
						<DropdownMenuItem onClick={() => navigator.clipboard.writeText(booking.email)}>
							Copy email
						</DropdownMenuItem>
						{booking.phone ? (
							<DropdownMenuItem onClick={() => navigator.clipboard.writeText(booking.phone)}>
								Copy phone
							</DropdownMenuItem>
						) : null}
						<DropdownMenuItem onClick={() => navigator.clipboard.writeText(String(booking._id))}>
							Copy database ID
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => navigator.clipboard.writeText(customerBookingId)}>
							Copy booking ID
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem asChild>
							<a href={`mailto:${booking.email}`}>Email customer</a>
						</DropdownMenuItem>
						{booking.phone ? (
							<DropdownMenuItem asChild>
								<a href={`tel:${booking.phone}`}>Call customer</a>
							</DropdownMenuItem>
						) : null}
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						className="text-destructive focus:text-destructive"
						onSelect={() => setIsEditDialogOpen(true)}>
						Edit booking
					</DropdownMenuItem>
					<DropdownMenuItem
						className="text-destructive focus:text-destructive"
						onSelect={() => setIsDeleteDialogOpen(true)}>
						Delete booking
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<BookingDeleteDialog
				open={isDeleteDialogOpen}
				bookingName={booking.name}
				bookingId={customerBookingId}
				sessionDate={booking.date}
				sessionTime={booking.time}
				onOpenChange={setIsDeleteDialogOpen}
				onConfirm={handleDeleteBooking}
				isDeleting={isDeleting}
			/>
			<BookingEditDialog
				open={isEditDialogOpen}
				booking={booking}
				bookingId={customerBookingId}
				onOpenChange={setIsEditDialogOpen}
				onSave={handleEditBooking}
				isSaving={isSaving}
			/>
		</>
	);
}

function getDeleteBookingErrorMessage(error: unknown) {
	if (typeof error !== "object" || error === null) {
		return "Unable to delete booking.";
	}

	const code = "data" in error ? (error as { data?: { code?: string } }).data?.code : undefined;

	switch (code) {
		case "NOT_AUTHENTICATED":
			return "You are not signed in.";
		case "BOOKING_NOT_FOUND":
			return "That booking no longer exists.";
		default:
			return "Unable to delete booking.";
	}
}

function getBookingMutationErrorMessage(error: unknown) {
	if (typeof error !== "object" || error === null) {
		return "Unable to save booking changes.";
	}

	const code = "data" in error ? (error as { data?: { code?: string } }).data?.code : undefined;

	switch (code) {
		case "NOT_AUTHENTICATED":
			return "You are not signed in.";
		case "BOOKING_NOT_FOUND":
			return "That booking no longer exists.";
		default:
			return "Unable to save booking changes.";
	}
}
