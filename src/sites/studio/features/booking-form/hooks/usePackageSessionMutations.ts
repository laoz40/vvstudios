import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { tryCatch } from "#/lib/result";
import type { usePackageSessionDraft } from "#studio/features/booking-form/hooks/usePackageSessionDraft";
import { recordingSpaceSchema } from "#studio/features/booking-form/lib/booking-form-model";
import {
	closeBookingModal,
	useBookingModalStore
} from "#studio/features/booking-form/lib/booking-modal-store";
import {
	getSaveDefaultSpaceToastMessage,
	getSavePackageBookingToastMessage,
	getUnschedulePackageBookingToastMessage
} from "#studio/features/booking-form/lib/package-scheduling-errors";
import {
	performPackageSessionSave,
	performPackageSessionUnschedule,
	type PackageSession
} from "#studio/features/booking-form/lib/package-scheduling-session";

interface UsePackageSessionMutationsOptions {
	activeBooking: PackageSession | undefined;
	activeSessionKey: string | null;
	clearSessionDraft: () => void;
	invalidateCalendarCache: () => void;
	noticeWindowLabel: string;
	selectedDateValue: string;
	selectedNotes: string;
	selectedRemotePodcast: boolean;
	selectedService: ReturnType<typeof usePackageSessionDraft>["selectedService"];
	selectedTime: string;
	setActiveSessionKey: (sessionKey: string | null) => void;
	setHighlightedBookingId: (bookingId: Id<"bookings"> | null) => void;
	token: string;
}

export function usePackageSessionMutations({
	activeBooking,
	activeSessionKey,
	clearSessionDraft,
	invalidateCalendarCache,
	noticeWindowLabel,
	selectedDateValue,
	selectedNotes,
	selectedRemotePodcast,
	selectedService,
	selectedTime,
	setActiveSessionKey,
	setHighlightedBookingId,
	token
}: UsePackageSessionMutationsOptions) {
	const createPackageSession = useAction(api.packageScheduling.createPackageSession);
	const setDefaultSpace = useMutation(api.packageScheduling.setDefaultSpace);
	const reschedulePackageSession = useAction(api.packageScheduling.reschedulePackageSession);
	const unschedulePackageSession = useAction(api.packageScheduling.unschedulePackageSession);
	const [savingSessionKey, setSavingSessionKey] = useState<string | null>(null);
	const [isSavingDefaultSpace, setIsSavingDefaultSpace] = useState(false);
	const [unschedulingBookingId, setUnschedulingBookingId] = useState<Id<"bookings"> | null>(null);

	async function handleMakeDefaultSpace() {
		const service = recordingSpaceSchema.safeParse(selectedService).data;
		if (!service) {
			return;
		}

		setIsSavingDefaultSpace(true);
		const [saveError] = await tryCatch(setDefaultSpace({ service, token }));
		setIsSavingDefaultSpace(false);

		if (saveError !== null) {
			toast.error(getSaveDefaultSpaceToastMessage(saveError));
			return;
		}

		toast.success("Default recording space saved.");
	}

	function handleRequestSaveSession() {
		if (activeSessionKey === null) {
			toast.error("Choose a session first.");
			return;
		}

		if (!selectedDateValue || !selectedTime || !selectedService) {
			toast.error("Please choose a date, time, and recording space first.");
			return;
		}

		void handleSaveSession();
	}

	async function handleConfirmUnschedule() {
		const confirmation = useBookingModalStore.getState();

		if (confirmation.modal !== "packageUnscheduleConfirmation") {
			return;
		}

		await handleUnschedule(confirmation.bookingId);
	}

	async function handleSaveSession() {
		if (activeSessionKey === null) {
			return;
		}

		const service = recordingSpaceSchema.safeParse(selectedService).data;
		if (!service) {
			return;
		}

		setSavingSessionKey(activeSessionKey);

		const sessionInput = {
			date: selectedDateValue,
			time: selectedTime,
			service,
			notes: selectedNotes,
			remotePodcast: selectedRemotePodcast,
			token
		};
		const saveOutcome = await performPackageSessionSave(
			activeBooking,
			sessionInput,
			createPackageSession,
			reschedulePackageSession
		);

		setSavingSessionKey(null);

		if (saveOutcome.status === "error") {
			toast.error(getSavePackageBookingToastMessage(saveOutcome.error, noticeWindowLabel));
			return;
		}

		closeBookingModal();
		setActiveSessionKey(null);
		setHighlightedBookingId(saveOutcome.bookingId);
		toast.success(
			saveOutcome.wasReschedule
				? "Session rescheduled. Check your email for the updated invitation."
				: "Calendar event created. Check your email for the invitation."
		);
		invalidateCalendarCache();
	}

	async function handleUnschedule(bookingId: Id<"bookings">) {
		setUnschedulingBookingId(bookingId);
		const unscheduleOutcome = await performPackageSessionUnschedule(
			bookingId,
			token,
			unschedulePackageSession
		);
		setUnschedulingBookingId(null);

		if (unscheduleOutcome.status === "error") {
			toast.error(
				getUnschedulePackageBookingToastMessage(unscheduleOutcome.error, noticeWindowLabel)
			);
			return;
		}

		closeBookingModal();
		setActiveSessionKey(null);
		setHighlightedBookingId(null);
		invalidateCalendarCache();

		if (activeSessionKey === bookingId) {
			clearSessionDraft();
		}

		toast.success("Session unscheduled.");
	}

	return {
		handleConfirmUnschedule,
		handleMakeDefaultSpace,
		handleRequestSaveSession,
		isSavingDefaultSpace,
		savingSessionKey,
		unschedulingBookingId
	};
}
