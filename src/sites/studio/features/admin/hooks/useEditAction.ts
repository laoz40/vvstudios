import { useState } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type { UpdateBookingFromAdminResult } from "#convex/googleCalendar";
import type { BookingEditDraft } from "#studio/features/admin/components/BookingEditDialog";
import { getBookingEditWarningState } from "#studio/features/admin/lib/booking-edit-warnings";
import type { BookingRecord } from "#studio/features/admin/lib/admin-bookings";
import { bookingSchema } from "#studio/features/booking-form/lib/form-shared";

export function useEditAction(booking: BookingRecord) {
	const updateBooking = useAction(api.googleCalendar.updateBookingFromAdmin);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isReplacementEventDialogOpen, setIsReplacementEventDialogOpen] = useState(false);
	const [isEditConfirmationDialogOpen, setIsEditConfirmationDialogOpen] = useState(false);
	const [pendingEditDraft, setPendingEditDraft] = useState<BookingEditDraft | null>(null);
	const [pendingEditWarningState, setPendingEditWarningState] = useState<ReturnType<
		typeof getBookingEditWarningState
	> | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	async function saveEditBooking(
		values: BookingEditDraft,
		options?: { skipConfirmation?: boolean }
	) {
		const parsedValues = bookingSchema.safeParse({
			name: values.name,
			phone: values.phone,
			accountName: values.accountName,
			abn: values.abn,
			email: values.email,
			date: values.date,
			time: values.time,
			duration: values.duration,
			service: values.service,
			addons: values.addons,
			essentialEditQuantity: values.essentialEditQuantity,
			clipsPackageQuantity: values.clipsPackageQuantity,
			notes: values.notes
		});

		if (!parsedValues.success) {
			toast.error(parsedValues.error.issues[0]?.message ?? "Please check the booking details.");
			return;
		}

		if (!options?.skipConfirmation) {
			const warningState = getBookingEditWarningState(booking, values);

			if (warningState.requiresConfirmation) {
				setPendingEditDraft(values);
				setPendingEditWarningState(warningState);
				setIsEditConfirmationDialogOpen(true);
				return;
			}
		}

		setIsSaving(true);

		const [error, result] = await tryCatch<UpdateBookingFromAdminResult>(
			updateBooking({
				bookingId: booking._id,
				name: parsedValues.data.name,
				phone: parsedValues.data.phone,
				accountName: parsedValues.data.accountName,
				abn: parsedValues.data.abn,
				email: parsedValues.data.email,
				date: parsedValues.data.date,
				time: parsedValues.data.time,
				duration: parsedValues.data.duration,
				service: parsedValues.data.service,
				addons: parsedValues.data.addons,
				essentialEditQuantity: parsedValues.data.essentialEditQuantity || undefined,
				clipsPackageQuantity: parsedValues.data.clipsPackageQuantity || undefined,
				notes: parsedValues.data.notes || undefined
			})
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;
				case "NOT_AUTHORIZED":
					toast.error("You do not have access to update bookings.");
					break;
				case "BOOKING_NOT_FOUND":
					toast.error("That booking no longer exists.");
					break;
				case "BOOKING_INVALID_DATE":
					toast.error("Enter a valid booking date.");
					break;
				case "BOOKING_INVALID_TIME":
					toast.error("Enter a valid booking time.");
					break;
				case "BOOKING_TIME_UNAVAILABLE":
					toast.error("That time is no longer available. Choose another time.");
					break;
				case "GOOGLE_CALENDAR_AUTH_FAILED":
					toast.error("Google Calendar authentication failed. Booking was not updated.");
					break;
				case "GOOGLE_CALENDAR_CREATE_FAILED":
					toast.error("Google Calendar failed to create the event. Please try again.");
					break;
				case "GOOGLE_CALENDAR_UPDATE_FAILED":
					toast.error("Google Calendar failed to update the event. Please try again.");
					break;
				case "GOOGLE_CALENDAR_RATE_LIMITED":
					toast.error("Google Calendar is busy right now. Wait a minute, then try again.");
					break;
				case "GOOGLE_CALENDAR_AVAILABILITY_FAILED":
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while updating the booking. Please try again.");
					break;
				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsSaving(false);
			return;
		}

		if (result.googleOutcome === "replacementCreated") {
			setIsEditDialogOpen(false);
			setIsReplacementEventDialogOpen(true);
			toast.success("Booking updated. Replacement Calendar event created.");
			setIsSaving(false);
			return;
		}

		setIsEditDialogOpen(false);
		toast.success("Booking updated.");
		setIsSaving(false);
	}

	async function handleEditBooking(values: BookingEditDraft) {
		await saveEditBooking(values);
	}

	function closeEditConfirmationDialog() {
		setPendingEditDraft(null);
		setPendingEditWarningState(null);
		setIsEditConfirmationDialogOpen(false);
	}

	async function handleConfirmEditBooking() {
		if (!pendingEditDraft) {
			closeEditConfirmationDialog();
			return;
		}

		const draftToSave = pendingEditDraft;
		setIsEditConfirmationDialogOpen(false);
		await saveEditBooking(draftToSave, { skipConfirmation: true });
		setPendingEditWarningState(null);
		setPendingEditDraft(null);
	}

	return {
		closeEditConfirmationDialog,
		handleConfirmEditBooking,
		handleEditBooking,
		isEditConfirmationDialogOpen,
		isEditDialogOpen,
		isReplacementEventDialogOpen,
		isSaving,
		pendingEditWarningState,
		setIsEditConfirmationDialogOpen,
		setIsEditDialogOpen,
		setIsReplacementEventDialogOpen
	};
}
