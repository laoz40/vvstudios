import { useState } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch, type UnexpectedError } from "#/lib/result";
import type { UpdateSessionFromAdminResult } from "#convex/googleCalendar";
import type { SessionEditDraft } from "#studio/features/admin/components/SessionEditDialog";
import { getSessionEditWarningState } from "#studio/features/admin/lib/session-edit-warnings";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";
import { bookingSchema } from "#studio/features/booking-form/lib/booking-form-model";
import { parseRemainingBalanceAmountDraft } from "#studio/features/admin/lib/remaining-balance";

type SessionUpdateError = NonNullable<UpdateSessionFromAdminResult[0]> | UnexpectedError;
type ParsedSessionValues = ReturnType<typeof bookingSchema.parse>;
type RemainingBalanceResult = ReturnType<typeof parseRemainingBalanceAmountDraft> | null;

const sessionUpdateErrorMessageMap = {
	NOT_AUTHENTICATED: "You are not signed in.",
	NOT_AUTHORIZED: "You do not have access to update sessions.",
	BOOKING_NOT_FOUND: "That session no longer exists.",
	BOOKING_INVALID_DATE: "Enter a valid session date.",
	BOOKING_INVALID_TIME: "Enter a valid session time.",
	BOOKING_INVALID_INPUT: "Check the session details and balance, then try again.",
	BOOKING_TIME_UNAVAILABLE: "That time is no longer available. Choose another time.",
	GOOGLE_CALENDAR_AUTH_FAILED: "Google Calendar authentication failed. Booking was not updated.",
	GOOGLE_CALENDAR_CREATE_FAILED: "Google Calendar failed to create the event. Please try again.",
	GOOGLE_CALENDAR_UPDATE_FAILED: "Google Calendar failed to update the event. Please try again.",
	GOOGLE_CALENDAR_RATE_LIMITED: "Google Calendar is busy right now. Wait a minute, then try again.",
	GOOGLE_CALENDAR_AVAILABILITY_FAILED:
		"Something went wrong while updating the session. Please try again.",
	UNEXPECTED_ERROR: "Something went wrong while updating the session. Please try again."
} satisfies Record<SessionUpdateError["reason"], string>;

function showSessionUpdateError(error: SessionUpdateError) {
	toast.error(sessionUpdateErrorMessageMap[error.reason]);
}

function buildSessionUpdateInput(
	session: SessionRecord,
	parsedValues: ParsedSessionValues,
	remainingBalanceAmountResult: RemainingBalanceResult
) {
	return {
		bookingId: session._id,
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

export function useEditAction(session: SessionRecord) {
	const updateSession = useAction(api.googleCalendar.updateSessionFromAdmin);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isReplacementEventDialogOpen, setIsReplacementEventDialogOpen] = useState(false);
	const [isEditConfirmationDialogOpen, setIsEditConfirmationDialogOpen] = useState(false);
	const [pendingEditDraft, setPendingEditDraft] = useState<SessionEditDraft | null>(null);
	const [pendingEditWarningState, setPendingEditWarningState] = useState<ReturnType<
		typeof getSessionEditWarningState
	> | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	async function saveSessionEdit(
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
			toast.error(parsedValues.error.issues[0]?.message ?? "Please check the session details.");
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
			const warningState = getSessionEditWarningState(session, values);

			if (warningState.requiresConfirmation) {
				setPendingEditDraft(values);
				setPendingEditWarningState(warningState);
				setIsEditConfirmationDialogOpen(true);
				return;
			}
		}

		setIsSaving(true);

		const updateInput = buildSessionUpdateInput(
			session,
			parsedValues.data,
			remainingBalanceAmountResult
		);
		const [error, result] = await tryCatch<UpdateSessionFromAdminResult>(
			updateSession(updateInput)
		);

		if (error !== null) {
			showSessionUpdateError(error);
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
		await saveSessionEdit(values);
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
		await saveSessionEdit(draftToSave, { skipConfirmation: true });
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
