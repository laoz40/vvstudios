import { useState } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch, type UnexpectedError } from "#/lib/result";
import type { UpdateBookingFromAdminResult } from "#convex/googleCalendar";
import type { SessionEditDraft } from "#studio/features/admin/components/SessionEditDialog";
import { getBookingEditWarningState } from "#studio/features/admin/lib/booking-edit-warnings";
import type { BookingRecord } from "#studio/features/admin/lib/admin-bookings";
import { bookingSchema } from "#studio/features/booking-form/lib/booking-form-model";
import { parseRemainingBalanceAmountDraft } from "#studio/features/admin/lib/remaining-balance";

type BookingUpdateError = NonNullable<UpdateBookingFromAdminResult[0]> | UnexpectedError;
type ParsedBookingValues = ReturnType<typeof bookingSchema.parse>;
type RemainingBalanceResult = ReturnType<typeof parseRemainingBalanceAmountDraft> | null;

const bookingUpdateErrorMessageMap = {
	NOT_AUTHENTICATED: "You are not signed in.",
	NOT_AUTHORIZED: "You do not have access to update bookings.",
	BOOKING_NOT_FOUND: "That booking no longer exists.",
	BOOKING_INVALID_DATE: "Enter a valid booking date.",
	BOOKING_INVALID_TIME: "Enter a valid booking time.",
	BOOKING_INVALID_INPUT: "Check the booking details and balance, then try again.",
	BOOKING_TIME_UNAVAILABLE: "That time is no longer available. Choose another time.",
	GOOGLE_CALENDAR_AUTH_FAILED: "Google Calendar authentication failed. Booking was not updated.",
	GOOGLE_CALENDAR_CREATE_FAILED: "Google Calendar failed to create the event. Please try again.",
	GOOGLE_CALENDAR_UPDATE_FAILED: "Google Calendar failed to update the event. Please try again.",
	GOOGLE_CALENDAR_RATE_LIMITED: "Google Calendar is busy right now. Wait a minute, then try again.",
	GOOGLE_CALENDAR_AVAILABILITY_FAILED:
		"Something went wrong while updating the booking. Please try again.",
	UNEXPECTED_ERROR: "Something went wrong while updating the booking. Please try again."
} satisfies Record<BookingUpdateError["reason"], string>;

function showBookingUpdateError(error: BookingUpdateError) {
	toast.error(bookingUpdateErrorMessageMap[error.reason]);
}

function buildBookingUpdateInput(
	booking: BookingRecord,
	parsedValues: ParsedBookingValues,
	remainingBalanceAmountResult: RemainingBalanceResult
) {
	return {
		bookingId: booking._id,
		name: parsedValues.name,
		phone: parsedValues.phone,
		accountName: parsedValues.accountName,
		...(parsedValues.abn ? { abn: parsedValues.abn } : {}),
		email: parsedValues.email,
		date: parsedValues.date,
		time: parsedValues.time,
		duration: parsedValues.duration,
		service: parsedValues.service,
		addons: parsedValues.addons,
		...(parsedValues.essentialEditQuantity
			? { essentialEditQuantity: parsedValues.essentialEditQuantity }
			: {}),
		...(parsedValues.clipsPackageQuantity
			? { clipsPackageQuantity: parsedValues.clipsPackageQuantity }
			: {}),
		...(parsedValues.notes ? { notes: parsedValues.notes } : {}),
		...(remainingBalanceAmountResult?.status === "valid"
			? { remainingBalanceAmount: remainingBalanceAmountResult.amount }
			: {})
	};
}

export function useEditAction(booking: BookingRecord) {
	const updateBooking = useAction(api.googleCalendar.updateBookingFromAdmin);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isReplacementEventDialogOpen, setIsReplacementEventDialogOpen] = useState(false);
	const [isEditConfirmationDialogOpen, setIsEditConfirmationDialogOpen] = useState(false);
	const [pendingEditDraft, setPendingEditDraft] = useState<SessionEditDraft | null>(null);
	const [pendingEditWarningState, setPendingEditWarningState] = useState<ReturnType<
		typeof getBookingEditWarningState
	> | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	async function saveEditBooking(
		values: SessionEditDraft,
		options?: { skipConfirmation?: boolean }
	) {
		const parsedValues = bookingSchema.safeParse({
			name: values.name,
			phone: values.phone,
			accountName: values.accountName,
			abn: values.abn,
			email: values.email,
			bookingMode: "single",
			packageSize: "",
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

		const remainingBalanceDraft = values.remainingBalanceAmount.trim();
		const remainingBalanceAmountResult = remainingBalanceDraft
			? parseRemainingBalanceAmountDraft(remainingBalanceDraft)
			: null;

		if (remainingBalanceAmountResult?.status === "invalid") {
			toast.error("Enter a valid remaining balance.");
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

		const updateInput = buildBookingUpdateInput(
			booking,
			parsedValues.data,
			remainingBalanceAmountResult
		);
		const [error, result] = await tryCatch<UpdateBookingFromAdminResult>(
			updateBooking(updateInput)
		);

		if (error !== null) {
			showBookingUpdateError(error);
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

	async function handleEditBooking(values: SessionEditDraft) {
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
